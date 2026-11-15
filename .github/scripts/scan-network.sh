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
expressions=()
for entry in "${patterns[@]}"; do
  expressions+=(-e "${entry#*|}")
done
candidates=()
while IFS= read -r -d '' file; do
  # JUCE を同梱した作者で JUCE 自身の通信の実装に当たらないよう、JUCE の配置 (modules/juce_core/) のファイルだけを捨てる。
  # 名前ではなく配置で判定する。JUCE の配置に似せたディレクトリに置いた処理は逃れられる (docs/design/scanning.md)。
  [[ "${file#"${dir}"/}" =~ ^(.*/)?modules/juce_core/ ]] && continue
  candidates+=("${file}")
done < <(grep -rlIEZ --exclude-dir=.git "${expressions[@]}" "${dir}" || true)

hits='[]'
count=0
truncated=false
for entry in "${patterns[@]}"; do
  [ "${#candidates[@]}" -gt 0 ] || break
  name="${entry%%|*}"
  regex="${entry#*|}"
  while IFS= read -r line; do
    [ -n "${line}" ] || continue
    if [ "${count}" -ge "${max_hits}" ]; then
      truncated=true
      break 2
    fi
    file="${line%%:*}"
    rest="${line#*:}"
    number="${rest%%:*}"
    text="${rest#*:}"
    hits=$(jq -c --arg file "${file#"${dir}"/}" --argjson line "${number}" --arg api "${name}" --arg text "${text:0:160}" \
      '. + [{file: $file, line: $line, api: $api, text: $text}]' <<< "${hits}")
    count=$((count + 1))
  done < <(grep -nHIE -e "${regex}" -- "${candidates[@]}" | sort -t: -k1,1 -k2,2n || true)
done

jq -n --argjson hits "${hits}" --argjson truncated "${truncated}" '{hits: $hits, truncated: $truncated}'
