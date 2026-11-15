// 新しい版のソースのコードからの通信の API の検出 (docs/design/scanning.md の「通信の検出」)。
// 検出は .github/workflows/verify.yaml が行い、結果を配布物の検証と同じ受け口へ返す。ここでは結果の形と保存の形を決める。

// .github/scripts/scan-network.sh のパターンの名前。受け口はこの名前の当たりだけを受け付ける。スクリプトの一覧と同じ順に並べる。
export const NETWORK_APIS = [
  'winhttp',
  'wininet',
  'libcurl',
  'qt-network',
  'socket',
  'cpp-httplib',
  'ixwebsocket',
  'websocketpp',
  'libwebsockets',
  'boost-asio',
  'poco-net',
  'nsurlsession',
  'juce-network',
  'rust-http',
  'rust-net',
] as const;

export type NetworkApi = (typeof NETWORK_APIS)[number];

export interface NetworkHit {
  file: string;
  line: number;
  api: NetworkApi;
  text: string;
}

export interface NetworkScan {
  hits: NetworkHit[];
  truncated: boolean;
}

export const MAX_NETWORK_HITS = 50;
// 検出の error を受け取る上限。上限に達した版は、検出の結果なしでレビューする。掲載は止めない。
export const MAX_NETWORK_ATTEMPTS = 3;
const MAX_SCANS = 5;
// 検出の結果を待たずにレビューへ進むまでの時間。verify.yaml が起動しない障害でレビューが止まり続けないようにする。
export const NETWORK_WAIT_MS = 6 * 60 * 60 * 1000;

// 検出の結果をまだ待っている状態。c は release_checks。
export const NETWORK_WAITING = `(c.network_state = 'pending'
  OR (c.network_state = 'error' AND c.network_attempts < ${MAX_NETWORK_ATTEMPTS}))`;

// 検出を待つ版の条件。受け口の一覧と、定期処理からの verify.yaml の起動で同じ条件を使う。p は plugins。
export const NETWORK_PENDING = `p.removed = 0 AND ${NETWORK_WAITING}`;
export const NETWORK_PENDING_LIMIT = MAX_SCANS;

const API_SET = new Set<string>(NETWORK_APIS);
const FILE = /^[^\0\r\n]{1,200}$/;

function clean(text: string, max: number): string {
  return text.replace(/[\r\n\t]/g, ' ').slice(0, max);
}

// README 以外の文書の照合で、案内の型に当たった箇所 (.github/scripts/scan-docs.mjs)。
export interface DocHit {
  file: string;
  line: number;
  rule: 'no-security-bypass' | 'no-terminal-paste';
  text: string;
}

export interface DocScan {
  hits: DocHit[];
  truncated: boolean;
}

export interface NetworkScanInput {
  releaseId: number;
  result: 'done' | 'error';
  scan: NetworkScan | null;
  // 同じ取り出しで照合した文書の結果。古いワークフローからの結果には無い。
  docs: DocScan | null;
}

const DOC_RULES = new Set(['no-security-bypass', 'no-terminal-paste']);

// 文書の照合の当たりを確かめる。形の合わない要素は 1 件ずつ捨てる。
function parseDocHits(raw: unknown, truncated: unknown): DocScan | null {
  if (!Array.isArray(raw)) return null;
  const hits: DocHit[] = [];
  for (const hit of raw.slice(0, MAX_NETWORK_HITS)) {
    const value = hit as Record<string, unknown>;
    if (typeof value?.file !== 'string' || !FILE.test(value.file)) continue;
    if (typeof value.line !== 'number' || !Number.isSafeInteger(value.line) || value.line < 1) continue;
    if (typeof value.rule !== 'string' || !DOC_RULES.has(value.rule)) continue;
    hits.push({
      file: value.file,
      line: value.line,
      rule: value.rule as DocHit['rule'],
      text: typeof value.text === 'string' ? clean(value.text, 160) : '',
    });
  }
  return { hits, truncated: truncated === true || raw.length > MAX_NETWORK_HITS };
}

// 保存した doc_hits を読む。読めなければ null。
export function readDocScan(json: string | null): DocScan | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as DocScan;
    return Array.isArray(value.hits) ? value : null;
  } catch {
    return null;
  }
}

// 受け口の本文の networkScans を確かめる。無ければ空の配列を返す。
// 要素の形が合わないとき、件数が上限を超えたとき、同じ版が重なるときは null を返し、要求全体を 400 で拒否する。
// 当たりの文字列は LLM に渡す事実にだけ使うため、形の合わない当たりと知らない API の名前の当たりは捨てるだけにする。
export function parseNetworkScans(raw: unknown): NetworkScanInput[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_SCANS) return null;
  const scans: NetworkScanInput[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    const entry = item as Record<string, unknown>;
    if (typeof entry?.releaseId !== 'number' || !Number.isSafeInteger(entry.releaseId)) return null;
    if (seen.has(entry.releaseId)) return null;
    seen.add(entry.releaseId);
    if (entry.result === 'error') {
      scans.push({ releaseId: entry.releaseId, result: 'error', scan: null, docs: null });
      continue;
    }
    if (entry.result !== 'done' || !Array.isArray(entry.hits)) return null;
    const hits: NetworkHit[] = [];
    for (const hit of entry.hits.slice(0, MAX_NETWORK_HITS)) {
      const value = hit as Record<string, unknown>;
      if (typeof value?.file !== 'string' || !FILE.test(value.file)) continue;
      if (typeof value.line !== 'number' || !Number.isSafeInteger(value.line) || value.line < 1) continue;
      if (typeof value.api !== 'string' || !API_SET.has(value.api)) continue;
      hits.push({
        file: value.file,
        line: value.line,
        api: value.api as NetworkApi,
        text: typeof value.text === 'string' ? clean(value.text, 160) : '',
      });
    }
    scans.push({
      releaseId: entry.releaseId,
      result: 'done',
      scan: { hits, truncated: entry.truncated === true || entry.hits.length > MAX_NETWORK_HITS },
      docs: parseDocHits(entry.docHits, entry.docTruncated),
    });
  }
  return scans;
}

// 保存した network_hits を読む。読めなければ null。
export function readNetworkScan(json: string | null): NetworkScan | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as NetworkScan;
    return Array.isArray(value.hits) ? value : null;
  } catch {
    return null;
  }
}
