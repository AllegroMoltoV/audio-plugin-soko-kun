"""検証のワークフローのステップのテスト (docs/design/testing.md の W07・M08)。

使い方: python3 -I -B -m unittest discover -s .github/scripts -p "test_*.py"
verify.yaml と macos-verify.yaml のステップの run の本文を取り出し、外部のコマンド (curl・gh・codesign・spctl など) を
引数を記録するだけのスタブに差し替えて bash で走らせる。Worker へ送る結果は、curl のスタブが受け取った本文で確かめる。
bash と jq が無い環境では飛ばす。
"""

import hashlib
import json
import os
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


# 呼ばれた引数を 1 回ごとのファイルに NUL 区切りで記録する。ファイル名の連番で呼ばれた順を残す。
LOG_ARGS = 'n=$(ls "${STUB_LOG}" | wc -l); printf \'%s\\0\' "$@" > "${STUB_LOG}/$(printf %04d "${n}")-$(basename "$0")"\n'

STUBS = {
    "curl": """
out=""; data=""; url=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    --data) data="$2"; shift 2 ;;
    -H|-X|--max-filesize) shift 2 ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done
case "${url}" in
  *audience=*) echo '{"value":"oidc-token"}' ;;
  */pending) cat "${STUB_PENDING}" ;;
  */results) cp "${data#@}" "${STUB_POSTED}" ;;
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
        self.runner_temp = os.path.join(self.root, "runner")
        # ワークフローは checkout したリポジトリの直下で動き、pending.json などをそこへ書く。スクリプトだけを写した場所で走らせる。
        self.checkout = os.path.join(self.root, "checkout")
        for path in (self.stubs, self.log, self.runner_temp):
            os.makedirs(path)
        shutil.copytree(HERE, os.path.join(self.checkout, ".github", "scripts"),
                        ignore=shutil.ignore_patterns("__pycache__"))
        stubs = dict(STUBS)
        stubs["python3"] = f'exec "{slash(sys.executable)}" -X utf8 "$@"\n'
        if os.name == "nt":
            # Windows の jq.exe は改行を CRLF で出し、read で読んだバンドルのパスの末尾に CR が残る。macOS のランナーには無い差のため、
            # --binary で LF に揃える。
            stubs["jq"] = f'exec "{slash(shutil.which("jq"))}" --binary "$@"\n'
        for name, body in stubs.items():
            with open(os.path.join(self.stubs, name), "w", encoding="utf-8", newline="\n") as f:
                f.write("#!/usr/bin/env bash\n" + body)
            os.chmod(os.path.join(self.stubs, name), 0o755)

    def zip_with(self, names):
        path = os.path.join(self.root, "asset.zip")
        with zipfile.ZipFile(path, "w") as z:
            for name in names:
                z.writestr(name, b"x")
        with open(path, "rb") as f:
            return path, "sha256:" + hashlib.sha256(f.read()).hexdigest()

    def run_step(self, workflow, name, pending, asset):
        pending_path = os.path.join(self.root, "pending-input.json")
        with open(pending_path, "w", encoding="utf-8") as f:
            json.dump(pending, f)
        posted = os.path.join(self.root, "posted.json")
        script = os.path.join(self.root, "step.sh")
        with open(script, "w", encoding="utf-8", newline="\n") as f:
            f.write(step_script(workflow, name))
        env = dict(os.environ)
        env.update({
            "PATH": self.stubs + os.pathsep + env.get("PATH", ""),
            "RUNNER_TEMP": slash(self.runner_temp),
            "SOKO_KUN_ORIGIN": "https://soko-kun.invalid",
            "ACTIONS_ID_TOKEN_REQUEST_URL": "https://token.invalid/?api-version=2.0",
            "ACTIONS_ID_TOKEN_REQUEST_TOKEN": "request-token",
            "GH_TOKEN": "gh-token",
            "MAX_DOWNLOAD_BYTES": "2147483648",
            "MIN_FREE_BYTES": "1",
            "FETCH_DEADLINE_SECONDS": "1500",
            "STUB_LOG": slash(self.log),
            "STUB_PENDING": slash(pending_path),
            "STUB_POSTED": slash(posted),
            "STUB_ASSET": slash(asset),
        })
        out = subprocess.run([BASH, slash(script)], cwd=self.checkout, env=env, capture_output=True, text=True,
                             encoding="utf-8")
        self.assertEqual(out.returncode, 0, out.stdout + out.stderr)
        with open(posted, encoding="utf-8") as f:
            return json.load(f)

    def calls(self, command):
        """スタブの command が受け取った引数を、呼ばれた順に返す。"""
        result = []
        for name in sorted(os.listdir(self.log)):
            if name.split("-", 1)[1] == command:
                with open(os.path.join(self.log, name), "rb") as f:
                    result.append(f.read().decode("utf-8").split("\0")[:-1])
        return result

    def verify_pending(self, digest):
        return {
            "assets": [{
                "assetId": 8001,
                "kind": "archive",
                "downloadUrl": "https://github.com/allegromoltov/audio-fixture-pitchshift/releases/download/v1.1.0/x.zip",
                "digest": digest,
                "repository": "allegromoltov/audio-fixture-pitchshift",
                "repositoryId": 900001,
                "tag": "v1.1.0",
                "commitSha": "3f2a9c1000000000000000000000000000000000",
            }],
            "releases": [],
        }

    def test_w07_digest_mismatch_writes_failed_without_verifying_or_inspecting(self):
        path, _ = self.zip_with(["Fixture.vst3/Contents/x86_64-win/Fixture.vst3"])
        body = self.run_step("verify.yaml", "Verify pending release files",
                             self.verify_pending("sha256:" + "0" * 64), path)
        result = body["results"][0]
        self.assertEqual(result["attestation"], {"result": "failed", "reason": "digest_mismatch"})
        # 中身の検査のスクリプトも digest を照合し、中身を読まずに error の digest_mismatch を返す (test_inspect_archive.py の W07)。
        self.assertEqual((result["content"]["result"], result["content"]["reason"]), ("error", "digest_mismatch"))
        self.assertEqual(self.calls("gh"), [])

    def test_w07_control_matching_digest_is_verified(self):
        path, digest = self.zip_with(["Fixture.vst3/Contents/x86_64-win/Fixture.vst3"])
        body = self.run_step("verify.yaml", "Verify pending release files", self.verify_pending(digest), path)
        result = body["results"][0]
        # gh のスタブは検証を失敗させる。digest が一致すれば証明の検証へ進む。
        self.assertEqual(result["attestation"], {"result": "failed", "reason": "verification_failed"})
        self.assertNotEqual(result["content"].get("reason"), "digest_mismatch")
        self.assertEqual(len(self.calls("gh")), 1)

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
        body = self.run_step("macos-verify.yaml", "Judge pending macOS bundles", pending, path)
        targets = [f"{slash(self.runner_temp)}/macos-verify/asset-8001/x/{b}" for b in bundles]
        self.assertEqual(self.calls("codesign"), [
            ["-dv", "--verbose=4", targets[0]],
            ["--verify", "--deep", "--strict", targets[0]],
            ["-dv", "--verbose=4", targets[1]],
            ["--verify", "--deep", "--strict", targets[1]],
        ])
        self.assertEqual(self.calls("spctl"), [["--assess", "-vvv", "--type", "install", t] for t in targets])
        # パスの中のコマンドは実行されない。ワークフローは checkout の直下で動く。
        self.assertEqual({"PWNED", "PWNED2"} & set(os.listdir(self.checkout)), set())
        self.assertEqual(body, {"results": [{"assetId": 8001, "result": "passed", "reason": None,
                                             "teamIds": ["ABCDE12345"]}]})


if __name__ == "__main__":
    unittest.main()
