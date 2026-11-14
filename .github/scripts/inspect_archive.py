"""配布物の zip を展開せずに読み、オーディオプラグインの規格・OS・アーキテクチャと VST 2 の有無を判定する。

規則は docs/design/scanning.md の「中身の検査」による。標準ライブラリだけを使う。
zip の中身はメモリ上で読み、ファイルへ書き出さない。中のコードは実行しない。

使い方: python3 -I inspect_archive.py [--digest sha256:<hex>] <zip のパス>
結果を JSON で標準出力に出す。result・reason・bundles・formats・os・arches・vst2Files・categories が
POST /internal/checks/results の content に送る値で、diagnostics はログに残すための値。
categories は、検出したバンドルから読んだカテゴリの手がかり (scanning.md の「表示用の値の推定」)。
"""

import hashlib
import json
import plistlib
import re
import stat
import struct
import sys
import urllib.parse
import zipfile


class Limits:
    """展開の上限。値は仮の値で、大きな配布物の計測の後に確定する (scanning.md の「取得と処理の上限」)。"""

    def __init__(self, max_entries=10_000, max_total=1024 * 1024 * 1024, max_entry=256 * 1024 * 1024):
        self.max_entries = max_entries
        self.max_total = max_total
        self.max_entry = max_entry


DEFAULT_LIMITS = Limits()
MAX_TEXT_READ = 1024 * 1024  # Info.plist・manifest.ttl・moduleinfo.json の上限
MAX_EXPORT_NAMES = 200_000
MAX_PATH_LENGTH = 1000  # Worker の受け口が受け付けるパスの長さに収める
MAX_BUNDLES = 200
MAX_VST2_FILES = 100

BUNDLE_EXT = (".vst3", ".clap", ".component", ".lv2", ".vst")
FORMAT_OF_EXT = {".vst3": "vst3", ".clap": "clap", ".component": "au", ".lv2": "lv2", ".vst": "vst2"}

# アーキテクチャは x86_64・x86・arm64 の 3 つだけを返す。Arm64EC と Arm64X は区別せず、PE の Machine の値で判定する。
PE_MACHINE = {0x14C: "x86", 0x8664: "x86_64", 0xAA64: "arm64"}
MACHO_CPU = {7: "x86", 0x01000007: "x86_64", 0x0100000C: "arm64"}
ELF_MACHINE = {3: "x86", 62: "x86_64", 183: "arm64"}
MH_FILETYPE = {1: "object", 2: "execute", 6: "dylib", 7: "dylinker", 8: "bundle", 9: "dylib_stub"}

# カテゴリの手がかり (scanning.md の「表示用の値の推定」)。CLAP の features はバイナリを実行しないと読めないため使わない。
AU_TYPE_CATEGORY = {"aumu": "instrument", "aufx": "effect", "aumf": "effect", "aumi": "midi"}
# VST 3 の moduleinfo.json の Sub Categories。1 つのクラスで先に一致したものを採る。
VST3_SUBCATEGORY = (("Instrument", "instrument"), ("Analyzer", "analyzer"), ("Fx", "effect"))
MODULEINFO_PATHS = ("Contents/Resources/moduleinfo.json", "Contents/moduleinfo.json")

# 中を調べられない入れ子のアーカイブとインストーラーの拡張子。.exe は、実行形式 (DLL でない PE) のときだけ当てる。
NESTED_EXT = (".zip", ".7z", ".rar", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".zst", ".dmg", ".pkg", ".msi")


class InspectionError(Exception):
    """result を error にする失敗。code は Worker へ送る理由のコード。"""

    def __init__(self, code, detail):
        super().__init__(detail)
        self.code = code


def unsafe_reason(name):
    """読まない項目の理由を返す。読んでよければ None。"""
    if any(ord(c) < 0x20 or ord(c) == 0x7F for c in name):
        return "control_character"
    n = name.replace("\\", "/")
    if n.startswith("/") or re.match(r"^[A-Za-z]:", n):
        return "absolute_path"
    if any(part == ".." for part in n.split("/")):
        return "parent_reference"
    if len(n) > MAX_PATH_LENGTH:
        return "path_too_long"
    return None


def is_symlink(info):
    return info.create_system == 3 and stat.S_ISLNK(info.external_attr >> 16)


