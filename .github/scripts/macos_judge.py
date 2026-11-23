"""macOS の署名と公証の判定 (docs/design/scanning.md の「署名と公証の判定」)。macos-verify.yaml が使う。

標準ライブラリだけを使う。配布物の中のコードは実行しない。zip の項目を読むだけで、ファイルへは書き出さない。

使い方:
  python3 -I macos_judge.py check-zip <zip> <バンドルのパス>...
      展開の前に zip の項目を確かめる。{"safe": bool, "reason": ..., "detail": ...} を出す。
      絶対パス・親のフォルダーを指す .. ・制御文字・バンドルの外を指すシンボリックリンクがあれば、
      reason を unsafe_archive にする。読めない zip と、Worker から受け取ったバンドルが無い zip は check_error。
  python3 -I macos_judge.py bundle <codesign の出力> <codesign の終了コード> <spctl の出力> <spctl の終了コード>
      1 つのバンドルの codesign -dv --verbose=4 と spctl --assess -vvv --type install の出力から判定する。
  python3 -I macos_judge.py summarize <bundle の出力を 1 行ずつ並べたファイル>
      アーカイブのすべてのバンドルの判定をまとめ、POST /internal/macos-checks/results の 1 件の値を出す。
"""

import importlib.util
import json
import os
import re
import sys
import zipfile

# 展開の上限と、読まない項目の規則は中身の検査と同じものを使う。-I で起動するため、同じフォルダーから明示して読む。
_spec = importlib.util.spec_from_file_location(
    "inspect_archive", os.path.join(os.path.dirname(os.path.abspath(__file__)), "inspect_archive.py")
)
ia = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ia)

MAX_TEAM_IDS = 10  # Worker の受け口の上限 (src/checks/macos-route.ts)
TEAM_ID = re.compile(r"^[A-Z0-9]{10}$")

# シンボリックリンクの判定と行き先の解決も中身の検査と同じものを使う。
Unsafe = ia.UnsafeArchive


def check_zip(path, bundles, limits=ia.DEFAULT_LIMITS):
    try:
        zf = zipfile.ZipFile(path)
    except (zipfile.BadZipFile, OSError, ValueError) as e:
        return {"safe": False, "reason": "check_error", "detail": f"bad zip: {type(e).__name__}"}
    with zf:
        infos = zf.infolist()
        if len(infos) > limits.max_entries or sum(i.file_size for i in infos) > limits.max_total:
            return {"safe": False, "reason": "check_error", "detail": "the archive exceeds the extraction limits"}
        if any(i.file_size > limits.max_entry for i in infos):
            return {"safe": False, "reason": "check_error", "detail": "an entry exceeds the extraction limit"}
        try:
            links = {}
            names = set()
            for info in infos:
                problem = ia.unsafe_reason(info.filename)
                if problem:
                    raise Unsafe(f"{info.filename!r}: {problem}")
                name = info.filename.replace("\\", "/").rstrip("/")
                names.add(name)
                if ia.is_symlink(info):
                    links[name] = ia.read_link_target(zf, info)
            for name in links:
                parts = name.split("/")
                resolved = ia.resolve_link(parts, links)
                if resolved is None:
                    raise Unsafe(f"{name}: symlink resolves outside the extraction folder")
                root = ia.bundle_root(parts)
                if resolved[: len(root)] != root:
                    raise Unsafe(f"{name}: symlink resolves outside the bundle {'/'.join(root)}")
        except Unsafe as e:
            return {"safe": False, "reason": "unsafe_archive", "detail": str(e)}
        except Exception as e:  # 壊れた圧縮データの zlib.error・EOFError・LZMAError など。判定できなかったものとして扱う
            return {"safe": False, "reason": "check_error", "detail": f"unreadable entry: {type(e).__name__}"}
    for bundle in bundles:
        if bundle.endswith("/") or not any(n == bundle or n.startswith(bundle + "/") for n in names):
            return {"safe": False, "reason": "check_error", "detail": f"bundle not found: {bundle}"}
    return {"safe": True, "reason": None, "detail": None}


