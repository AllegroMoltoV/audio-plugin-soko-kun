"""中身の検査のスクリプトのテスト (docs/design/testing.md の W01〜W11・W17 と、検証 A1 の標本の突き合わせ)。

使い方: python3 -I -B -m unittest discover -s .github/scripts -p "test_*.py"
W01〜W11・W17 は、テストの中で作った小さなアーカイブで確かめる。
A1 の標本は第三者の著作物のためリポジトリに含めない。手元の .tmp/ に標本があるときだけ突き合わせ、無ければ飛ばす。
"""

import builtins
import hashlib
import importlib.util
import io
import json
import os
import stat
import struct
import tempfile
import unittest
import warnings
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))

_spec = importlib.util.spec_from_file_location("inspect_archive", os.path.join(HERE, "inspect_archive.py"))
ia = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ia)


# ---------------- テスト用のバイナリ ----------------


def pe(machine=0x8664, exports=(), dll=True):
    """エクスポート表を持つ最小の PE。machine が 0x14C なら PE32、それ以外は PE32+。"""
    pe32 = machine == 0x14C
    opt_size = 224 if pe32 else 240
    lfanew = 0x40
    header_end = lfanew + 4 + 20 + opt_size + 40
    raw_ptr, va = 0x200, 0x1000
    # エクスポート表: ディレクトリ 40 バイト、名前の RVA の配列、名前の文字列
    names = [n.encode() + b"\0" for n in exports]
    names_rva = va + 40
    strings_rva = names_rva + 4 * len(names)
    rvas, blob = [], b""
    for n in names:
        rvas.append(strings_rva + len(blob))
        blob += n
    edata = bytearray(40)
    struct.pack_into("<I", edata, 24, len(names))
    struct.pack_into("<I", edata, 32, names_rva)
    edata += b"".join(struct.pack("<I", r) for r in rvas) + blob
    edata += b"\0" * (64 - len(edata) % 64)
    d = bytearray(raw_ptr) + edata
    d[0:2] = b"MZ"
    struct.pack_into("<I", d, 0x3C, lfanew)
    d[lfanew : lfanew + 4] = b"PE\0\0"
    coff = lfanew + 4
    struct.pack_into("<HH", d, coff, machine, 1)
    struct.pack_into("<HH", d, coff + 16, opt_size, 0x2000 if dll else 0x0002)
    opt = coff + 20
    struct.pack_into("<H", d, opt, 0x10B if pe32 else 0x20B)
    ndir_off, dir_off = (opt + 92, opt + 96) if pe32 else (opt + 108, opt + 112)
    struct.pack_into("<I", d, ndir_off, 16)
    if exports:
        struct.pack_into("<II", d, dir_off, va, len(edata))
    sec = opt + opt_size
    d[sec : sec + 6] = b".edata"
    struct.pack_into("<IIII", d, sec + 8, len(edata), va, len(edata), raw_ptr)
    assert header_end <= raw_ptr
    return bytes(d)


MACHO_X86_64, MACHO_ARM64, MACHO_X86 = 0x01000007, 0x0100000C, 7


def macho_slice(cputype=MACHO_ARM64, exports=(), filetype=8):
    """LC_SYMTAB だけを持つ 64 ビットの Mach-O。filetype の 8 は MH_BUNDLE、2 は MH_EXECUTE。"""
    strtab = b"\0" + b"".join(b"_" + n.encode() + b"\0" for n in exports)
    syms, offset = b"", 1
    for n in exports:
        syms += struct.pack("<IBBHQ", offset, 0x0F, 1, 0, 0)
        offset += len(n) + 2
    symoff = 32 + 24
    stroff = symoff + len(syms)
    header = struct.pack("<IiiIIIII", 0xFEEDFACF, cputype, 0, filetype, 1, 24, 0, 0)
    symtab = struct.pack("<IIIIII", 2, 24, symoff, len(exports), stroff, len(strtab))
    data = header + symtab + syms + strtab
    return data + b"\0" * (64 - len(data) % 64)


def macho_fat(*slices_):
    """スライスを並べた fat binary。slices_ は (cputype, スライスの中身) の組。"""
    header = struct.pack(">II", 0xCAFEBABE, len(slices_))
    offset = 4096
    arch_table, body = b"", b""
    for cputype, data in slices_:
        arch_table += struct.pack(">iiIII", cputype, 0, offset + len(body), len(data), 12)
        body += data + b"\0" * (-len(data) % 4096)
    return header + arch_table + b"\0" * (offset - len(header) - len(arch_table)) + body