class Reader:
    """上限つきで zip の項目を読む。読んだ合計を数える。"""

    def __init__(self, zf, limits):
        self.zf = zf
        self.limits = limits
        self.used = 0

    def read(self, info, limit):
        if info.file_size > limit:
            raise InspectionError("too_large_entry", f"{info.filename}: {info.file_size} > {limit}")
        if self.used + info.file_size > self.limits.max_total:
            raise InspectionError("too_large_total", f"{self.used + info.file_size} > {self.limits.max_total}")
        try:
            with self.zf.open(info) as f:
                data = f.read(limit + 1)
        except Exception as e:  # 暗号化、壊れたデータ、非対応の圧縮方式
            raise InspectionError("read_failed", f"{info.filename}: {type(e).__name__}: {e}") from e
        if len(data) > limit:
            raise InspectionError("too_large_entry", f"{info.filename}: over {limit}")
        self.used += len(data)
        return data

    def head(self, info):
        try:
            with self.zf.open(info) as f:
                return f.read(4)
        except Exception as e:
            raise InspectionError("read_failed", f"{info.filename}: {type(e).__name__}: {e}") from e


# ---------------- PE ----------------


def parse_pe(d):
    lfanew = struct.unpack_from("<I", d, 0x3C)[0]
    if d[lfanew : lfanew + 4] != b"PE\0\0":
        return None  # MZ で始まるだけの PE ではないファイル。Windows も読み込まない
    coff = lfanew + 4
    machine, nsec = struct.unpack_from("<HH", d, coff)
    opt_size, chars = struct.unpack_from("<HH", d, coff + 16)
    opt = coff + 20
    magic = struct.unpack_from("<H", d, opt)[0]
    if magic == 0x10B:
        ndir_off, dir_off = opt + 92, opt + 96
    elif magic == 0x20B:
        ndir_off, dir_off = opt + 108, opt + 112
    else:
        raise ValueError(f"unknown optional header magic {hex(magic)}")
    ndir = struct.unpack_from("<I", d, ndir_off)[0]
    dirs = [struct.unpack_from("<II", d, dir_off + 8 * i) for i in range(min(ndir, 16))]
    sections = []
    for i in range(nsec):
        s = opt + opt_size + 40 * i
        vsize, va, rawsize, rawptr = struct.unpack_from("<IIII", d, s + 8)
        sections.append((va, max(vsize, rawsize), rawptr, rawsize))

    def rva2off(rva):
        for va, size, rawptr, rawsize in sections:
            if va <= rva < va + size:
                o = rva - va
                return rawptr + o if o < rawsize else None
        return None

    exports = []
    if dirs and dirs[0][0]:
        eo = rva2off(dirs[0][0])
        if eo is None:
            raise ValueError("export directory RVA is not mapped")
        nnames = struct.unpack_from("<I", d, eo + 24)[0]
        names_off = rva2off(struct.unpack_from("<I", d, eo + 32)[0])
        if nnames and names_off is None:
            raise ValueError("export name table RVA is not mapped")
        for i in range(min(nnames, MAX_EXPORT_NAMES)):
            o = rva2off(struct.unpack_from("<I", d, names_off + 4 * i)[0])
            if o is not None:
                exports.append(d[o : d.index(b"\0", o)].decode("latin-1"))
    return {
        "format": "pe",
        "os": "windows",
        "arch": [PE_MACHINE.get(machine)],
        "shared": bool(chars & 0x2000),  # IMAGE_FILE_DLL
        "executable": not chars & 0x2000,
        "exports": set(exports),
    }


# ---------------- Mach-O ----------------


def uleb(d, p):
    result = shift = 0
    while True:
        b = d[p]
        p += 1
        result |= (b & 0x7F) << shift
        if not b & 0x80:
            return result, p
        shift += 7


def walk_trie(d, start, size):
    names = []
    stack = [(0, b"")]
    seen = set()
    while stack and len(names) < MAX_EXPORT_NAMES:
        off, prefix = stack.pop()
        if off in seen or off >= size:
            continue
        seen.add(off)
        p = start + off
        term, p = uleb(d, p)
        if term:
            names.append(prefix.decode("utf-8", "replace"))
        p += term
        nchild = d[p]
        p += 1
        for _ in range(nchild):
            end = d.index(b"\0", p)
            edge = d[p:end]
            p = end + 1
            child, p = uleb(d, p)
            stack.append((child, prefix + edge))
    return names


