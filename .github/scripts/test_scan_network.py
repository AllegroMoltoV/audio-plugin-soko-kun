"""通信の検出のスクリプト scan-network.sh のテスト (docs/design/scanning.md の「通信の検出」)。

使い方: python3 -I -B -m unittest discover -s .github/scripts -p "test_*.py"
テストの中で作った小さなソースのディレクトリに当てる。bash と jq が無い環境では飛ばす。
"""

import json
import os
import shutil
import subprocess
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "scan-network.sh")
# Windows の CreateProcess は PATH より先に System32 の bash (WSL) を探すため、PATH で見つけたものを渡す。
BASH = shutil.which("bash")
NETWORK_TS = os.path.join(os.path.dirname(os.path.dirname(HERE)), "src", "review", "network.ts")


def write(root: str, path: str, text: str) -> None:
    full = os.path.join(root, *path.split("/"))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)


@unittest.skipUnless(BASH and shutil.which("jq"), "bash と jq が要る")
class ScanNetworkTest(unittest.TestCase):
    def scan(self, files: dict) -> dict:
        with tempfile.TemporaryDirectory() as root:
            for path, text in files.items():
                write(root, path, text)
            # Windows の Git Bash でも読めるよう、スクリプトのパスは / で区切り、ソースは作業ディレクトリからの相対で渡す。
            out = subprocess.run(
                [BASH, SCRIPT.replace(os.sep, "/"), "."],
                cwd=root,
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
            )
        return json.loads(out.stdout)

    def apis(self, files: dict) -> list:
        return [(hit["file"], hit["line"], hit["api"]) for hit in self.scan(files)["hits"]]

    def test_juce_network_calls_are_found(self):
        hits = self.apis(
            {
                "Source/Update.cpp": "\n".join(
                    [
                        "auto stream = url.createInputStream(juce::URL::InputStreamOptions(juce::URL::ParameterHandling::inAddress));",
                        "juce::StreamingSocket socket;",
                        "auto text = url.readEntireTextStream();",
                    ]
                ),
            }
        )
        self.assertEqual(
            hits,
            [
                ("Source/Update.cpp", 1, "juce-network"),
                ("Source/Update.cpp", 2, "juce-network"),
                ("Source/Update.cpp", 3, "juce-network"),
            ],
        )

    # ブラウザーで開くだけの juce::URL と、ローカルのファイルの createInputStream は通信ではない。
    def test_juce_browser_and_local_file_are_not_network(self):
        hits = self.apis(
            {
                "Source/Editor.cpp": "\n".join(
                    [
                        'juce::URL("https://example.com/manual").launchInDefaultBrowser();',
                        "auto in = presetFile.createInputStream();",
                    ]
                ),
            }
        )
        self.assertEqual(hits, [])

    def test_vendored_juce_core_and_build_outputs_are_skipped(self):
        hits = self.apis(
            {
                "JUCE/modules/juce_core/network/juce_WebInputStream.cpp": "WebInputStream::WebInputStream() {}",
                "build/generated.cpp": "curl_easy_init();",
                "target/debug/build.rs": "reqwest::get(url);",
                "src/lib.rs": "let body = reqwest::blocking::get(url)?;",
            }
        )
        self.assertEqual(hits, [("src/lib.rs", 1, "rust-http")])

    def test_hits_are_capped_at_50(self):
        result = self.scan({"src/many.c": "\n".join(["curl_easy_init();"] * 60)})
        self.assertEqual(len(result["hits"]), 50)
        self.assertTrue(result["truncated"])

    # 受け口は知らない名前の当たりを捨てるため、スクリプトのパターンの名前は network.ts の一覧と一致しなければならない。
    def test_pattern_names_match_network_ts(self):
        with open(SCRIPT, encoding="utf-8") as handle:
            script = handle.read()
        block = script.split("patterns=(", 1)[1].split("\n)", 1)[0]
        names = [line.strip().strip("'").split("|", 1)[0] for line in block.strip().splitlines()]
        with open(NETWORK_TS, encoding="utf-8") as handle:
            source = handle.read()
        listed = source.split("export const NETWORK_APIS = [", 1)[1].split("]", 1)[0]
        expected = [item.strip().strip("'") for item in listed.split(",") if item.strip()]
        self.assertEqual(names, expected)


if __name__ == "__main__":
    unittest.main()
