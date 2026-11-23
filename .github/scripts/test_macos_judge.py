"""macOS の署名と公証の判定のスクリプトのテスト (docs/design/testing.md の M01〜M10)。

使い方: python3 -I -B -m unittest discover -s .github/scripts -p "test_*.py"
判定は、検証 A2 と V2 で macOS のランナーが出した codesign と spctl の出力を入力にして確かめる。
fixtures/macos_a2_v2_samples.json は、その出力から判定に使う行を抜き出し、作者の名前とメールアドレスを伏せたもの。
手元の .tmp/ に元の出力があるときは、元の出力でも突き合わせる。
"""

import importlib.util
import json
import os
import re
import stat
import tempfile
import unittest
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))

_spec = importlib.util.spec_from_file_location("macos_judge", os.path.join(HERE, "macos_judge.py"))
mj = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mj)

with open(os.path.join(HERE, "fixtures", "macos_a2_v2_samples.json"), encoding="utf-8") as _f:
    SAMPLES = json.load(_f)

# 標本の期待 (ワークフローの見出しの expected) と、規則による判定。
EXPECTED = {
    "developer-id-notarized": ("passed", None),
    "apple-development": ("failed", "not_developer_id"),
    "adhoc": ("failed", "adhoc"),
    "adhoc-or-unsigned": ("failed", "adhoc"),
}
TEAM_OF_SAMPLE = {"kr106": "D39XBP2326", "hamburger": "W2SYD24Y7B", "retroplug": "438VFJA7VR", "orchestra": "R5Y7P9P4KU"}


def judge(sample):
    return mj.judge_bundle(
        mj.parse_codesign(sample["codesign"]["text"], sample["codesign"]["exit"]),
        mj.parse_spctl(sample["spctl"]["text"], sample["spctl"]["exit"]),
    )


class A2V2SampleTest(unittest.TestCase):
    """M01・M02・M04・M05: 検証 A2 と V2 の標本の判定が、それぞれの検証の結果と一致する。"""

    def test_every_sample_matches_the_expectation(self):
        for sample in SAMPLES:
            with self.subTest(run=sample["run"], file=sample["file"]):
                verdict = judge(sample)
                self.assertEqual((verdict["result"], verdict["reason"]), EXPECTED[sample["expected"]])
                self.assertEqual(verdict["teamId"], TEAM_OF_SAMPLE.get(sample["sample"]))

    def test_a2_splits_14_positives_and_7_negatives(self):
        # A2 の報告: 陽性 14 件 (元のバンドル 7 件とステープルを外した複製 7 件) は accepted、陰性 7 件は rejected
        a2 = [judge(s)["result"] for s in SAMPLES if s["run"] == "a2"]
        self.assertEqual((a2.count("passed"), a2.count("failed"), len(a2)), (14, 7, 21))

    def test_v2_unstapled_copies_pass_even_with_the_lookup_blocked(self):
        # V2 の U26 と U28: 複製を先に判定しても、照会先を止めても、7 件すべてが公証済み
        for variant in ("unstapled", "unstapled-offline"):
            verdicts = [judge(s) for s in SAMPLES if s["run"] == "v2" and s["variant"] == variant]
            self.assertEqual(len(verdicts), 7, variant)
            self.assertTrue(all(v["result"] == "passed" for v in verdicts), variant)

    def test_archive_summary_of_the_samples(self):
        def archive(sample, variant="original"):
            return mj.summarize([judge(s) for s in SAMPLES if s["run"] == "a2" and s["sample"] == sample
                                 and s["variant"] == variant])

        self.assertEqual(archive("kr106"), {"result": "passed", "reason": None, "teamIds": ["D39XBP2326"]})
        self.assertEqual(archive("dexed"), {"result": "failed", "reason": "adhoc", "teamIds": []})
        self.assertEqual(archive("orchestra"), {"result": "failed", "reason": "not_developer_id",
                                                "teamIds": ["R5Y7P9P4KU"]})

    def test_raw_outputs_when_present(self):
        # 第三者の名前を含むため元の出力はリポジトリに含めない。手元にあるときだけ突き合わせる
        roots = [os.path.join(REPO, ".tmp", "2026111416-a2-results"), os.path.join(REPO, ".tmp", "2026111511-v2-results")]
        roots = [r for r in roots if os.path.isdir(r)]
        if not roots:
            self.skipTest("the raw outputs of A2 and V2 are not in .tmp/")
        count = 0
        for root in roots:
            for name in sorted(os.listdir(root)):
                if not re.match(r".*-(original|unstapled|unstapled-offline)-.*\.(vst3|clap|component)\.txt$", name):
                    continue
                with open(os.path.join(root, name), encoding="utf-8") as f:
                    text = f.read()
                expected = re.search(r"\(expected (\S+)\)", text.splitlines()[0]).group(1)
                sections = re.split(r"^-- (.*)$", text, flags=re.M)
                body = dict(zip(sections[1::2], sections[2::2]))

                def part(key):
                    lines = body[key].strip("\n").splitlines()
                    return "\n".join(lines[:-1]), int(lines[-1].split("=", 1)[1])

                verdict = mj.judge_bundle(
                    mj.parse_codesign(*part("codesign -dv --verbose=4")),
                    mj.parse_spctl(*part("spctl --assess -vvv --type install")),
                )
                with self.subTest(file=name):
                    self.assertEqual((verdict["result"], verdict["reason"]), EXPECTED[expected])
                count += 1
        self.assertGreater(count, 0)


