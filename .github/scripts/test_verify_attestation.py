"""証明の検証のスクリプト verify-attestation.sh のテスト (docs/design/testing.md の W19)。

使い方: python3 -I -B -m unittest discover -s .github/scripts -p "test_*.py"
終了コードと標準エラーを返す偽の gh を PATH の先頭に置き、一時的な失敗と本物の失敗の分類と、名前の集約を確かめる。
bash と jq が無い環境では飛ばす。
"""

import json
import os
import shutil
import subprocess
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "verify-attestation.sh")
# Windows の CreateProcess は PATH より先に System32 の bash (WSL) を探すため、PATH で見つけたものを渡す。
BASH = shutil.which("bash")

# リポジトリの名前ごとに、$FAKE/<download|verify>/<owner_repo>.code と .err で終了コードと標準エラーを決める。
# 呼び出しの引数は $FAKE/calls に 1 行ずつ残す。download が成功したら、gh と同じく作業ディレクトリに <digest>.jsonl を書く。
FAKE_GH = r"""#!/usr/bin/env bash
set -euo pipefail
echo "$*" >> "${FAKE}/calls"
sub="$2"
repo=""
prev=""
for a in "$@"; do
  if [ "${prev}" = "--repo" ]; then repo="${a}"; fi
  prev="${a}"
done
key="${FAKE}/${sub}/${repo//\//_}"
code=$(cat "${key}.code" 2>/dev/null || echo 0)
if [ -f "${key}.err" ]; then cat "${key}.err" >&2; fi
if [ "${code}" -ne 0 ]; then exit "${code}"; fi
if [ "${sub}" = "download" ] && [ ! -f "${key}.nobundle" ]; then
  echo '{"bundle":1}' > 'sha256-0000.jsonl'
fi
if [ "${sub}" = "verify" ]; then
  echo '[{"verificationResult":{"signature":{"certificate":{"sourceRepositoryIdentifier":"42","buildSignerURI":"https://github.com/o/r/.github/workflows/release.yml@refs/tags/v1.0.0"}}}}]'
fi
"""

PASSED = {"result": "passed", "signerWorkflow": ".github/workflows/release.yml"}
NOT_FOUND = "Error: failed to fetch attestations: HTTP 404: Not Found (https://api.github.com/repos/o/r/attestations/sha256:0)"
# 不変のリリースにはリリースの証明が付くため、ビルドの証明が無くても API は 200 を返し、gh の絞り込みで 0 件になる。
NO_SLSA = "failed to filter attestations: no attestations found with predicate type: https://slsa.dev/provenance/v1"


def slash(path: str) -> str:
    # Windows の Git Bash でも読めるよう、パスは / で区切る。
    return path.replace(os.sep, "/")