def elf(machine=62, exports=(), pie=False, shared=True):
    """動的シンボル表を持つ 64 ビットの ELF。pie なら ET_DYN で PT_INTERP を持つ。"""
    dynstr = b"\0" + b"".join(n.encode() + b"\0" for n in exports)
    dynsym = bytes(24)
    offset = 1
    for n in exports:
        dynsym += struct.pack("<IBBHQQ", offset, (1 << 4) | 2, 0, 1, 0, 0)
        offset += len(n) + 1
    phoff = 64
    phnum = 1 if pie else 0
    dynsym_off = phoff + 56 * phnum
    dynstr_off = dynsym_off + len(dynsym)
    shoff = dynstr_off + len(dynstr)
    shoff += -shoff % 8
    etype = 3 if (shared or pie) else 2
    head = bytearray(64)
    head[0:6] = b"\x7fELF\x02\x01"
    struct.pack_into("<HH", head, 16, etype, machine)
    struct.pack_into("<QQ", head, 32, phoff, shoff)
    struct.pack_into("<HHHH", head, 54, 56, phnum, 64, 3)
    ph = struct.pack("<IIQQQQQQ", 3, 4, 0, 0, 0, 0, 0, 1) if pie else b""
    body = bytes(head) + ph + dynsym + dynstr
    body += b"\0" * (shoff - len(body))
    sh = bytes(64)
    sh += struct.pack("<IIQQQQIIQQ", 0, 11, 0, 0, dynsym_off, len(dynsym), 2, 1, 8, 24)
    sh += struct.pack("<IIQQQQIIQQ", 0, 3, 0, 0, dynstr_off, len(dynstr), 0, 0, 1, 0)
    return body + sh


def plist(audio_components=True, executable="Plugin", au_type="aufx"):
    data = {"CFBundleExecutable": executable, "CFBundlePackageType": "BNDL"}
    if audio_components:
        data["AudioComponents"] = [{"type": au_type, "subtype": "Abcd", "manufacturer": "Allg", "name": "Fixture"}]
    import plistlib

    return plistlib.dumps(data)


# ---------------- アーカイブの作成と検査 ----------------


class ArchiveTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def make_zip(self, entries, name="asset.zip"):
        """entries は (パス, 中身) か ZipInfo と中身の組の並び。"""
        path = os.path.join(self.tmp.name, name)
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
            for entry, data in entries:
                zf.writestr(entry, data)
        return path

    def inspect(self, entries, **kwargs):
        return ia.inspect(self.make_zip(entries), **kwargs)


VST3_WIN = ("Fixture.vst3/Contents/x86_64-win/Fixture.vst3", pe(exports=("GetPluginFactory", "clap_entry")))
VST3_MAC = ("Fixture.vst3/Contents/MacOS/Fixture", macho_slice(exports=("GetPluginFactory",)))
VST3_LINUX = ("Fixture.vst3/Contents/x86_64-linux/Fixture.so", elf(exports=("GetPluginFactory",)))


class W01UnsafeEntries(ArchiveTest):
    def test_unsafe_entries_are_not_read_and_nothing_is_written(self):
        link = zipfile.ZipInfo("Fixture.vst3/Contents/x86_64-win/link.vst3")
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        path = self.make_zip(
            [
                ("../evil.vst3/Contents/x86_64-win/evil.vst3", pe(exports=("VSTPluginMain",))),
                ("/abs.dll", pe(exports=("VSTPluginMain",))),
                ("C:/drive.dll", pe(exports=("VSTPluginMain",))),
                ("a/../../up.dll", pe(exports=("VSTPluginMain",))),
                ("ctrl\x01.dll", pe(exports=("VSTPluginMain",))),
                (link, b"/etc/passwd"),
                VST3_WIN,
            ]
        )
        before = sorted(os.listdir(self.tmp.name))
        cwd_before = sorted(os.listdir(os.getcwd()))
        writes = []
        real_open = builtins.open

        def guarded_open(file, mode="r", *args, **kwargs):
            if any(flag in mode for flag in "wax+"):
                writes.append(file)
            return real_open(file, mode, *args, **kwargs)

        builtins.open = guarded_open
        try:
            result = ia.inspect(path)
        finally:
            builtins.open = real_open

        self.assertEqual(writes, [])
        self.assertEqual(sorted(os.listdir(self.tmp.name)), before)
        self.assertEqual(sorted(os.listdir(os.getcwd())), cwd_before)
        rejected = {r["path"]: r["reason"] for r in result["diagnostics"]["rejected"]}
        self.assertEqual(rejected["../evil.vst3/Contents/x86_64-win/evil.vst3"], "parent_reference")
        self.assertEqual(rejected["a/../../up.dll"], "parent_reference")
        self.assertEqual(rejected["/abs.dll"], "absolute_path")
        self.assertEqual(rejected["C:/drive.dll"], "absolute_path")
        self.assertEqual(rejected["ctrl\x01.dll"], "control_character")
        self.assertEqual(rejected["Fixture.vst3/Contents/x86_64-win/link.vst3"], "symlink")
        # 読まなかった項目の VST 2 のエクスポートは結果に現れない。読めない項目があるため passed にしない
        self.assertEqual(result["result"], "undetermined")
        self.assertEqual(result["vst2Files"], [])
        self.assertEqual([b["path"] for b in result["bundles"]], ["Fixture.vst3"])
        undetermined = {u["path"] for u in result["diagnostics"]["undetermined"]}
        self.assertEqual(undetermined, set(rejected))