def parse_macho_slice(d, base):
    magic = struct.unpack_from("<I", d, base)[0]
    if magic == 0xFEEDFACF:
        is64 = True
    elif magic == 0xFEEDFACE:
        is64 = False
    else:
        raise ValueError(f"unsupported Mach-O magic {hex(magic)}")
    cputype, _cpusub, ftype, ncmds, _sizecmds = struct.unpack_from("<iiIII", d, base + 4)
    p = base + (32 if is64 else 28)
    trie = None
    symtab = None
    for _ in range(ncmds):
        cmd, cmdsize = struct.unpack_from("<II", d, p)
        if cmd in (0x22, 0x80000022):  # LC_DYLD_INFO(_ONLY)
            exp_off, exp_size = struct.unpack_from("<II", d, p + 40)
            if exp_size:
                trie = (exp_off, exp_size)
        elif cmd == 0x80000033:  # LC_DYLD_EXPORTS_TRIE
            off, size = struct.unpack_from("<II", d, p + 8)
            if size:
                trie = (off, size)
        elif cmd == 0x2:  # LC_SYMTAB
            symtab = struct.unpack_from("<IIII", d, p + 8)
        if cmdsize == 0:
            raise ValueError("cmdsize is 0")
        p += cmdsize
    exports = []
    if trie:
        exports = walk_trie(d, base + trie[0], trie[1])
    elif symtab:
        symoff, nsyms, stroff, _strsize = symtab
        esz = 16 if is64 else 12
        for i in range(min(nsyms, MAX_EXPORT_NAMES)):
            e = base + symoff + esz * i
            strx, ntype = struct.unpack_from("<IB", d, e)
            # 外部に公開した定義済みのシンボル (N_EXT かつ N_SECT、N_STAB でない)
            if (ntype & 0x01) and (ntype & 0x0E) == 0x0E and not (ntype & 0xE0):
                s = base + stroff + strx
                exports.append(d[s : d.index(b"\0", s)].decode("utf-8", "replace"))
    # Mach-O の C のシンボルは先頭に _ が付く。比べるため外す
    exports = [n[1:] if n.startswith("_") else n for n in exports]
    return MACHO_CPU.get(cputype & 0xFFFFFFFF), MH_FILETYPE.get(ftype, f"type{ftype}"), exports


def parse_macho(d):
    magic_be = struct.unpack_from(">I", d, 0)[0]
    slices = []
    if magic_be in (0xCAFEBABE, 0xCAFEBABF):
        nfat = struct.unpack_from(">I", d, 4)[0]
        if nfat == 0 or nfat > 20:
            return None  # Java のクラスファイルも同じ magic で始まる
        is64 = magic_be == 0xCAFEBABF
        for i in range(nfat):
            if is64:
                _cpu, _sub, off, _size = struct.unpack_from(">iiQQ", d, 8 + 32 * i)
            else:
                _cpu, _sub, off, _size = struct.unpack_from(">iiII", d, 8 + 20 * i)
            slices.append(parse_macho_slice(d, off))
    else:
        slices.append(parse_macho_slice(d, 0))
    filetypes = {s[1] for s in slices}
    return {
        "format": "macho",
        "os": "macos",
        "arch": [s[0] for s in slices],
        "shared": filetypes <= {"bundle", "dylib"},
        "executable": False,
        "exports": {e for s in slices for e in s[2]},
    }


# ---------------- ELF ----------------