DEVELOPER_ID = "Authority=Developer ID Application: (redacted) (ABCDE12345)\nTeamIdentifier=ABCDE12345"


class RuleTest(unittest.TestCase):
    """標本の無い組み合わせ。出力は A2 と V2 で観測した形に合わせて作った。"""

    def bundle(self, codesign, codesign_exit, spctl, spctl_exit):
        return mj.judge_bundle(mj.parse_codesign(codesign, codesign_exit), mj.parse_spctl(spctl, spctl_exit))

    def test_unsigned_is_not_signed(self):
        v = self.bundle("X.vst3: code object is not signed at all", 1, "X.vst3: rejected\nsource=no usable signature", 3)
        self.assertEqual((v["result"], v["reason"]), ("failed", "not_signed"))

    def test_other_certificates_are_not_developer_id(self):
        v = self.bundle("Authority=Apple Distribution: (redacted) (ABCDE12345)\nTeamIdentifier=ABCDE12345", 0,
                        "X.vst3: rejected", 3)
        self.assertEqual((v["result"], v["reason"], v["teamId"]), ("failed", "not_developer_id", "ABCDE12345"))

    def test_m03_developer_id_rejected_is_an_error_not_a_failure(self):
        # 照会の失敗と却下を区別できないため failed にしない (検証 V2 の U28)
        v = self.bundle(DEVELOPER_ID, 0, "X.vst3: rejected\norigin=Developer ID Application: (redacted) (ABCDE12345)", 3)
        self.assertEqual((v["result"], v["reason"]), ("error", "not_notarized"))

    def test_accepted_without_notarized_source_does_not_pass(self):
        v = self.bundle(DEVELOPER_ID, 0, "X.vst3: accepted\nsource=Developer ID", 0)
        self.assertEqual((v["result"], v["reason"]), ("error", "not_notarized"))

    def test_notarized_source_with_a_nonzero_exit_does_not_pass(self):
        v = self.bundle(DEVELOPER_ID, 0, "X.vst3: rejected\nsource=Notarized Developer ID", 3)
        self.assertEqual(v["result"], "error")

    def test_unassessable_bundle_is_a_check_error(self):
        v = self.bundle(DEVELOPER_ID, 0, "X.vst3: bundle format unrecognized, invalid, or unsuitable", 1)
        self.assertEqual((v["result"], v["reason"]), ("error", "check_error"))

    def test_developer_id_without_a_team_id_is_a_check_error(self):
        # 合格は Team ID を必ず持つ。Worker は Team ID の無い passed を要求ごと拒否するため、ここで error にする
        v = self.bundle("Authority=Developer ID Application: (redacted) (ABCDE12345)\nTeamIdentifier=not set", 0,
                        "X.vst3: accepted\nsource=Notarized Developer ID", 0)
        self.assertEqual((v["result"], v["reason"]), ("error", "check_error"))

    def test_codesign_failure_other_than_unsigned_is_a_check_error(self):
        v = self.bundle("X.vst3: bundle format unrecognized, invalid, or unsuitable", 1, "", 1)
        self.assertEqual((v["result"], v["reason"]), ("error", "check_error"))

    def test_m06_one_failing_bundle_fails_the_archive(self):
        passed = {"result": "passed", "reason": None, "teamId": "ABCDE12345"}
        failed = {"result": "failed", "reason": "adhoc", "teamId": None}
        error = {"result": "error", "reason": "not_notarized", "teamId": "ABCDE12345"}
        self.assertEqual(mj.summarize([passed, failed, error])["result"], "failed")
        self.assertEqual(mj.summarize([passed, error]), {"result": "error", "reason": "not_notarized",
                                                         "teamIds": ["ABCDE12345"]})
        self.assertEqual(mj.summarize([])["result"], "error")

    def test_m07_every_team_id_is_recorded(self):
        verdicts = [{"result": "passed", "reason": None, "teamId": t} for t in ("BBBBB22222", "AAAAA11111")]
        self.assertEqual(mj.summarize(verdicts)["teamIds"], ["AAAAA11111", "BBBBB22222"])


    def test_team_ids_are_truncated_to_the_first_ten_in_sorted_order(self):
        # 受け口は 10 件を超える Team ID を受け付けないため、生成側でも 10 件に収める
        ids = [f"TEAM{n:06d}" for n in range(11, 0, -1)]
        verdicts = [{"result": "passed", "reason": None, "teamId": t} for t in ids]
        self.assertEqual(mj.summarize(verdicts)["teamIds"], sorted(ids)[:10])