class W01bPathLength(ArchiveTest):
    """パスの長さは、Worker の受け口の isSafePath (JS の length、UTF-16 の単位数で 1,024 以下) と同じ数え方で比べる。"""

    def test_bmp_outside_characters_count_as_two_units(self):
        # 絵文字 600 字は、コードポイントでは 600、UTF-16 では 1,200 になる
        name = "\U0001f600" * 600 + ".vst/Fixture.dll"
        result = self.inspect([(name, pe(exports=("VSTPluginMain",))), VST3_WIN])
        rejected = {r["path"]: r["reason"] for r in result["diagnostics"]["rejected"]}
        self.assertEqual(rejected[name], "path_too_long")
        self.assertEqual(result["result"], "undetermined")
        self.assertEqual(result["vst2Files"], [])

    def test_the_limit_is_1024_utf16_units(self):
        self.assertIsNone(ia.unsafe_reason("\U0001f600" * 512))
        self.assertEqual(ia.unsafe_reason("\U0001f600" * 513), "path_too_long")
        self.assertIsNone(ia.unsafe_reason("a" * 1024))
        self.assertEqual(ia.unsafe_reason("a" * 1025), "path_too_long")



def link(name, target, create_system=3):
    """シンボリックリンクの項目。create_system 0 は、作成元の OS の欄を Unix にしない ditto などの zip を表す。"""
    info = zipfile.ZipInfo(name)
    info.create_system = create_system
    info.external_attr = (stat.S_IFLNK | 0o777) << 16
    return (info, target.encode())


NSIS = pe(exports=(), dll=False) + b"NullsoftInst" + b"\0" * 64
VST2_DLL = pe(exports=("VSTPluginMain",))
MAC_BINARY = macho_slice(exports=("GetPluginFactory",))
NESTED_ZIP = b"PK\x05\x06" + b"\0" * 80


