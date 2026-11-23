"""検証のワークフローのステップのテスト (docs/design/testing.md の W07・M08)。

使い方: python3 -I -B -m unittest discover -s .github/scripts -p "test_*.py"
verify.yaml と macos-verify.yaml は、検証待ちの一覧を取る prepare、第三者のデータを処理する scan (macOS では judge)、結果を送る
report の 3 つの job に分かれる。各 job のステップの run の本文を取り出し、外部のコマンド (curl・gh・codesign・spctl・git など) を
引数を記録するだけのスタブに差し替えて bash で走らせる。job の間の受け渡しは、artifact の代わりにファイルの複製で、GITHUB_OUTPUT と
env の代わりに出力のファイルと環境変数で再現する。Worker へ送る結果は、curl のスタブが受け取った本文で確かめる。
bash と jq が無い環境では飛ばす。
"""

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
WORKFLOWS = os.path.join(REPO, ".github", "workflows")
# Windows の CreateProcess は PATH より先に System32 の bash (WSL) を探すため、PATH で見つけたものを渡す。
BASH = shutil.which("bash")

CONFIRM_STEP = "Confirm that no OIDC token can be requested"
PIPELINES = {
    "verify": {
        "workflow": "verify.yaml",
        "prepare": "Fetch pending release files",
        "scan": "Verify pending release files",
        "report": "Send results",
    },
    "macos": {
        "workflow": "macos-verify.yaml",
        "prepare": "Fetch pending macOS bundles",
        "scan": "Judge pending macOS bundles",
        "report": "Send results",
    },
}

# 受け口が受け付けるファイル名 (src/review/network.ts の FILE)。長さは UTF-16 の単位で数える。
FILE_NAME = re.compile(r"^[^\0\r\n]{1,200}$")
# 本文は、job output の 8 個の合計の上限 (100,000 バイトを 8 個) に収める。
BODY_LIMIT = 800_000


def step_script(workflow: str, name: str) -> str:
    """ワークフローのファイルから、name のステップの run: | の本文を取り出す。"""
    with open(os.path.join(WORKFLOWS, workflow), encoding="utf-8") as f:
        lines = f.read().splitlines()
    start = next(i for i, line in enumerate(lines) if line.strip() == f"- name: {name}")
    run = next(i for i in range(start + 1, len(lines)) if lines[i].strip() == "run: |")
    indent = len(lines[run]) - len(lines[run].lstrip())
    body = []
    for line in lines[run + 1 :]:
        if line.strip() and len(line) - len(line.lstrip()) <= indent:
            break
        body.append(line)
    margin = min(len(line) - len(line.lstrip()) for line in body if line.strip())
    return "\n".join(line[margin:] for line in body).rstrip() + "\n"


def slash(path: str) -> str:
    # Windows の Git Bash でも読めるよう、パスは / で区切る。
    return path.replace(os.sep, "/")


def read_outputs(path: str) -> dict:
    """GITHUB_OUTPUT のファイルを、name=value の行から辞書にして返す。"""
    outputs = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f.read().splitlines():
                name, _, value = line.partition("=")
                outputs[name] = value
    return outputs


def expected_file(name: str) -> str:
    """当たりのファイル名の整形の期待値。改行・CR・NUL は ? に、100 文字を超える名前は末尾の 99 文字の前に … を置く。"""
    name = re.sub(r"[\0\r\n]", "?", name)
    return "…" + name[-99:] if len(name) > 100 else name


# 呼ばれた引数を 1 回ごとのファイルに NUL 区切りで記録する。ファイル名の連番で呼ばれた順を残す。
LOG_ARGS = 'n=$(ls "${STUB_LOG}" | wc -l); printf \'%s\\0\' "$@" > "${STUB_LOG}/$(printf %04d "${n}")-$(basename "$0")"\n'

