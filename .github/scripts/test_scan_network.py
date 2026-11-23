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
                if isinstance(text, bytes):
                    full = os.path.join(root, *path.split("/"))
                    os.makedirs(os.path.dirname(full), exist_ok=True)
                    with open(full, "wb") as handle:
                        handle.write(text)
                else:
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

    # JUCE を同梱した作者で JUCE 自身の通信の実装に当たらないよう、JUCE の配置 (modules/juce_core/) だけを捨てる。
    # 取得するのはコミット済みのファイルだけのため、build や target の配下も探す。
    def test_vendored_juce_core_is_skipped_but_build_outputs_are_scanned(self):
        hits = self.apis(
            {
                "JUCE/modules/juce_core/network/juce_WebInputStream.cpp": "WebInputStream::WebInputStream() {}",
                "modules/juce_core/network/juce_Socket.cpp": "StreamingSocket::StreamingSocket() {}",
                "build/generated.cpp": "curl_easy_init();",
                "target/debug/build.rs": "reqwest::get(url);",
                "src/lib.rs": "let body = reqwest::blocking::get(url)?;",
            }
        )
        self.assertEqual(
            sorted(hits),
            [("build/generated.cpp", 1, "libcurl"), ("src/lib.rs", 1, "rust-http"), ("target/debug/build.rs", 1, "rust-http")],
        )

    # 名前だけ juce_core のディレクトリは JUCE の配置ではないため探す。
    def test_directory_merely_named_juce_core_is_scanned(self):
        hits = self.apis(
            {
                "mymodules/juce_core/net.cpp": "curl_easy_init();",
                "juce_core/net.cpp": "curl_easy_init();",
            }
        )
        self.assertEqual(sorted(hits), [("juce_core/net.cpp", 1, "libcurl"), ("mymodules/juce_core/net.cpp", 1, "libcurl")])

    # C のプリプロセッサは拡張子に関係なく #include で取り込むため、拡張子で絞らない。大文字の拡張子も探す。
    def test_any_extension_and_uppercase_extension_are_scanned(self):
        hits = self.apis(
            {
                "src/net.inc": "curl_easy_init();",
                "src/NET.CPP": "curl_easy_init();",
                "src/notes.md": "We call curl_easy_init() to download presets.",
            }
        )
        self.assertEqual(
            sorted(hits), [("src/NET.CPP", 1, "libcurl"), ("src/net.inc", 1, "libcurl"), ("src/notes.md", 1, "libcurl")]
        )

    # UTF-8 として読めない文字 (cp1252 のコメント) を含む行も当てる。NUL を含むバイナリは読まない。
    def test_non_utf8_lines_are_scanned_and_binaries_are_not(self):
        hits = self.apis(
            {
                "src/legacy.cpp": b"// caf\xe9\ncurl_easy_init(); // \xe9t\xe9\n",
                "bin/blob.dat": b"\x00\x01curl_easy_init\x00",
            }
        )
        self.assertEqual(hits, [("src/legacy.cpp", 2, "libcurl")])

    # ファイル名の : で file と行番号の分け方を作者に決めさせないため、: を含む名前でも当たりをファイル名のまま返す。
    # Windows はファイル名に : を使えないため飛ばす。
    @unittest.skipIf(os.name == "nt", "Windows はファイル名に : を使えない")
    def test_file_name_with_null_between_colons_is_scanned(self):
        hits = self.apis({"a:null:b.cpp": "int x;\ncurl_easy_init();"})
        self.assertEqual(hits, [("a:null:b.cpp", 2, "libcurl")])

    @unittest.skipIf(os.name == "nt", "Windows はファイル名に : を使えない")
    def test_file_name_with_non_numeric_between_colons_is_scanned(self):
        hits = self.apis({"a:x:b.cpp": "int y;\nint z;\ncurl_easy_init();"})
        self.assertEqual(hits, [("a:x:b.cpp", 3, "libcurl")])

    def test_hits_are_capped_at_50(self):
        result = self.scan({"src/many.c": "\n".join(["curl_easy_init();"] * 60)})
        self.assertEqual(len(result["hits"]), 50)
        self.assertTrue(result["truncated"])

    def run_script(self, source: str) -> dict:
        out = subprocess.run(
            [BASH, SCRIPT.replace(os.sep, "/"), source],
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        return json.loads(out.stdout)

    # 候補のパスの合計が引数の上限 (ARG_MAX) を超える場面。候補を grep のコマンドラインに並べると grep を起動できず、
    # 当たり 0 件として通信の検出を逃れられる。約 3,700 バイトのパスのファイルを、合計が ARG_MAX を超える数だけ置く。
    # ARG_MAX は環境で変わるため、実行する環境の値から数を決める。Windows はこの長さのパスを作れないため飛ばす。
    @unittest.skipIf(os.name == "nt", "Windows は長いパスを作れない")
    def test_candidates_over_arg_max_are_still_scanned(self):
        arg_max = os.sysconf("SC_ARG_MAX")
        count = arg_max // 3700 + 100
        with tempfile.TemporaryDirectory() as root:
            deep = os.path.join(root, "many", *["d" * 250] * 14, "d" * 100)
            os.makedirs(deep)
            for number in range(count):
                with open(os.path.join(deep, f"f{number}.cpp"), "w", encoding="utf-8", newline="\n") as handle:
                    handle.write("// socket (\n")
            write(root, "src/real.cpp", "curl_easy_init();\n")
            result = self.run_script(root)
        real = [(hit["file"], hit["line"], hit["api"]) for hit in result["hits"] if hit["file"].endswith("src/real.cpp")]
        self.assertEqual(real, [("src/real.cpp", 1, "libcurl")])
        self.assertEqual(len(result["hits"]), 50)
        self.assertTrue(result["truncated"])

    # 探すディレクトリからの相対では書き出せるが、絶対パスでは上限 (PATH_MAX、4096 バイト) を超えるファイル。
    # 絶対パスで grep に渡すと開けず、その版の通信の検出が消える。絶対パスでは作れないため、1 段ずつ移りながら作る。
    # 相対は 16 x 251 + 8 = 4,024 バイトで上限より短く、探すディレクトリの名前 (約 100 バイト) を前に付けた絶対パスは上限を超える。
    # 探すディレクトリは "." ではなく絶対パスで渡す。"." では候補が相対パスになり、修正の前でも上限を超えない。
    @unittest.skipIf(os.name == "nt", "Windows は長いパスを作れない")
    def test_file_whose_absolute_path_exceeds_path_max_is_scanned(self):
        with tempfile.TemporaryDirectory() as root:
            source = os.path.join(root, "q" * 100)
            os.mkdir(source)
            descriptor = os.open(source, os.O_RDONLY)
            try:
                for _ in range(16):
                    os.mkdir("p" * 250, dir_fd=descriptor)
                    child = os.open("p" * 250, os.O_RDONLY, dir_fd=descriptor)
                    os.close(descriptor)
                    descriptor = child
                file = os.open("deep.cpp", os.O_WRONLY | os.O_CREAT, 0o644, dir_fd=descriptor)
                with os.fdopen(file, "w", encoding="utf-8", newline="\n") as handle:
                    handle.write("curl_easy_init();\n")
            finally:
                os.close(descriptor)
            result = self.run_script(source)
        hits = [(hit["line"], hit["api"], hit["file"].endswith("/deep.cpp")) for hit in result["hits"]]
        self.assertEqual(hits, [(1, "libcurl", True)])

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