class W17UnreadableEntries(ArchiveTest):
    """読めない項目を含むアーカイブは、passed にせず undetermined にする (jtl.61)。"""

    def assert_undetermined(self, entries, reason=None):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")  # 同名の項目を書くときの UserWarning
            result = self.inspect(entries)
        self.assertEqual(result["result"], "undetermined", result["diagnostics"])
        if reason:
            self.assertIn(reason, [u["reason"] for u in result["diagnostics"]["undetermined"]])
        return result

    def test_unsafe_paths_hiding_a_vst2_dll_or_an_installer(self):
        paths = {
            "control_character": "Evil\x01/Evil.dll",
            "parent_reference": "../Evil.dll",
            "absolute_path": "/Evil.dll",
            "path_too_long": "a" * 1025 + "/Evil.dll",
        }
        for reason, path in paths.items():
            for kind, data in (("vst2", VST2_DLL), ("installer", NSIS), ("broken", pe()[:0x60])):
                with self.subTest(reason=reason, kind=kind):
                    result = self.assert_undetermined([VST3_WIN, (path, data)])
                    self.assertEqual(result["vst2Files"], [])
                    self.assertEqual([b["path"] for b in result["bundles"]], ["Fixture.vst3"])
                    self.assertEqual([u["reason"] for u in result["diagnostics"]["undetermined"]], [reason])

    def test_unsafe_path_hiding_a_macos_bundle_is_not_counted_as_a_bundle(self):
        result = self.assert_undetermined([VST3_WIN, ("../Evil.vst3/Contents/MacOS/Evil", MAC_BINARY)])
        self.assertEqual(result["os"], ["windows"])

    def test_symlinks_leaving_the_archive(self):
        cases = {
            "outside": link("Fixture.vst3/Contents/l", "../../../x"),
            "outside_without_unix_create_system": link("Fixture.vst3/Contents/l", "../../../x", create_system=0),
            "absolute": link("Fixture.vst3/Contents/l", "/etc/passwd"),
            "windows_absolute": link("Fixture.vst3/Contents/l", "C:\\Windows"),
            "loop": link("Fixture.vst3/Contents/l", "l"),
        }
        for label, entry in cases.items():
            with self.subTest(label):
                self.assert_undetermined([VST3_WIN, entry], "unsafe_symlink")

    def test_unreadable_symlink_target_is_undetermined(self):
        self.assert_undetermined([VST3_WIN, link("Fixture.vst3/Contents/l", "\x01")], "unsafe_symlink")

    def test_duplicate_names(self):
        self.assert_undetermined([VST3_WIN, ("x64/Evil.dll", VST2_DLL), ("x64/Evil.dll", b"harmless")], "duplicate_entry")
        # バックスラッシュは / として扱うため、同じ名前になる
        self.assert_undetermined([VST3_WIN, ("x64/Evil.dll", VST2_DLL), ("x64\\Evil.dll", b"harmless")], "duplicate_entry")

    def test_directory_entry_carrying_data(self):
        self.assert_undetermined([VST3_WIN, ("x64/Evil.dll/", VST2_DLL)], "directory_with_data")

    def test_an_empty_directory_entry_is_fine(self):
        result = self.inspect([VST3_WIN, ("docs/", b"")])
        self.assertEqual(result["result"], "passed")

    def test_readable_vst2_still_takes_priority(self):
        result = self.inspect([VST3_WIN, ("x64/Fixture.dll", VST2_DLL), ("../up.dll", b"x")])
        self.assertEqual(result["result"], "vst2_detected")

    def test_symlinks_inside_the_bundle_are_not_a_problem(self):
        # SDL2.framework のような、バンドルの中に置かれ同じバンドルの中を指す正規の形
        fw = "Fixture.vst3/Contents/Frameworks/SDL2.framework"
        result = self.inspect(
            [
                VST3_MAC,
                (f"{fw}/Versions/A/SDL2", b"x" * 100),
                link(f"{fw}/Versions/Current", "A"),
                link(f"{fw}/SDL2", "Versions/Current/SDL2"),
            ]
        )
        self.assertEqual(result["result"], "passed", result["diagnostics"])
        self.assertEqual([b["path"] for b in result["bundles"]], ["Fixture.vst3"])

    def test_symlink_names_that_hide_a_bundle_an_installer_or_a_nested_archive(self):
        cases = {
            "bundle": [("hidden/Contents/MacOS/Evil", MAC_BINARY), link("Evil.vst3", "hidden")],
            "installer": [("data/blob", NSIS), link("setup.exe", "data/blob")],
            "nested_archive": [("data/blob2", NESTED_ZIP), link("inner.zip", "data/blob2")],
            "bundle_inside_a_bundle": [("Fixture.vst3/hidden/x", b"x" * 100), link("Fixture.vst3/Evil.clap", "hidden")],
        }
        for label, entries in cases.items():
            with self.subTest(label):
                self.assert_undetermined([VST3_WIN, *entries])

    def test_symlink_outside_a_bundle_resolving_inside_the_archive(self):
        self.assert_undetermined([VST3_WIN, ("data/blob", b"x" * 100), link("alias", "data/blob")], "unsafe_symlink")

    def test_symlink_resolving_into_another_bundle(self):
        entries = [VST3_MAC, ("Other.vst3/x", b"x" * 100), link("Fixture.vst3/Contents/l", "../../Other.vst3/x")]
        self.assert_undetermined(entries, "unsafe_symlink")

    def test_trailing_dots_and_spaces_do_not_hide_names(self):
        cases = {
            "installer_dot": ("setup.exe.", NSIS),
            "installer_space": ("setup.exe ", NSIS),
            "nested_dot": ("inner.zip.", NESTED_ZIP),
            "nested_dot_space": ("inner.zip. .", NESTED_ZIP),
        }
        for label, entry in cases.items():
            with self.subTest(label):
                self.assert_undetermined([VST3_WIN, entry], "nested_archive_or_installer")

    def test_trailing_dot_does_not_hide_a_bundle_root(self):
        result = self.inspect([("Fixture.vst3./Contents/x86_64-win/Fixture.vst3", pe(exports=("GetPluginFactory",)))])
        self.assertEqual(result["formats"], ["vst3"])