@unittest.skipUnless(BASH and shutil.which("jq"), "bash と jq が要る")
class VerifyAttestationTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = tmp.name
        self.fake = os.path.join(self.root, "fake")
        bin_dir = os.path.join(self.root, "bin")
        os.makedirs(bin_dir)
        with open(os.path.join(bin_dir, "gh"), "w", encoding="utf-8", newline="\n") as f:
            f.write(FAKE_GH)
        os.chmod(os.path.join(bin_dir, "gh"), 0o755)
        if os.name == "nt":
            # Windows の jq.exe は改行を CRLF で出すため、--binary で LF に揃える (ほかのテストと同じ)。
            with open(os.path.join(bin_dir, "jq"), "w", encoding="utf-8", newline="\n") as f:
                f.write(f'#!/usr/bin/env bash\nexec "{slash(shutil.which("jq"))}" --binary "$@"\n')
            os.chmod(os.path.join(bin_dir, "jq"), 0o755)
        self.env = dict(os.environ)
        self.env["PATH"] = slash(bin_dir) + os.pathsep + self.env.get("PATH", "")
        self.env["FAKE"] = slash(self.fake)
        self.asset = os.path.join(self.root, "asset")
        with open(self.asset, "w", encoding="utf-8") as f:
            f.write("asset\n")
        self.trusted_root = os.path.join(self.root, "trusted_root.jsonl")
        with open(self.trusted_root, "w", encoding="utf-8") as f:
            f.write('{"root":1}\n')
        self.setup_fake()

    def setup_fake(self, *specs):
        """場面を初期化する。specs は (download か verify, owner_repo, 終了コード, 標準エラー) の並び。"""
        shutil.rmtree(self.fake, ignore_errors=True)
        os.makedirs(os.path.join(self.fake, "download"))
        os.makedirs(os.path.join(self.fake, "verify"))
        open(os.path.join(self.fake, "calls"), "w").close()
        for sub, repo, code, err in specs:
            with open(os.path.join(self.fake, sub, f"{repo}.code"), "w") as f:
                f.write(f"{code}\n")
            with open(os.path.join(self.fake, sub, f"{repo}.err"), "w") as f:
                f.write(err + "\n")

    def calls(self):
        with open(os.path.join(self.fake, "calls"), encoding="utf-8") as f:
            return f.read().splitlines()

    def run_script(self, repository_id, *names, trusted_root=None):
        proc = subprocess.run(
            [BASH, slash(SCRIPT), slash(self.asset), slash(trusted_root or self.trusted_root), "v1.0.0", "abc123", "",
             repository_id, *names],
            env=self.env, capture_output=True, text=True, encoding="utf-8",
        )
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        return json.loads(proc.stdout)

    def test_success_verifies_the_downloaded_bundle_offline_with_the_trusted_root(self):
        self.assertEqual(self.run_script("42", "o/r"), PASSED)
        verify = [call for call in self.calls() if call.startswith("attestation verify")]
        self.assertEqual(len(verify), 1)
        self.assertRegex(verify[0], r"--bundle .*sha256-0000\.jsonl --custom-trusted-root " + self.trusted_root.replace("\\", "/"))

    def test_download_404_is_no_attestation_and_does_not_verify(self):
        self.setup_fake(("download", "o_r", 1, NOT_FOUND))
        self.assertEqual(self.run_script("42", "o/r"), {"result": "failed", "reason": "no_attestation"})
        self.assertFalse([call for call in self.calls() if call.startswith("attestation verify")])

    def test_download_200_without_slsa_provenance_is_no_attestation(self):
        self.setup_fake(("download", "o_r", 1, NO_SLSA))
        self.assertEqual(self.run_script("42", "o/r"), {"result": "failed", "reason": "no_attestation"})

    def test_download_5xx_is_transient(self):
        self.setup_fake(("download", "o_r", 1, "Error: failed to fetch attestations: HTTP 502: Bad Gateway"))
        self.assertEqual(self.run_script("42", "o/r"), {"result": "error", "reason": "attestation_fetch_failed"})

    def test_download_network_failure_is_transient(self):
        self.setup_fake(("download", "o_r", 1, 'Error: Get "https://api.github.com/": dial tcp: i/o timeout'))
        self.assertEqual(self.run_script("42", "o/r"), {"result": "error", "reason": "attestation_fetch_failed"})

    def test_download_without_a_bundle_file_is_transient(self):
        self.setup_fake()
        open(os.path.join(self.fake, "download", "o_r.nobundle"), "w").close()
        self.assertEqual(self.run_script("42", "o/r"), {"result": "error", "reason": "attestation_fetch_failed"})

    def test_verify_failure_is_verification_failed(self):
        self.setup_fake(("verify", "o_r", 1, "Error: expected SourceRepositoryRef to be refs/tags/v1.0.0"))
        self.assertEqual(self.run_script("42", "o/r"), {"result": "failed", "reason": "verification_failed"})

    def test_repository_id_mismatch_is_genuine(self):
        self.assertEqual(self.run_script("7", "o/r"), {"result": "failed", "reason": "repository_id_mismatch"})

    def test_old_name_passes(self):
        self.setup_fake(("download", "o_new", 1, "HTTP 404: Not Found"))
        self.assertEqual(self.run_script("42", "o/new", "o/r"), PASSED)

    def test_transient_and_genuine_failures_mixed_is_error(self):
        self.setup_fake(("download", "o_new", 1, "HTTP 503: Service Unavailable"), ("download", "o_r", 1, "HTTP 404: Not Found"))
        self.assertEqual(self.run_script("42", "o/new", "o/r"), {"result": "error", "reason": "attestation_fetch_failed"})

    def test_only_genuine_failures_use_the_last_genuine_reason(self):
        self.setup_fake(("verify", "o_new", 1, 'Error: verifying with issuer "sigstore.dev"'), ("download", "o_r", 1, "HTTP 404: Not Found"))
        self.assertEqual(self.run_script("42", "o/new", "o/r"), {"result": "failed", "reason": "no_attestation"})

    def test_missing_trusted_root_does_not_call_gh(self):
        self.setup_fake()
        result = self.run_script("42", "o/r", trusted_root=os.path.join(self.root, "missing.jsonl"))
        self.assertEqual(result, {"result": "error", "reason": "trust_root_unavailable"})
        self.assertEqual(self.calls(), [])


if __name__ == "__main__":
    unittest.main()