def parse_codesign(text, exit_code):
    """codesign -dv --verbose=4 の出力から、署名の種類と Team ID を読む。

    署名の種類は developer_id・apple_development・other_certificate・adhoc・unsigned・unknown のいずれか。
    Authority の最初の行が署名の証明書。アドホックの署名には Authority の行が無く、Signature=adhoc を出す。"""
    lines = [line.strip() for line in text.splitlines()]
    if exit_code != 0:
        signing = "unsigned" if any("code object is not signed at all" in line for line in lines) else "unknown"
        return {"signing": signing, "teamId": None}
    authorities = [line[len("Authority=") :] for line in lines if line.startswith("Authority=")]
    team = next((line[len("TeamIdentifier=") :] for line in lines if line.startswith("TeamIdentifier=")), None)
    team_id = team if team and TEAM_ID.match(team) else None
    if authorities:
        leaf = authorities[0]
        if leaf.startswith("Developer ID Application:"):
            signing = "developer_id"
        elif leaf.startswith("Apple Development:"):
            signing = "apple_development"
        else:
            signing = "other_certificate"
    elif "Signature=adhoc" in lines:
        signing = "adhoc"
    else:
        signing = "unknown"
    return {"signing": signing, "teamId": team_id}


def parse_spctl(text, exit_code):
    """spctl --assess -vvv --type install の出力。終了コード 0 と source=Notarized Developer ID の両方で公証済み。
    終了コード 3 は却下。それ以外 (1 の bundle format unrecognized など) は判定できなかったもの。"""
    lines = [line.strip() for line in text.splitlines()]
    notarized = exit_code == 0 and "source=Notarized Developer ID" in lines
    return {"notarized": notarized, "assessed": exit_code in (0, 3)}


def judge_bundle(codesign, spctl):
    """1 つのバンドルの判定。result は passed・failed・error、reason は理由のコード。"""
    signing = codesign["signing"]
    base = {"signing": signing, "teamId": codesign["teamId"]}
    if signing == "unsigned":
        return {**base, "result": "failed", "reason": "not_signed"}
    if signing == "adhoc":
        return {**base, "result": "failed", "reason": "adhoc"}
    if signing in ("apple_development", "other_certificate"):
        return {**base, "result": "failed", "reason": "not_developer_id"}
    # Developer ID の署名は Team ID を必ず持つ。読めなければ判定できなかったものとして扱う。
    if signing != "developer_id" or not codesign["teamId"]:
        return {**base, "result": "error", "reason": "check_error"}
    if spctl["notarized"]:
        return {**base, "result": "passed", "reason": None}
    if not spctl["assessed"]:
        return {**base, "result": "error", "reason": "check_error"}
    # Developer ID の署名があるのに却下されたもの。照会の失敗と却下を区別できないため error にする (検証 V2)。
    return {**base, "result": "error", "reason": "not_notarized"}


def summarize(verdicts):
    """アーカイブの判定。1 件でも failed なら failed、failed が無く error があれば error、すべて passed なら passed。
    Team ID は、判定したバンドルの値を並べ替えて先頭の 10 件まで記録する。食い違いは Worker が版の確認待ちにする。"""
    # 受け口は 10 件までしか受け付けない。第三者が 11 社以上の署名を 1 つの zip に入れても要求が拒まれないよう、先頭の 10 件に切り詰める。
    team_ids = sorted({v["teamId"] for v in verdicts if v.get("teamId")})[:MAX_TEAM_IDS]
    for result in ("failed", "error"):
        hit = next((v for v in verdicts if v["result"] == result), None)
        if hit:
            return {"result": result, "reason": hit["reason"], "teamIds": team_ids}
    if not verdicts:
        return {"result": "error", "reason": "check_error", "teamIds": []}
    return {"result": "passed", "reason": None, "teamIds": team_ids}


def _read(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def main(argv):
    args = argv[1:]
    if len(args) >= 2 and args[0] == "check-zip":
        out = check_zip(args[1], args[2:])
    elif len(args) == 5 and args[0] == "bundle":
        out = judge_bundle(parse_codesign(_read(args[1]), int(args[2])), parse_spctl(_read(args[3]), int(args[4])))
    elif len(args) == 2 and args[0] == "summarize":
        out = summarize([json.loads(line) for line in _read(args[1]).splitlines() if line.strip()])
    else:
        print(__doc__, file=sys.stderr)
        return 2
    json.dump(out, sys.stdout, ensure_ascii=False)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