class W02Limits(ArchiveTest):
    def test_too_many_entries(self):
        entries = [(f"docs/{i}.txt", b"x") for i in range(11)] + [VST3_WIN]
        result = self.inspect(entries, limits=ia.Limits(max_entries=10))
        self.assertEqual((result["result"], result["reason"]), ("error", "too_many_entries"))

    def test_total_size_over_the_limit(self):
        result = self.inspect([VST3_WIN, ("big.bin", b"\0" * 5000)], limits=ia.Limits(max_total=4000))
        self.assertEqual((result["result"], result["reason"]), ("error", "too_large_total"))

    def test_entry_size_over_the_limit(self):
        result = self.inspect([VST3_WIN, ("big.bin", b"\0" * 5000)], limits=ia.Limits(max_entry=3000))
        self.assertEqual((result["result"], result["reason"]), ("error", "too_large_entry"))

    def test_default_values(self):
        # DISTRHO/Cardinal 26.02 の win64 の zip (項目 57,218、展開後 3.29 GiB、最大の項目 100 MiB) を処理できる値。
        self.assertEqual(
            (ia.DEFAULT_LIMITS.max_entries, ia.DEFAULT_LIMITS.max_total, ia.DEFAULT_LIMITS.max_entry),
            (100_000, 4 << 30, 256 << 20),
        )


class W03Broken(ArchiveTest):
    def test_broken_archive(self):
        path = os.path.join(self.tmp.name, "broken.zip")
        with open(path, "wb") as f:
            f.write(b"PK\x03\x04" + os.urandom(200))
        result = ia.inspect(path)
        self.assertEqual((result["result"], result["reason"]), ("error", "bad_zip"))

    def test_unparsable_binary(self):
        truncated = pe(exports=("GetPluginFactory",))[:0x60]  # PE のシグネチャの後で切れている
        result = self.inspect([VST3_WIN, ("Other.vst3/Contents/x86_64-win/Other.vst3", truncated)])
        self.assertEqual((result["result"], result["reason"]), ("error", "binary_parse_failed"))

    def test_corrupted_entry_data(self):
        path = self.make_zip([VST3_WIN])
        with zipfile.ZipFile(path) as zf:
            info = zf.infolist()[0]
        # 先頭の項目の圧縮データの中ほどを書き換える。展開か CRC の照合で読み取りに失敗する
        middle = info.header_offset + 30 + len(info.filename.encode()) + info.compress_size // 2
        with open(path, "rb") as f:
            data = bytearray(f.read())
        data[middle] ^= 0xFF
        data[middle + 1] ^= 0xFF
        with open(path, "wb") as f:
            f.write(data)
        result = ia.inspect(path)
        self.assertEqual((result["result"], result["reason"]), ("error", "read_failed"))


class W04Vst3WithoutFactory(ArchiveTest):
    def test_vst3_layout_without_get_plugin_factory(self):
        result = self.inspect([("Fixture.vst3/Contents/x86_64-win/Fixture.vst3", pe(exports=("clap_entry",)))])
        self.assertEqual(result["result"], "no_plugin")
        self.assertEqual(result["formats"], [])


class W05Vst2(ArchiveTest):
    def test_vst_bundle(self):
        result = self.inspect([VST3_MAC, ("Fixture.vst/Contents/MacOS/Fixture", macho_slice(exports=("Other",)))])
        self.assertEqual(result["result"], "vst2_detected")
        self.assertEqual(result["vst2Files"], ["Fixture.vst"])

    def test_vst_plugin_main_with_a_vst3_bundle(self):
        result = self.inspect([VST3_WIN, ("x64/Fixture.dll", pe(exports=("VSTPluginMain",)))])
        self.assertEqual(result["result"], "vst2_detected")
        self.assertEqual(result["vst2Files"], ["x64/Fixture.dll"])
        self.assertEqual(result["formats"], ["vst3"])

    def test_main_macho(self):
        result = self.inspect([VST3_MAC, ("Fixture.component/Contents/MacOS/Old", macho_slice(exports=("main_macho",)))])
        self.assertEqual(result["result"], "vst2_detected")

    def test_main_in_a_shared_library(self):
        result = self.inspect([VST3_LINUX, ("lib/Fixture.so", elf(exports=("main",)))])
        self.assertEqual(result["result"], "vst2_detected")

    def test_main_in_an_executable_is_not_vst2(self):
        result = self.inspect([VST3_LINUX, ("bin/Fixture", elf(exports=("main",), pie=True))])
        self.assertEqual(result["result"], "passed")
        self.assertEqual(result["vst2Files"], [])