STUBS = {
    "curl": """
out=""; data=""; url=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    --data|--data-binary) data="$2"; shift 2 ;;
    -H|-X|--max-filesize) shift 2 ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done
case "${url}" in
  *audience=*) echo '{"value":"oidc-token"}' ;;
  */pending) cat "${STUB_PENDING}" ;;
  */results) if [ "${data}" = "@-" ]; then cat > "${STUB_POSTED}"; else cp "${data#@}" "${STUB_POSTED}"; fi ;;
  *) cp "${STUB_ASSET}" "${out}" ;;
esac
""",
    # 証明の検証は失敗させる。呼ばれたことは記録で確かめる。
    "gh": LOG_ARGS + "exit 1\n",
    # verify.yaml は df --output=avail -B1、macos-verify.yaml は df -k の 4 列目を読む。
    "df": """
if [ "$1" = "-k" ]; then printf 'Filesystem 1K-blocks Used Available\\n/dev/stub 1 1 99999999999\\n'
else printf 'Avail\\n999999999999999\\n'; fi
""",
    "uuidgen": "echo 00000000-0000-0000-0000-000000000000\n",
    "openssl": "echo 00000000000000000000000000000000\n",
    # 取得したソースの実体は作らない。通信の検出と文書の照合は、timeout のスタブが版ごとの固定の出力を返す。
    "git": "exit 0\n",
    "timeout": """
shift
case "$*" in
  *scan-network.sh*) kind=scan ;;
  *scan-docs.mjs*) kind=docs ;;
  *) exec "$@" ;;
esac
id="${*: -1}"; id="${id##*src-}"
if [ -f "${STUB_SCAN_DIR}/${id}.${kind}.json" ]; then cat "${STUB_SCAN_DIR}/${id}.${kind}.json"
else cat "${STUB_SCAN_DIR}/default.${kind}.json"; fi
""",
    # 展開はしない。codesign と spctl のスタブはファイルを読まないため、バンドルのパスに Windows で作れない文字を使える。
    "ditto": LOG_ARGS,
    "codesign": LOG_ARGS
    + """
if [ "$1" = "-dv" ]; then
  echo 'Authority=Developer ID Application: (redacted) (ABCDE12345)'
  echo 'TeamIdentifier=ABCDE12345'
fi
""",
    "spctl": LOG_ARGS + "echo 'x: accepted'; echo 'source=Notarized Developer ID'\n",
    "xcrun": "exit 0\n",
}