class CheckZipTest(unittest.TestCase):
    """M09: 展開の前に zip の項目を確かめる。ditto -x -k は、展開先の外を指すシンボリックリンクをそのまま作る (V2 の U54)。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def make(self, entries, name="a.zip"):
        path = os.path.join(self.tmp.name, name)
        with zipfile.ZipFile(path, "w") as z:
            for entry in entries:
                if entry[0] == "link":
                    info = zipfile.ZipInfo(entry[1])
                    info.create_system = 3
                    info.external_attr = (stat.S_IFLNK | 0o777) << 16
                    z.writestr(info, entry[2])
                else:
                    z.writestr(entry[0], entry[1] if len(entry) > 1 else b"x")
        return path

    def check(self, entries, bundles=("Plugin.vst3",)):
        return mj.check_zip(self.make(entries), list(bundles))

    PLIST = ("Plugin.vst3/Contents/Info.plist", "<plist/>")

    def test_plain_bundle_is_safe(self):
        self.assertEqual(self.check([self.PLIST]), {"safe": True, "reason": None, "detail": None})

    def test_absolute_path_is_unsafe(self):
        self.assertEqual(self.check([self.PLIST, ("/etc/evil", "x")])["reason"], "unsafe_archive")

    def test_parent_reference_is_unsafe(self):
        # V2 の dotdot.zip と同じ形
        r = self.check([self.PLIST, ("../escaped-by-dotdot.txt", "x"), ("Plugin.vst3/../../escaped-nested.txt", "x")])
        self.assertEqual(r["reason"], "unsafe_archive")

    def test_symlink_outside_the_bundle_is_unsafe(self):
        # V2 の symlink.zip と同じ形
        r = self.check([("link", "Plugin.vst3/Contents/link", "../../../../outside-target"), self.PLIST])
        self.assertEqual(r["reason"], "unsafe_archive")

    def test_symlink_to_a_sibling_outside_the_bundle_is_unsafe(self):
        r = self.check([self.PLIST, ("Other/x", "x"), ("link", "Plugin.vst3/Contents/link", "../../Other/x")])
        self.assertEqual(r["reason"], "unsafe_archive")

    def test_symlink_to_an_absolute_path_is_unsafe(self):
        r = self.check([self.PLIST, ("link", "Plugin.vst3/Contents/link", "/private/tmp")])
        self.assertEqual(r["reason"], "unsafe_archive")

    def test_framework_symlinks_inside_the_bundle_are_allowed(self):
        fw = "Plugin.vst3/Contents/Frameworks/Lib.framework"
        r = self.check([
            self.PLIST,
            (f"{fw}/Versions/A/Lib", b"bin"),
            ("link", f"{fw}/Versions/Current", "A"),
            ("link", f"{fw}/Lib", "Versions/Current/Lib"),
        ])
        self.assertTrue(r["safe"], r)

    def test_chained_symlinks_that_escape_are_unsafe(self):
        # 1 つずつの字面ではバンドルの中に見えても、たどるとバンドルの外に出る
        r = self.check([
            self.PLIST,
            ("Plugin.vst3/d/x", "x"),
            ("link", "Plugin.vst3/a/b/l1", "../../d"),
            ("link", "Plugin.vst3/l2", "a/b/l1/../../.."),
        ])
        self.assertEqual(r["reason"], "unsafe_archive")

    def test_symlink_loop_is_unsafe(self):
        r = self.check([self.PLIST, ("link", "Plugin.vst3/l1", "l2"), ("link", "Plugin.vst3/l2", "l1")])
        self.assertEqual(r["reason"], "unsafe_archive")

    def test_symlink_outside_bundles_must_stay_inside_the_archive(self):
        self.assertTrue(self.check([self.PLIST, ("link", "alias", "Plugin.vst3")])["safe"])
        self.assertEqual(self.check([self.PLIST, ("link", "alias", "../x")])["reason"], "unsafe_archive")

    def test_missing_bundle_is_a_check_error(self):
        self.assertEqual(self.check([self.PLIST], ["Other.vst3"])["reason"], "check_error")

    def test_bundle_paths_with_spaces_are_data(self):
        # M08: Worker から受け取ったパスはデータとして照合するだけで、解釈しない
        entries = [("Ultramaster KR-106.vst3/Contents/Info.plist", "<plist/>")]
        self.assertTrue(self.check(entries, ["Ultramaster KR-106.vst3"])["safe"])

    def test_broken_symlink_data_is_a_check_error(self):
        # 圧縮データの壊れたシンボリックリンクの項目は、zlib.error で読み取りに失敗する。例外のまま落とさない
        path = os.path.join(self.tmp.name, "broken-link.zip")
        info = zipfile.ZipInfo("Plugin.vst3/Contents/link")
        info.create_system = 3
        info.external_attr = (stat.S_IFLNK | 0o777) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        with zipfile.ZipFile(path, "w") as z:
            z.writestr("Plugin.vst3/Contents/Info.plist", "<plist/>")
            z.writestr(info, "../x")
        with zipfile.ZipFile(path) as z:
            link = z.getinfo("Plugin.vst3/Contents/link")
        start = link.header_offset + 30 + len(link.filename.encode()) + len(link.extra)
        with open(path, "rb") as f:
            data = bytearray(f.read())
        data[start] = 0xFF  # 圧縮のブロックの種類が不正になる
        with open(path, "wb") as f:
            f.write(data)
        r = mj.check_zip(path, ["Plugin.vst3"])
        self.assertEqual((r["safe"], r["reason"]), (False, "check_error"))

    def test_broken_zip_is_a_check_error(self):
        path = os.path.join(self.tmp.name, "broken.zip")
        with open(path, "wb") as f:
            f.write(b"PK\x03\x04not a zip")
        self.assertEqual(mj.check_zip(path, ["Plugin.vst3"])["reason"], "check_error")


if __name__ == "__main__":
    unittest.main()