class W06Nested(ArchiveTest):
    def test_nested_archive(self):
        result = self.inspect([VST3_WIN, ("extras/more.zip", b"PK\x05\x06" + b"\0" * 18)])
        self.assertEqual(result["result"], "undetermined")

    def test_installer(self):
        # Inno Setup のインストーラーの署名を持つ実行形式。
        installer = pe(exports=(), dll=False) + b"Inno Setup Setup Data (6.2.0)"
        result = self.inspect([VST3_WIN, ("setup.exe", installer)])
        self.assertEqual(result["result"], "undetermined")
        self.assertEqual(result["formats"], ["vst3"])

    def test_nsis_installer(self):
        installer = pe(exports=(), dll=False) + b"\xef\xbe\xad\xdeNullsoftInst"
        result = self.inspect([VST3_WIN, ("Fixture-setup.exe", installer)])
        self.assertEqual(result["result"], "undetermined")

    def test_standalone_app_does_not_block(self):
        # JUCE や DPF のプラグインが同梱する単体で動くアプリ。署名が無ければ掲載を止めない。
        result = self.inspect([VST3_WIN, ("Fixture/Fixture.exe", pe(exports=(), dll=False))])
        self.assertEqual(result["result"], "passed")
        self.assertEqual(result["formats"], ["vst3"])

    def test_installer_name_alone_does_not_block(self):
        # 名前だけでは止めない。調査では、zip の中のプラグインを写すだけの補助ツールだった。
        result = self.inspect([VST3_WIN, ("install.exe", pe(exports=(), dll=False))])
        self.assertEqual(result["result"], "passed")

    def test_signature_in_a_dll_is_ignored(self):
        library = pe(exports=(), dll=True) + b"Inno Setup Setup Data"
        result = self.inspect([VST3_WIN, ("helper.exe", library)])
        self.assertEqual(result["result"], "passed")

    def test_installer_without_any_bundle(self):
        result = self.inspect([("Fixture-Installer.pkg", b"xar!" + b"\0" * 100)])
        self.assertEqual(result["result"], "undetermined")


class W07DigestMismatch(ArchiveTest):
    def test_digest_mismatch_skips_the_inspection(self):
        path = self.make_zip([VST3_WIN, ("x64/Fixture.dll", pe(exports=("VSTPluginMain",)))])
        opened = []
        real = zipfile.ZipFile

        def spy(*args, **kwargs):
            opened.append(args)
            return real(*args, **kwargs)

        ia.zipfile.ZipFile = spy
        try:
            result = ia.inspect(path, digest="sha256:" + "0" * 64)
        finally:
            ia.zipfile.ZipFile = real
        self.assertEqual((result["result"], result["reason"]), ("error", "digest_mismatch"))
        self.assertEqual(opened, [])
        self.assertEqual(result["vst2Files"], [])

    def test_matching_digest_is_inspected(self):
        path = self.make_zip([VST3_WIN])
        with open(path, "rb") as f:
            digest = "sha256:" + hashlib.sha256(f.read()).hexdigest()
        self.assertEqual(ia.inspect(path, digest=digest)["result"], "passed")


class W08Architectures(ArchiveTest):
    def arches_of(self, name, data):
        result = self.inspect([(name, data)])
        self.assertEqual(result["result"], "passed", result["diagnostics"])
        return result["bundles"][0]["os"], result["bundles"][0]["arches"]

    def test_pe(self):
        for machine, arch in ((0x14C, "x86"), (0x8664, "x86_64"), (0xAA64, "arm64")):
            data = pe(machine=machine, exports=("GetPluginFactory",))
            self.assertEqual(self.arches_of("F.vst3/Contents/x-win/F.vst3", data), (["windows"], [arch]))

    def test_macho(self):
        for cpu, arch in ((MACHO_X86_64, "x86_64"), (MACHO_ARM64, "arm64"), (MACHO_X86, "x86")):
            data = macho_slice(cputype=cpu, exports=("clap_entry",))
            self.assertEqual(self.arches_of("F.clap/Contents/MacOS/F", data), (["macos"], [arch]))

    def test_macho_fat_lists_every_slice(self):
        data = macho_fat(
            (MACHO_X86_64, macho_slice(cputype=MACHO_X86_64, exports=("GetPluginFactory",))),
            (MACHO_ARM64, macho_slice(cputype=MACHO_ARM64, exports=("GetPluginFactory",))),
        )
        self.assertEqual(self.arches_of("F.vst3/Contents/MacOS/F", data), (["macos"], ["x86_64", "arm64"]))

    def test_elf(self):
        for machine, arch in ((62, "x86_64"), (183, "arm64"), (3, "x86")):
            data = elf(machine=machine, exports=("GetPluginFactory",))
            self.assertEqual(self.arches_of("F.vst3/Contents/x-linux/F.so", data), (["linux"], [arch]))

    def test_unsupported_architecture_is_not_a_bundle(self):
        result = self.inspect([("F.vst3/Contents/arm-linux/F.so", elf(machine=40, exports=("GetPluginFactory",)))])
        self.assertEqual(result["result"], "no_plugin")