@unittest.skipUnless(BASH and shutil.which("jq"), "bash と jq が要る")
class WorkflowStepTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = tmp.name
        self.stubs = os.path.join(self.root, "stubs")
        self.log = os.path.join(self.root, "log")
        self.scan_dir = os.path.join(self.root, "scan")
        self.inspect = os.path.join(self.root, "inspect.json")
        for path in (self.stubs, self.log, self.scan_dir):
            os.makedirs(path)
        self.write_scan("default", [])
        stubs = dict(STUBS)
        # 中身の検査は、固定の出力を用意したときだけ差し替える。ほかは本物のスクリプトを走らせる。
        stubs["python3"] = (
            f'if [[ "$*" == *inspect_archive.py* && -f "${{STUB_INSPECT}}" ]]; then cat "${{STUB_INSPECT}}"; exit 0; fi\n'
            f'exec "{slash(sys.executable)}" -X utf8 "$@"\n'
        )
        if os.name == "nt":
            # Windows の jq.exe は改行を CRLF で出し、read で読んだバンドルのパスの末尾に CR が残る。macOS のランナーには無い差のため、
            # --binary で LF に揃える。
            stubs["jq"] = f'exec "{slash(shutil.which("jq"))}" --binary "$@"\n'
        for name, body in stubs.items():
            with open(os.path.join(self.stubs, name), "w", encoding="utf-8", newline="\n") as f:
                f.write("#!/usr/bin/env bash\n" + body)
            os.chmod(os.path.join(self.stubs, name), 0o755)

    # --- 入力の用意 ---

    def zip_with(self, names):
        path = os.path.join(self.root, "asset.zip")
        with zipfile.ZipFile(path, "w") as z:
            for name in names:
                z.writestr(name, b"x")
        with open(path, "rb") as f:
            return path, "sha256:" + hashlib.sha256(f.read()).hexdigest()

    def write_scan(self, name, hits, doc_hits=None):
        """版 name の通信の検出と文書の照合の出力を、timeout のスタブが返す固定のファイルに書く。"""
        with open(os.path.join(self.scan_dir, f"{name}.scan.json"), "w", encoding="utf-8") as f:
            json.dump({"hits": hits, "truncated": False}, f)
        with open(os.path.join(self.scan_dir, f"{name}.docs.json"), "w", encoding="utf-8") as f:
            json.dump({"hits": doc_hits or [], "truncated": False}, f)

    def write_inspect(self, bundles=200, vst2_files=100, path_length=1000):
        """受け口の上限いっぱいの中身の検査の出力を、python3 のスタブが返す固定のファイルに書く (1 件で約 300 KB)。"""
        content = {
            "result": "vst2_detected",
            "reason": None,
            "bundles": [
                {"path": f"{i:03d}".ljust(path_length - 5, "a") + ".vst3", "format": "vst3", "os": ["windows"],
                 "arches": ["x86_64"]}
                for i in range(bundles)
            ],
            "formats": ["vst3"],
            "os": ["windows"],
            "arches": ["x86_64"],
            "vst2Files": [f"{i:03d}".ljust(path_length, "b") for i in range(vst2_files)],
            "categories": [],
            "diagnostics": [],
        }
        with open(self.inspect, "w", encoding="utf-8") as f:
            json.dump(content, f)

    def verify_pending(self, digest, assets=1, releases=()):
        return {
            "assets": [{
                "assetId": 8001 + i,
                "kind": "archive",
                "downloadUrl": "https://github.com/allegromoltov/audio-fixture-pitchshift/releases/download/v1.1.0/x.zip",
                "digest": digest,
                "repository": "allegromoltov/audio-fixture-pitchshift",
                "repositoryId": 900001,
                "tag": "v1.1.0",
                "commitSha": "3f2a9c1000000000000000000000000000000000",
            } for i in range(assets)],
            "releases": [{
                "releaseId": release_id,
                "repository": "allegromoltov/audio-fixture-pitchshift",
                "commitSha": "3f2a9c1000000000000000000000000000000000",
            } for release_id in releases],
        }

    # --- ステップの実行 ---

    def workspace(self, name, scripts=False):
        """job ごとの作業ディレクトリ。checkout する job だけ、スクリプトを写した場所にする。"""
        path = os.path.join(self.root, f"workspace-{name}")
        os.makedirs(path)
        if scripts:
            shutil.copytree(HERE, os.path.join(path, ".github", "scripts"),
                            ignore=shutil.ignore_patterns("__pycache__"))
        return path

    def exec_step(self, workflow, name, job, pending_path, asset, id_token, extra_env=None, scripts=False):
        """name のステップを bash で 1 回走らせ、終了コードを確かめずに結果を返す。"""
        runner = os.path.join(self.root, f"runner-{job}")
        os.makedirs(runner, exist_ok=True)
        script = os.path.join(self.root, f"step-{job}.sh")
        with open(script, "w", encoding="utf-8", newline="\n") as f:
            f.write(step_script(workflow, name))
        env = dict(os.environ)
        for key in ("ACTIONS_ID_TOKEN_REQUEST_URL", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"):
            env.pop(key, None)
        env.update({
            "PATH": self.stubs + os.pathsep + env.get("PATH", ""),
            "RUNNER_TEMP": slash(runner),
            "GITHUB_OUTPUT": slash(os.path.join(self.root, f"output-{job}.txt")),
            "SOKO_KUN_ORIGIN": "https://soko-kun.invalid",
            "GH_TOKEN": "gh-token",
            "MAX_DOWNLOAD_BYTES": "2147483648",
            "MIN_FREE_BYTES": "1",
            "FETCH_DEADLINE_SECONDS": "1500",
            "STUB_LOG": slash(self.log),
            "STUB_PENDING": slash(pending_path),
            "STUB_POSTED": slash(os.path.join(self.root, "posted.json")),
            "STUB_ASSET": slash(asset or ""),
            "STUB_SCAN_DIR": slash(self.scan_dir),
            "STUB_INSPECT": slash(self.inspect),
        })
        if id_token:
            env["ACTIONS_ID_TOKEN_REQUEST_URL"] = "https://token.invalid/?api-version=2.0"
            env["ACTIONS_ID_TOKEN_REQUEST_TOKEN"] = "request-token"
        env.update(extra_env or {})
        cwd = self.workspace(job, scripts=scripts)
        return subprocess.run([BASH, slash(script)], cwd=cwd, env=env, capture_output=True, text=True, encoding="utf-8")

    def ok(self, proc):
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        return proc

    def pipeline(self, kind, pending, asset, min_free="1"):
        """prepare → scan (judge) → report を順に走らせ、report が Worker へ送った本文を返す。送らなかった回は None を返す。"""
        cfg = PIPELINES[kind]
        pending_path = os.path.join(self.root, "pending-input.json")
        with open(pending_path, "w", encoding="utf-8") as f:
            json.dump(pending, f)
        posted = os.path.join(self.root, "posted.json")
        extra = {"MIN_FREE_BYTES": min_free}

        self.ok(self.exec_step(cfg["workflow"], cfg["prepare"], "prepare", pending_path, asset, True, extra))
        if read_outputs(os.path.join(self.root, "output-prepare.txt")).get("has_work") != "true":
            return None
        # artifact の受け渡し。scan が受け取るのは、prepare が書いたファイルの複製だけにする。
        shutil.copytree(os.path.join(self.root, "runner-prepare", "pending"),
                        os.path.join(self.root, "runner-scan", "pending"))

        self.ok(self.exec_step(cfg["workflow"], CONFIRM_STEP, "confirm", pending_path, asset, False, extra))
        self.ok(self.exec_step(cfg["workflow"], cfg["scan"], "scan", pending_path, asset, False, extra, scripts=True))
        outputs = read_outputs(os.path.join(self.root, "output-scan.txt"))
        if kind == "verify":
            body_env = {f"BODY_{k}": outputs.get(f"body_{k}", "") for k in range(8)}
        else:
            body_env = {"BODY": outputs.get("body", "")}
        self.ok(self.exec_step(cfg["workflow"], cfg["report"], "report", pending_path, asset, True, body_env))
        if not os.path.exists(posted):
            return None
        with open(posted, "rb") as f:
            return f.read()

    def calls(self, command):
        """スタブの command が受け取った引数を、呼ばれた順に返す。"""
        result = []
        for name in sorted(os.listdir(self.log)):
            if name.split("-", 1)[1] == command:
                with open(os.path.join(self.log, name), "rb") as f:
                    result.append(f.read().decode("utf-8").split("\0")[:-1])
        return result

    # --- verify.yaml ---

    def test_w07_digest_mismatch_writes_failed_without_verifying_or_inspecting(self):
        path, _ = self.zip_with(["Fixture.vst3/Contents/x86_64-win/Fixture.vst3"])
        body = json.loads(self.pipeline("verify", self.verify_pending("sha256:" + "0" * 64), path))
        result = body["results"][0]
        self.assertEqual(result["attestation"], {"result": "failed", "reason": "digest_mismatch"})
        # 中身の検査のスクリプトも digest を照合し、中身を読まずに error の digest_mismatch を返す (test_inspect_archive.py の W07)。
        self.assertEqual((result["content"]["result"], result["content"]["reason"]), ("error", "digest_mismatch"))
        self.assertEqual(self.calls("gh"), [])

    def test_w07_control_matching_digest_is_verified(self):
        path, digest = self.zip_with(["Fixture.vst3/Contents/x86_64-win/Fixture.vst3"])
        body = json.loads(self.pipeline("verify", self.verify_pending(digest), path))
        result = body["results"][0]
        # gh のスタブは検証を失敗させる。digest が一致すれば証明の検証へ進む。
        self.assertEqual(result["attestation"], {"result": "failed", "reason": "verification_failed"})
        self.assertNotEqual(result["content"].get("reason"), "digest_mismatch")
        self.assertEqual(len(self.calls("gh")), 1)

    def test_w07_hit_file_names_are_normalized_before_sending(self):
        """改行・CR を含む名前と長い名前の当たりを、受け口が捨てない形に整えて送る (jtl.52)。"""
        path, digest = self.zip_with(["Fixture.vst3/Contents/x86_64-win/Fixture.vst3"])
        names = ["src/a\nb.cpp", "src/c\rd.cpp", "src/" + "x" * 150 + ".cpp", "src/" + "あ" * 100, "src/plain.cpp"]
        hits = [{"file": name, "line": 1, "api": "socket", "text": "socket("} for name in names]
        self.write_scan("501", hits, doc_hits=[{"file": name, "line": 2, "item": "x", "text": "t"} for name in names])
        body = json.loads(self.pipeline("verify", self.verify_pending(digest, releases=[501]), path))
        scan = body["networkScans"][0]
        self.assertEqual(scan["result"], "done")
        expected = [expected_file(name) for name in names]
        self.assertEqual([hit["file"] for hit in scan["hits"]], expected)
        self.assertEqual([hit["file"] for hit in scan["docHits"]], expected)
        for name in expected:
            # 受け口は UTF-16 の単位で数える。
            self.assertRegex(name, FILE_NAME)
            self.assertLessEqual(len(name.encode("utf-16-le")) // 2, 200)

    def test_w07_content_over_128kib_does_not_break_jq(self):
        """中身の検査の結果が環境変数 1 つの上限 (128 KiB) を超えても、結果を送れる (jtl.53)。"""
        path, digest = self.zip_with(["Fixture.vst3/Contents/x86_64-win/Fixture.vst3"])
        self.write_inspect()
        self.assertGreater(os.path.getsize(self.inspect), 128 * 1024)
        raw = self.pipeline("verify", self.verify_pending(digest), path)
        self.assertLessEqual(len(raw), BODY_LIMIT)
        content = json.loads(raw)["results"][0]["content"]
        self.assertEqual(len(content["bundles"]), 200)
        self.assertEqual(len(content["vst2Files"]), 100)

    def test_w07_oversized_results_replace_scans_before_content(self):
        """結果が 800,000 バイトを超えるとき、まず本文の大きい版の通信の検出を error にして、上限に収めて送る。"""
        path, digest = self.zip_with(["Fixture.vst3/Contents/x86_64-win/Fixture.vst3"])
        self.write_inspect()
        big = [{"file": f"src/{i}.cpp", "line": 1, "api": "socket", "text": "t" * 200} for i in range(1200)]
        self.write_scan("501", big[:300])
        self.write_scan("502", big)
        raw = self.pipeline("verify", self.verify_pending(digest, assets=2, releases=[501, 502]), path)
        self.assertLessEqual(len(raw), BODY_LIMIT)
        body = json.loads(raw)
        scans = {scan["releaseId"]: scan for scan in body["networkScans"]}
        self.assertEqual(scans[502], {"releaseId": 502, "result": "error"})
        self.assertEqual(scans[501]["result"], "done")
        # 通信の検出の置き換えで収まるため、中身の検査の結果は残る。
        self.assertEqual([len(item["content"]["bundles"]) for item in body["results"]], [200, 200])

    def test_w07_oversized_results_replace_content_when_scans_are_not_enough(self):
        """通信の検出を置き換えても超えるとき、本文の大きい配布物の中身の検査を error にして、上限に収めて送る。"""
        path, digest = self.zip_with(["Fixture.vst3/Contents/x86_64-win/Fixture.vst3"])
        self.write_inspect()
        raw = self.pipeline("verify", self.verify_pending(digest, assets=3), path)
        self.assertLessEqual(len(raw), BODY_LIMIT)
        contents = [item["content"] for item in json.loads(raw)["results"]]
        replaced = [content for content in contents if content.get("bundles") is None]
        # 受け口が受け付ける error の理由 (src/checks/route.ts の REASON) にする。
        self.assertEqual(replaced, [{"result": "error", "reason": "result_too_large"}])
        self.assertEqual(len(contents) - len(replaced), 2)

    def test_w07_low_free_space_posts_nothing(self):
        path, digest = self.zip_with(["Fixture.vst3/Contents/x86_64-win/Fixture.vst3"])
        self.assertIsNone(self.pipeline("verify", self.verify_pending(digest), path, min_free=str(10**17)))
        self.assertEqual(self.calls("gh"), [])

    def test_w07_nothing_pending_does_not_start_the_scan(self):
        self.assertIsNone(self.pipeline("verify", {"assets": [], "releases": []}, None))
        self.assertFalse(os.path.exists(os.path.join(self.root, "runner-scan")))

    # --- macos-verify.yaml ---

    def test_m08_bundle_paths_with_symbols_reach_codesign_and_spctl_as_one_argument(self):
        bundles = [
            "Fixture $(touch PWNED) Synth.vst3",
            "it's `touch PWNED2`; echo \"x\" & * -rf.clap",
        ]
        path, digest = self.zip_with([f"{b}/Contents/Info.plist" for b in bundles])
        pending = {"assets": [{
            "assetId": 8001,
            "downloadUrl": "https://github.com/allegromoltov/audio-fixture-pitchshift/releases/download/v1.1.0/x.zip",
            "digest": digest,
            "repository": "allegromoltov/audio-fixture-pitchshift",
            "tag": "v1.1.0",
            "bundles": bundles,
        }]}
        body = json.loads(self.pipeline("macos", pending, path))
        targets = [f"{slash(self.root)}/runner-scan/macos-verify/asset-8001/x/{b}" for b in bundles]
        self.assertEqual(self.calls("codesign"), [
            ["-dv", "--verbose=4", targets[0]],
            ["--verify", "--deep", "--strict", targets[0]],
            ["-dv", "--verbose=4", targets[1]],
            ["--verify", "--deep", "--strict", targets[1]],
        ])
        self.assertEqual(self.calls("spctl"), [["--assess", "-vvv", "--type", "install", t] for t in targets])
        # パスの中のコマンドは実行されない。ワークフローは checkout の直下で動く。
        self.assertEqual({"PWNED", "PWNED2"} & set(os.listdir(os.path.join(self.root, "workspace-scan"))), set())
        self.assertEqual(body, {"results": [{"assetId": 8001, "result": "passed", "reason": None,
                                             "teamIds": ["ABCDE12345"]}]})

    def test_m08_low_free_space_posts_nothing(self):
        path, digest = self.zip_with(["Fixture.vst3/Contents/Info.plist"])
        pending = {"assets": [{"assetId": 8001, "downloadUrl": "https://github.com/x/y/a.zip", "digest": digest,
                               "repository": "x/y", "tag": "v1", "bundles": ["Fixture.vst3"]}]}
        self.assertIsNone(self.pipeline("macos", pending, path, min_free=str(10**17)))
        self.assertEqual(self.calls("codesign"), [])

    # --- 両方 ---

    def test_scan_and_judge_fail_when_id_token_variables_exist(self):
        """権限の付け間違いで第三者のデータを処理する job が OIDC のトークンを取れる状態なら、最初のステップで失敗する。"""
        for kind in ("verify", "macos"):
            workflow = PIPELINES[kind]["workflow"]
            with self.subTest(workflow=workflow):
                pending_path = os.path.join(self.root, "unused.json")
                for id_token, expected in ((False, 0), (True, 1)):
                    proc = self.exec_step(workflow, CONFIRM_STEP, f"{kind}-{id_token}", pending_path, None, id_token)
                    self.assertEqual(proc.returncode, expected, proc.stdout + proc.stderr)


if __name__ == "__main__":
    unittest.main()
