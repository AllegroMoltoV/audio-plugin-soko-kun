#!/usr/bin/env bash
# 取得したソースのディレクトリから、通信の API の使用を探し、{hits, truncated} の JSON を標準出力に書く。
# ソースは実行もビルドもせず、文字列で探すだけにする (docs/design/scanning.md の「通信の検出」)。
# パターンの名前は src/review/network.ts の NETWORK_APIS と同じにする。受け口は知らない名前を捨てる。
# 使い方: scan-network.sh <ソースのディレクトリ>
set -euo pipefail

dir="$1"
max_hits=50

# JUCE の juce::URL は、launchInDefaultBrowser のようにブラウザーで開くだけの用途にも使うため、
# 型の名前では当てず、通信を行う関数とクラスだけに当てる。File::createInputStream と区別するため、
# createInputStream は URL:: で修飾した形と InputStreamOptions だけに当てる。
patterns=(
  'winhttp|WinHttpOpen|WinHttpConnect|WinHttpSendRequest'
  'wininet|InternetOpen|InternetConnect|InternetOpenUrl|HttpSendRequest'
  'libcurl|curl_easy_init|curl_easy_perform|curl_multi_'
  'qt-network|QNetworkAccessManager|QWebSocket|QTcpSocket|QUdpSocket'
  'socket|WSAStartup|getaddrinfo|\bsocket[[:space:]]*\('
  'cpp-httplib|httplib::Client|httplib::SSLClient'
  'ixwebsocket|ix::WebSocket|ix::HttpClient'
  'websocketpp|websocketpp::'
  'libwebsockets|lws_client_connect'
  'boost-asio|boost::asio::ip::tcp|boost::asio::ip::udp'
  'poco-net|Poco::Net::'
  'nsurlsession|NSURLSession|NSURLConnection'
  'juce-network|WebInputStream|StreamingSocket|DatagramSocket|URL::createInputStream|InputStreamOptions|readEntireTextStream|readEntireBinaryStream|downloadToFile'
  'rust-http|reqwest::|ureq::|hyper::Client|isahc::|attohttpc::'
  'rust-net|TcpStream::connect|UdpSocket::bind|tungstenite::'
)

# UTF-8 として読めない文字 (Shift_JIS や cp1252 のコメント) を含む行も当てるため、バイト列として探す。
export LC_ALL=C

# 拡張子とディレクトリの名前で絞らず、.git を除くすべてのテキストファイルを探す (-I でバイナリは読まない)。C のプリプロセッサは
# 拡張子に関係なく #include で取り込み、grep の --include は大文字と小文字を区別するため、拡張子で絞ると net.inc や NET.CPP に
# 置いた通信の処理を見逃す。取得するのはコミット済みのファイルだけなので、build・.deps・target も探す。文書も探す。文書の名前の
# ファイルを #include する経路を残さないためで、文書で API の名前に触れただけの行は誤検出として管理者の確認で扱う。
# ツリーの全体は、全パターンで候補のファイルを探す 1 回だけ読む。パターンごとの照合は候補のファイルだけに当て、範囲を広げても
# 探索の打ち切り (verify.yaml の 60 秒) に収める。
# grep の失敗 (終了コード 2 以上) は、当たり 0 件として扱わずにスクリプトを失敗させる。失敗を 0 件にすると、作者は grep を
# 失敗させるだけで通信の検出を逃れられる。スクリプトが失敗すると、verify.yaml はその版を error として送る。
work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
fail() {
  echo "scan-network.sh: $1" >&2
  exit 1
}

expressions=()
for entry in "${patterns[@]}"; do
  expressions+=(-e "${entry#*|}")
done
# 探すディレクトリへ移り、候補をそこからの相対パスで扱う。絶対パスで grep に渡すと、git がリポジトリの中で書き出せた
# 長いパスのファイルでも、前に付く作業ディレクトリの分でパスの上限 (PATH_MAX、4096 バイト) を超え、grep が開けない。
# GNU grep の -r は、ファイルを指定しないと現在のディレクトリを探し、名前に ./ を付けない。
cd "${dir}"
status=0
grep -rlIEZ --exclude-dir=.git "${expressions[@]}" > "${work}/candidates" || status=$?
[ "${status}" -le 1 ] || fail "grep failed while listing candidates (exit ${status})"
candidates=()
# 候補は NUL 区切りのまま sort -z で並べる。結果の順序と max_hits での打ち切りの順を、ファイル名の順にそろえるため。
while IFS= read -r -d '' file; do
  # JUCE を同梱した作者で JUCE 自身の通信の実装に当たらないよう、JUCE の配置 (modules/juce_core/) のファイルだけを捨てる。
  # 名前ではなく配置で判定する。JUCE の配置に似せたディレクトリに置いた処理は逃れられる (docs/design/scanning.md)。
  [[ "${file}" =~ ^(.*/)?modules/juce_core/ ]] && continue
  candidates+=("${file}")
done < <(sort -z "${work}/candidates")

hits='[]'
count=0
truncated=false
for entry in "${patterns[@]}"; do
  [ "${#candidates[@]}" -gt 0 ] || break
  name="${entry%%|*}"
  regex="${entry#*|}"
  # 候補は grep のコマンドラインに並べず、xargs で分けて渡す。並べると、作者が長いパスのファイルを数百個置いて引数の上限
  # (ARG_MAX) を超えさせ、grep を起動できなくできる。printf は組み込みなので上限を受けず、xargs は候補の順に分けて渡す。
  # xargs は呼んだコマンドが 1〜125 で終わるとまとめて 123 を返し、grep の 1 (一致なし) と 2 (エラー) を区別できない。
  # そこで grep を包み、1 以下は成功、2 以上は 255 で終えて xargs を止める (xargs は 124 を返す)。
  printf '%s\0' "${candidates[@]}" \
    | xargs -0 sh -c 'grep -nHIEZ -e "$0" -- "$@"; rc=$?; [ "${rc}" -le 1 ] || exit 255' "${regex}" \
    > "${work}/matches" || fail "grep failed while matching ${name}"
  # grep -Z はファイル名の後ろを NUL にする。ファイル名に : や空白を含めても、ファイル名と行番号の分け方を作者に決めさせない。
  # 行番号は grep が出すため、rest の最初の : までが常に数になる。IFS= はファイル名の末尾の空白を残すために付ける。
  # 結果はファイルから読む。パイプで読んで break 2 で抜けると、grep と xargs が SIGPIPE で失敗する。
  while IFS= read -r -d '' file && IFS= read -r rest; do
    if [ "${count}" -ge "${max_hits}" ]; then
      truncated=true
      break 2
    fi
    number="${rest%%:*}"
    text="${rest#*:}"
    hits=$(jq -c --arg file "${file}" --argjson line "${number}" --arg api "${name}" --arg text "${text:0:160}" \
      '. + [{file: $file, line: $line, api: $api, text: $text}]' <<< "${hits}")
    count=$((count + 1))
  done < "${work}/matches"
done

# hits は標準入力から渡す。コマンドライン引数で渡すと、1 つの引数の上限 (128 KiB) を超えたときに jq が起動できない。
jq -n --argjson truncated "${truncated}" '{hits: input, truncated: $truncated}' <<< "${hits}"