class W09SingleFileVst3(ArchiveTest):
    def test_windows_single_file_vst3(self):
        result = self.inspect([("Fixture.vst3", pe(exports=("GetPluginFactory",)))])
        self.assertEqual(result["result"], "no_plugin")
        self.assertEqual(result["diagnostics"]["invalid_bundles"][0]["problem"], "single_file_vst3")


class W10Lv2(ArchiveTest):
    def manifest(self, ref):
        return f"<urn:fixture> a lv2:Plugin ; lv2:binary <{ref}> .\n".encode()

    def test_missing_binary(self):
        result = self.inspect([("F.lv2/manifest.ttl", self.manifest("F.so")), ("F.lv2/Other.so", elf())])
        self.assertEqual(result["result"], "no_plugin")

    def test_percent_encoded_binary(self):
        result = self.inspect(
            [("F.lv2/manifest.ttl", self.manifest("libFixture%20KR.so")), ("F.lv2/libFixture KR.so", elf())]
        )
        self.assertEqual(result["result"], "passed")
        self.assertEqual(result["bundles"], [{"path": "F.lv2", "format": "lv2", "os": ["linux"], "arches": ["x86_64"]}])


class W11AudioUnit(ArchiveTest):
    def test_without_audio_components(self):
        result = self.inspect(
            [
                ("F.component/Contents/Info.plist", plist(audio_components=False)),
                ("F.component/Contents/MacOS/Plugin", macho_slice(exports=("FixtureAUFactory",))),
            ]
        )
        self.assertEqual(result["result"], "no_plugin")

    def test_with_audio_components(self):
        result = self.inspect(
            [
                ("F.component/Contents/Info.plist", plist()),
                ("F.component/Contents/MacOS/Plugin", macho_slice(exports=("FixtureAUFactory",))),
            ]
        )
        self.assertEqual(result["result"], "passed")
        self.assertEqual(result["formats"], ["au"])


class OutputContract(ArchiveTest):
    def test_cli_prints_the_contract_fields(self):
        path = self.make_zip([VST3_WIN])
        buffer = io.StringIO()
        real = ia.sys.stdout
        ia.sys.stdout = buffer
        try:
            self.assertEqual(ia.main(["inspect_archive.py", path]), 0)
        finally:
            ia.sys.stdout = real
        body = json.loads(buffer.getvalue())
        self.assertEqual(
            {k: body[k] for k in ("result", "reason", "formats", "os", "arches", "vst2Files", "categories")},
            {
                "result": "passed",
                "reason": None,
                "formats": ["vst3"],
                "os": ["windows"],
                "arches": ["x86_64"],
                "vst2Files": [],
                "categories": [],
            },
        )

    def test_categories_come_from_valid_bundles_only(self):
        """categories は Worker の content に送る契約の値。規格のバンドルとみなさないものから読まない。
        推定の規則そのもののテストは書かない (testing.md の「書かないテスト」のカテゴリの推定)。"""
        moduleinfo = b'{"Classes": [{"Category": "Audio Module Class", "Sub Categories": ["Fx", "Delay"],},],}'
        result = self.inspect(
            [
                VST3_WIN,
                ("Fixture.vst3/Contents/Resources/moduleinfo.json", moduleinfo),
                ("F.component/Contents/Info.plist", plist(au_type="aumu")),
                ("F.component/Contents/MacOS/Plugin", macho_slice(exports=("FixtureAUFactory",))),
                ("Old.component/Contents/Info.plist", plist(audio_components=False)),
            ]
        )
        self.assertEqual(result["categories"], ["effect", "instrument"])
        broken = self.inspect([VST3_WIN, ("Fixture.vst3/Contents/Resources/moduleinfo.json", b"{")])
        self.assertEqual((broken["result"], broken["categories"]), ("passed", []))


# ---------------- 検証 A1 の標本 ----------------

A1 = os.path.join(REPO, ".tmp", "2026111405-a1")
SIG = os.path.join(REPO, ".tmp", "2026111402-signing-samples")
A1_SAMPLES = {
    "dexed-1.1.0-macos": os.path.join(SIG, "dexed", "Dexed-1.1.0-macOS.zip"),
    "gate12-macos": os.path.join(SIG, "gate12", "gate12-macos-v1.3.3.zip"),
    "hamburger-macos": os.path.join(SIG, "hamburger", "Hamburger.v0.9.MacOS.arm64.Apple.Silicon.zip"),
    "kr106-macos": os.path.join(SIG, "kr106", "KR106-macOS.zip"),
    "orchestra-macos": os.path.join(SIG, "orchestra", "ORchestra-v0.2.6-macOS-arm64.zip"),
    "retroplug-macos": os.path.join(SIG, "retroplug", "retroplug-v0.7.4-macos-universal-vst3.zip"),
    "seed-local-win": os.path.join(A1, "simple-pitchshift-dist-local.zip"),
    "gate12-win": os.path.join(A1, "samples", "gate12-win", "gate12-win-v1.3.3.zip"),
    "gate12-linux": os.path.join(A1, "samples", "gate12-linux", "gate12-linux-v1.3.3.zip"),
    "dexed-0.9.3-win": os.path.join(A1, "samples", "dexed093-win", "dexed-0.9.3-win.zip"),
    "dexed-0.9.4-linux": os.path.join(A1, "samples", "dexed094-linux", "dexed-0.9.4.lnx.zip"),
    "dexed-0.9.4-win": os.path.join(A1, "samples", "dexed094-win", "dexed-0.9.4-win.zip"),
    "dexed-0.9.3-osx": os.path.join(A1, "samples", "dexed093-osx", "dexed-0.9.3-osx.zip"),
    "unsafe-paths": os.path.join(A1, "unsafe-paths.zip"),
}