def parse_elf(d):
    cls, data = d[4], d[5]
    e = "<" if data == 1 else ">"
    is64 = cls == 2
    etype, machine = struct.unpack_from(e + "HH", d, 16)
    if is64:
        phoff, shoff = struct.unpack_from(e + "QQ", d, 32)
        phentsize, phnum, shentsize, shnum = struct.unpack_from(e + "HHHH", d, 54)
    else:
        phoff, shoff = struct.unpack_from(e + "II", d, 28)
        phentsize, phnum, shentsize, shnum = struct.unpack_from(e + "HHHH", d, 42)
    has_interp = any(struct.unpack_from(e + "I", d, phoff + phentsize * i)[0] == 3 for i in range(phnum))  # PT_INTERP
    sections = []
    for i in range(shnum):
        o = shoff + shentsize * i
        if is64:
            _n, typ, _f, _a, off, size, link, _i, _al, entsize = struct.unpack_from(e + "IIQQQQIIQQ", d, o)
        else:
            _n, typ, _f, _a, off, size, link, _i, _al, entsize = struct.unpack_from(e + "IIIIIIIIII", d, o)
        sections.append((typ, off, size, link, entsize))
    exports = []
    found = False
    for typ, off, size, link, entsize in sections:
        if typ != 11:  # SHT_DYNSYM
            continue
        found = True
        stroff = sections[link][1]
        esz = entsize or (24 if is64 else 16)
        for i in range(min(size // esz, MAX_EXPORT_NAMES)):
            s = off + esz * i
            if is64:
                nm, info, other, shndx = struct.unpack_from(e + "IBBH", d, s)
            else:
                nm, _v, _sz, info, other, shndx = struct.unpack_from(e + "IIIBBH", d, s)
            bind, vis = info >> 4, other & 3
            # 定義済みで GLOBAL か WEAK、可視性が DEFAULT か PROTECTED のもの
            if bind in (1, 2) and shndx != 0 and vis in (0, 3) and nm:
                p = stroff + nm
                exports.append(d[p : d.index(b"\0", p)].decode("utf-8", "replace"))
    if not found and etype == 3:
        raise ValueError("shared object without SHT_DYNSYM")
    return {
        "format": "elf",
        "os": "linux",
        "arch": [ELF_MACHINE.get(machine)],
        # PIE の実行形式も ET_DYN だが、PT_INTERP を持つため共有ライブラリとみなさない
        "shared": etype == 3 and not has_interp,
        "executable": False,
        "exports": set(exports),
    }


def sniff(head):
    if head[:2] == b"MZ":
        return parse_pe
    if head[:4] in (b"\xcf\xfa\xed\xfe", b"\xce\xfa\xed\xfe", b"\xca\xfe\xba\xbe", b"\xca\xfe\xba\xbf"):
        return parse_macho
    if head[:4] == b"\x7fELF":
        return parse_elf
    return None


# ---------------- 本体 ----------------


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return "sha256:" + h.hexdigest()


def known_arches(bins):
    arches = []
    for b in bins:
        for a in b["arch"]:
            if a and a not in arches:
                arches.append(a)
    return arches


def au_categories(components):
    """Audio Unit の AudioComponents の type から、カテゴリの手がかりを返す。"""
    found = set()
    for comp in components if isinstance(components, list) else []:
        if isinstance(comp, dict) and comp.get("type") in AU_TYPE_CATEGORY:
            found.add(AU_TYPE_CATEGORY[comp["type"]])
    return found


def parse_moduleinfo(data):
    """moduleinfo.json を読む。VST 3 SDK の出力は末尾のコンマを含むことがあるため、それを除いてから読む。"""
    text = data.decode("utf-8-sig", "replace")
    return json.loads(re.sub(r",(\s*[\]}])", r"\1", text))


def vst3_categories(root, files, reader, diagnostics):
    """VST 3 のバンドルの moduleinfo.json の Sub Categories から、カテゴリの手がかりを返す。
    moduleinfo.json は必須でなく、読めなくてもバンドルの判定は変えない。"""
    found = set()
    for rel in MODULEINFO_PATHS:
        path = f"{root}/{rel}"
        if path not in files:
            continue
        try:
            info = parse_moduleinfo(reader.read(files[path], MAX_TEXT_READ))
        except InspectionError:
            raise
        except Exception as e:
            diagnostics["moduleinfo_errors"].append({"path": path, "error": f"{type(e).__name__}: {e}"})
            continue
        classes = info.get("Classes") if isinstance(info, dict) else None
        for cls in classes if isinstance(classes, list) else []:
            subs = cls.get("Sub Categories") if isinstance(cls, dict) else None
            if isinstance(subs, str):
                subs = subs.split("|")
            if not isinstance(subs, list):
                continue
            match = next((cat for token, cat in VST3_SUBCATEGORY if token in subs), None)
            if match:
                found.add(match)
        break
    return found


def find_bundles(files, binaries, reader, diagnostics, categories=None):
    """規格のバンドルの根を探し、有効なバンドルと .vst のバンドルの根を返す。
    categories に set を渡すと、有効なバンドルから読んだカテゴリの手がかりを加える。"""
    roots = {}  # 根のパス -> (拡張子, 根がファイルなら True)
    for n in files:
        parts = n.split("/")
        for i, seg in enumerate(parts):
            low = seg.lower()
            ext = next((x for x in BUNDLE_EXT if low.endswith(x)), None)
            if ext:
                roots.setdefault("/".join(parts[: i + 1]), (ext, i == len(parts) - 1))
                break  # 最も外側の規格の拡張子を持つ要素を根とする

    def under(root, pattern):
        pre = root + "/"
        return [n for n in files if n.startswith(pre) and re.fullmatch(pattern, n[len(pre) :])]

    def exporting(cands, symbol):
        return [binaries[c] for c in cands if c in binaries and symbol in binaries[c]["exports"]]

    bundles = []
    vst2_roots = []
    for root, (ext, is_file) in sorted(roots.items()):
        fmt = FORMAT_OF_EXT[ext]
        bins = []
        problem = None
        cats = set()
        if fmt == "vst2":
            if is_file:
                continue  # 単一ファイルの .vst は、下のエクスポートの判定だけで扱う
            vst2_roots.append(root)
            continue
        if fmt == "vst3":
            if is_file:
                problem = "single_file_vst3"  # Windows の単一ファイルの .vst3 は VST 3 のバンドルとみなさない
            else:
                cands = under(root, r"Contents/[^/]+-win/[^/]+\.vst3|Contents/MacOS/[^/]+|Contents/[^/]+-linux/[^/]+\.so")
                bins = exporting(cands, "GetPluginFactory")
                if not bins:
                    problem = "no_GetPluginFactory"
                else:
                    cats = vst3_categories(root, files, reader, diagnostics)
        elif fmt == "clap":
            cands = [root] if is_file else under(root, r"Contents/MacOS/[^/]+")
            bins = exporting(cands, "clap_entry")
            if not bins:
                problem = "no_clap_entry"
        elif fmt == "au":
            plist_path = root + "/Contents/Info.plist"
            if is_file or plist_path not in files:
                problem = "no_info_plist"
            else:
                try:
                    pl = plistlib.loads(reader.read(files[plist_path], MAX_TEXT_READ))
                except InspectionError:
                    raise
                except Exception as e:
                    raise InspectionError("plist_parse_failed", f"{plist_path}: {type(e).__name__}: {e}") from e
                exe = pl.get("CFBundleExecutable") if isinstance(pl, dict) else None
                comps = pl.get("AudioComponents") if isinstance(pl, dict) else None
                if not comps:
                    problem = "no_AudioComponents"  # AudioComponents を持たない旧い形式は Audio Unit として扱わない
                elif not isinstance(exe, str) or f"{root}/Contents/MacOS/{exe}" not in binaries:
                    problem = "no_bundle_executable"
                else:
                    bins = [binaries[f"{root}/Contents/MacOS/{exe}"]]
                    cats = au_categories(comps)
        elif fmt == "lv2":
            manifest = root + "/manifest.ttl"
            if is_file or manifest not in files:
                problem = "no_manifest"
            else:
                text = reader.read(files[manifest], MAX_TEXT_READ).decode("utf-8", "replace")
                refs = sorted(set(re.findall(r"(?:lv2:binary|<http://lv2plug\.in/ns/lv2core#binary>)\s+<([^>]+)>", text)))
                # lv2:binary は相対 URI で、空白などはパーセントエンコードされる
                bins = [binaries[p] for p in (root + "/" + urllib.parse.unquote(r) for r in refs) if p in binaries]
                if not bins:
                    problem = "lv2_binary_missing"
        if not problem:
            bins_os = sorted({b["os"] for b in bins})
            arches = known_arches(bins)
            if not arches:
                problem = "unsupported_arch"
            else:
                bundles.append({"path": root, "format": fmt, "os": bins_os, "arches": arches})
                if categories is not None:
                    categories.update(cats)
        if problem:
            diagnostics["invalid_bundles"].append({"path": root, "format": fmt, "problem": problem})
    return bundles, vst2_roots


def inspect(path, limits=DEFAULT_LIMITS, digest=None):
    diagnostics = {"rejected": [], "undetermined": [], "invalid_bundles": [], "moduleinfo_errors": [], "error": None}
    out = {
        "result": "error",
        "reason": None,
        "bundles": [],
        "formats": [],
        "os": [],
        "arches": [],
        "vst2Files": [],
        "categories": [],
    }
    try:
        if digest is not None and sha256_of(path) != digest.lower():
            # 取得した配布物が記録した digest と違えば、中身を検査しない
            raise InspectionError("digest_mismatch", "sha256 differs from the recorded digest")
        try:
            zf = zipfile.ZipFile(path)
        except (zipfile.BadZipFile, OSError, ValueError) as e:
            raise InspectionError("bad_zip", f"{type(e).__name__}: {e}") from e
        with zf:
            result = _inspect_zip(zf, limits, out, diagnostics)
        out["result"] = result
    except InspectionError as e:
        out.update({"result": "error", "reason": e.code, "bundles": [], "formats": [], "os": [], "arches": []})
        out["vst2Files"] = []
        out["categories"] = []
        diagnostics["error"] = str(e)
    out["diagnostics"] = diagnostics
    return out


def _inspect_zip(zf, limits, out, diagnostics):
    infos = zf.infolist()
    if len(infos) > limits.max_entries:
        raise InspectionError("too_many_entries", f"{len(infos)} > {limits.max_entries}")
    if any(i.file_size > limits.max_entry for i in infos):
        raise InspectionError("too_large_entry", f"an entry exceeds {limits.max_entry}")
    total = sum(i.file_size for i in infos)
    if total > limits.max_total:
        raise InspectionError("too_large_total", f"{total} > {limits.max_total}")

    reader = Reader(zf, limits)
    files = {}  # 正規化したパス -> ZipInfo
    for info in infos:
        reason = unsafe_reason(info.filename)
        if reason:
            diagnostics["rejected"].append({"path": info.filename, "reason": reason})
            continue
        if info.is_dir():
            continue
        name = info.filename.replace("\\", "/")
        if is_symlink(info):
            diagnostics["rejected"].append({"path": name, "reason": "symlink"})
            continue
        files[name] = info

    # 実行形式を探す。すべてのファイルの先頭 4 バイトを見る
    binaries = {}
    parse_error = None
    for name, info in files.items():
        if info.file_size < 64:
            continue
        parser = sniff(reader.head(info))
        if not parser:
            continue
        data = reader.read(info, limits.max_entry)
        try:
            b = parser(data)
        except Exception as e:  # 壊れたバイナリ、または解析できない形
            parse_error = parse_error or InspectionError("binary_parse_failed", f"{name}: {type(e).__name__}: {e}")
            continue
        if b is not None:
            binaries[name] = b

    categories = set()
    bundles, vst2_roots = find_bundles(files, binaries, reader, diagnostics, categories)
    if len(bundles) > MAX_BUNDLES:
        raise InspectionError("too_many_bundles", f"{len(bundles)} > {MAX_BUNDLES}")

    # VST 2: .vst のバンドル、または VSTPluginMain か main_macho をエクスポートするバイナリ。
    # main は、共有ライブラリのときだけ数える。
    vst2 = list(vst2_roots)
    for name, b in sorted(binaries.items()):
        ex = b["exports"]
        if "VSTPluginMain" in ex or "main_macho" in ex or ("main" in ex and b["shared"]):
            vst2.append(name)

    for name in files:
        low = name.lower()
        if low.endswith(NESTED_EXT) or (low.endswith(".exe") and name in binaries and binaries[name]["executable"]):
            diagnostics["undetermined"].append({"path": name, "reason": "nested_archive_or_installer"})

    out["bundles"] = bundles
    out["formats"] = sorted({b["format"] for b in bundles})
    out["os"] = sorted({o for b in bundles for o in b["os"]})
    out["arches"] = sorted({a for b in bundles for a in b["arches"]})
    out["vst2Files"] = vst2[:MAX_VST2_FILES]
    out["categories"] = sorted(categories)
    # 判定の順: VST 2 の検出は確定の結果として最初に採る。解析の失敗と判定不能は passed にしない
    if vst2:
        return "vst2_detected"
    if parse_error:
        raise parse_error
    if diagnostics["undetermined"]:
        return "undetermined"
    return "passed" if bundles else "no_plugin"


def main(argv):
    args = argv[1:]
    digest = None
    if len(args) == 3 and args[0] == "--digest":
        digest, args = args[1], args[2:]
    if len(args) != 1:
        print("usage: python3 -I inspect_archive.py [--digest sha256:<hex>] <zip>", file=sys.stderr)
        return 2
    json.dump(inspect(args[0], digest=digest), sys.stdout, ensure_ascii=False)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