# expected.json の値のうち、段階 2 の計画で承認した規則が A1 の時点の期待値を替えるもの。
# Dexed 0.9.3 の macOS 版の Audio Unit は AudioComponents を持たない旧い形式で、Audio Unit として扱わない (U12)。
RULE_OVERRIDES = {"dexed-0.9.3-osx": {"formats": [], "os": []}}

# 承認した規則での content_checks の result。Hamburger は同梱の Installer.pkg を調べられないため undetermined になる。
EXPECTED_RESULT = {
    "dexed-1.1.0-macos": "passed",
    "gate12-macos": "passed",
    "hamburger-macos": "undetermined",
    "kr106-macos": "passed",
    "orchestra-macos": "passed",
    "retroplug-macos": "passed",
    "seed-local-win": "passed",
    "gate12-win": "passed",
    "gate12-linux": "passed",
    "dexed-0.9.3-win": "vst2_detected",
    "dexed-0.9.4-linux": "vst2_detected",
    "dexed-0.9.4-win": "undetermined",
    "dexed-0.9.3-osx": "vst2_detected",
    "unsafe-paths": "undetermined",
}


class A1Samples(unittest.TestCase):
    """A1 の期待値 (.tmp/2026111405-a1/expected.json) と判定の結果を突き合わせる。S4 の合格の条件。"""

    @classmethod
    def setUpClass(cls):
        path = os.path.join(A1, "expected.json")
        if not os.path.exists(path):
            raise unittest.SkipTest("A1 の期待値が手元に無い")
        with open(path, encoding="utf-8") as f:
            cls.expected = json.load(f)

    def test_samples(self):
        compared = []
        for name, path in A1_SAMPLES.items():
            with self.subTest(sample=name):
                if not os.path.exists(path):
                    self.skipTest(f"標本が手元に無い: {path}")
                expected = {**self.expected[name], **RULE_OVERRIDES.get(name, {})}
                result = ia.inspect(path)
                actual = {
                    "formats": result["formats"],
                    "os": result["os"],
                    "arch": result["arches"],
                    "vst2": bool(result["vst2Files"]),
                }
                for key in ("formats", "os", "arch", "vst2"):
                    # 文字列の期待値は、A1 で比べなかった項目 (記載なし) と判定不能の記述
                    if not isinstance(expected[key], str):
                        self.assertEqual(actual[key], expected[key], f"{name} {key}")
                self.assertEqual(result["result"], EXPECTED_RESULT[name], f"{name} result {result['diagnostics']}")
                compared.append(name)
        self.assertEqual(len(compared), 14)

    def test_unsafe_paths_sample_writes_nothing(self):
        path = A1_SAMPLES["unsafe-paths"]
        if not os.path.exists(path):
            self.skipTest("標本が手元に無い")
        writes = []
        real_open = builtins.open

        def guarded_open(file, mode="r", *args, **kwargs):
            if any(flag in mode for flag in "wax+"):
                writes.append(file)
            return real_open(file, mode, *args, **kwargs)

        cwd_before = sorted(os.listdir(os.getcwd()))
        dir_before = sorted(os.listdir(os.path.dirname(path)))
        builtins.open = guarded_open
        try:
            result = ia.inspect(path)
        finally:
            builtins.open = real_open
        self.assertEqual(writes, [])
        self.assertEqual(sorted(os.listdir(os.getcwd())), cwd_before)
        self.assertEqual(sorted(os.listdir(os.path.dirname(path))), dir_before)
        self.assertEqual(
            sorted(r["path"] for r in result["diagnostics"]["rejected"]),
            sorted(["../evil.txt", "/abs.txt", "C:/drive.txt", "a/../../up.txt"]),
        )


if __name__ == "__main__":
    unittest.main()
