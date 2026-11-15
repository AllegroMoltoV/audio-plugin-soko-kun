// GitHub REST API の呼び出し。利用者のトークンは管理権限の確認だけに使い、
// それ以外は OAuth App の認証情報で呼ぶ。認証ヘッダーはログにもレスポンスにも出さない。
import { type Budget, budgetedFetch } from './budget';
import type { ChangedFile } from './review/diff-rules';

const API = 'https://api.github.com';
// ファイルの一覧の応答の上限。大きな応答を読まずに打ち切る (読み込みの上限)。
const MAX_TREE_BYTES = 1024 * 1024;
// 変更されたファイルの一覧の応答の上限。理由はファイルの一覧と同じ。
const MAX_COMPARE_BYTES = 1024 * 1024;
// GitHub の compare が返す変更されたファイルの件数の上限。
export const MAX_COMPARE_FILES = 300;

export type GitHubAuth = { kind: 'user'; token: string } | { kind: 'app'; clientId: string; clientSecret: string };

export class GitHubError extends Error {
  constructor(
    readonly kind: 'not_found' | 'rate_limited' | 'forbidden' | 'unavailable',
    readonly status: number,
  ) {
    super(`GitHub API ${kind} (${status})`);
    this.name = 'GitHubError';
  }
}

export interface GitHubRepo {
  id: number;
  name: string;
  owner: { login: string };
  private: boolean;
  archived: boolean;
  description: string | null;
  default_branch: string;
  license: { spdx_id: string | null } | null;
  permissions?: { admin?: boolean };
}

export interface GitHubAsset {
  id: number;
  name: string;
  size: number;
  digest: string | null;
  browser_download_url: string;
  download_count?: number;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  html_url: string;
  // 不変のリリース (immutable release) のとき true。古い応答には無いことがある。
  immutable?: boolean;
  assets: GitHubAsset[];
}

function authHeader(auth: GitHubAuth): string {
  if (auth.kind === 'user') return `Bearer ${auth.token}`;
  return `Basic ${btoa(`${auth.clientId}:${auth.clientSecret}`)}`;
}

function classify(response: Response): GitHubError {
  const status = response.status;
  if (status === 404) return new GitHubError('not_found', status);
  if (status === 429 || (status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
    return new GitHubError('rate_limited', status);
  }
  if (status === 403 || status === 401) return new GitHubError('forbidden', status);
  return new GitHubError('unavailable', status);
}

// コミットの位置を調べる compare の応答の上限。
const MAX_ANCESTRY_BYTES = 64 * 1024;

export interface RulesetSnapshot {
  // 有効な ruleset のうち、詳細を読まなかったものがある。
  truncated: boolean;
  items: Array<{
    target: 'branch' | 'tag';
    include: string[];
    rules: Array<{ type: string; parameters: Record<string, unknown> }>;
  }>;
}

function readInclude(conditions: unknown): string[] {
  const include = (conditions as { ref_name?: { include?: unknown } } | null)?.ref_name?.include;
  return Array.isArray(include) ? include.filter((value): value is string => typeof value === 'string') : [];
}

// 本文を maxBytes まで読む。超えたら接続を切って null を返す。
async function readLimited(response: Response, maxBytes: number): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

const SEGMENT = /^[A-Za-z0-9._-]{1,100}$/;

function path(...segments: string[]): string {
  for (const segment of segments) {
    if (!SEGMENT.test(segment) || segment === '.' || segment === '..') throw new Error('invalid path segment');
  }
  return segments.map(encodeURIComponent).join('/');
}

export class GitHubClient {
  constructor(
    private readonly budget: Budget,
    private readonly auth: GitHubAuth,
  ) {}

  private async request(url: string, accept = 'application/vnd.github+json', etag?: string): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: accept,
      Authorization: authHeader(this.auth),
      'User-Agent': 'audio-plugin-soko-kun',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (etag) headers['If-None-Match'] = etag;
    const response = await budgetedFetch(this.budget, url, { headers });
    if (response.status === 304) return response;
    if (!response.ok) {
      await response.body?.cancel();
      throw classify(response);
    }
    return response;
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    return (await this.request(`${API}/repos/${path(owner, repo)}`)).json();
  }

  async getRepoById(id: number): Promise<GitHubRepo> {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('invalid repository id');
    return (await this.request(`${API}/repositories/${id}`)).json();
  }

  // タグの時点で GitHub が検出したライセンスの SPDX 識別子。ライセンスのファイルが無い (404) ときは null。
  async getLicenseSpdx(owner: string, repo: string, ref: string): Promise<string | null> {
    try {
      const response = await this.request(`${API}/repos/${path(owner, repo)}/license?ref=${path(ref)}`);
      const body = (await response.json()) as { license?: { spdx_id?: unknown } | null };
      const spdx = body.license?.spdx_id;
      // ファイルはあるが既知のライセンスとして識別できないものは、GitHub と同じく NOASSERTION として扱う。
      return typeof spdx === 'string' && spdx.length > 0 ? spdx : 'NOASSERTION';
    } catch (error) {
      if (error instanceof GitHubError && error.kind === 'not_found') return null;
      throw error;
    }
  }

  async getReadme(owner: string, repo: string): Promise<string | null> {
    try {
      const response = await this.request(
        `${API}/repos/${path(owner, repo)}/readme`,
        'application/vnd.github.raw+json',
      );
      return await response.text();
    } catch (error) {
      if (error instanceof GitHubError && error.kind === 'not_found') return null;
      throw error;
    }
  }

  // ETag が一致すれば null を返す。条件付き要求の 304 は GitHub のレート制限を消費しない。
  async getLatestRelease(
    owner: string,
    repo: string,
    etag?: string,
  ): Promise<{ release: GitHubRelease | null; etag: string | null } | null> {
    try {
      const response = await this.request(
        `${API}/repos/${path(owner, repo)}/releases/latest`,
        'application/vnd.github+json',
        etag,
      );
      if (response.status === 304) return null;
      return { release: await response.json(), etag: response.headers.get('ETag') };
    } catch (error) {
      if (error instanceof GitHubError && error.kind === 'not_found') return { release: null, etag: null };
      throw error;
    }
  }

  // 新しい順に最大 100 件のリリースを返す。ダウンロード数の集計に使う。
  async listReleases(owner: string, repo: string): Promise<GitHubRelease[]> {
    return (await this.request(`${API}/repos/${path(owner, repo)}/releases?per_page=100`)).json();
  }

  // ref の時点のファイルのパスの一覧を 1 回の呼び出しで返す。GitHub が一覧を切り詰めたとき、
  // または応答が上限を超えたときは truncated を true にする。ref が無ければ null を返す。
  async getTree(owner: string, repo: string, ref: string): Promise<{ paths: string[]; truncated: boolean } | null> {
    try {
      const response = await this.request(
        `${API}/repos/${path(owner, repo)}/git/trees/${encodeURIComponent(path(ref))}?recursive=1`,
      );
      if (Number(response.headers.get('Content-Length') ?? '0') > MAX_TREE_BYTES) {
        await response.body?.cancel();
        return { paths: [], truncated: true };
      }
      const body = (await response.json()) as { truncated?: boolean; tree?: Array<{ path?: string; type?: string }> };
      const paths = (body.tree ?? [])
        .filter((entry) => entry.type === 'blob' && typeof entry.path === 'string')
        .map((entry) => entry.path as string);
      return { paths, truncated: body.truncated === true };
    } catch (error) {
      if (error instanceof GitHubError && error.kind === 'not_found') return null;
      throw error;
    }
  }

  // ディレクトリが無ければ null を返す。
  async listDirectory(
    owner: string,
    repo: string,
    dir: string,
    ref: string,
  ): Promise<Array<{ name: string; sha: string; size: number; type: string }> | null> {
    try {
      const response = await this.request(
        `${API}/repos/${path(owner, repo)}/contents/${path(...dir.split('/'))}?ref=${encodeURIComponent(path(ref))}`,
      );
      const body = await response.json();
      return Array.isArray(body) ? body : null;
    } catch (error) {
      if (error instanceof GitHubError && error.kind === 'not_found') return null;
      throw error;
    }
  }

  // 上限を超える応答は読み切らずに null を返す。dir が空文字列のときは、リポジトリの直下のファイルを取得する。
  async getFileBytes(
    owner: string,
    repo: string,
    dir: string,
    file: string,
    ref: string,
    maxBytes: number,
  ): Promise<Uint8Array | null> {
    const response = await this.request(
      `${API}/repos/${path(owner, repo)}/contents/${dir ? path(...dir.split('/'), file) : path(file)}?ref=${encodeURIComponent(path(ref))}`,
      'application/vnd.github.raw+json',
    );
    const length = Number(response.headers.get('Content-Length') ?? '0');
    if (length > maxBytes) {
      await response.body?.cancel();
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length > maxBytes ? null : bytes;
  }

  // ref の時点で GitHub がリポジトリの画面に表示する README を返す。探す場所 (.github、直下、docs) と名前と拡張子は
  // GitHub が決めるため、こちらで写さない。名前を変えた README で照合を逃れられないようにするため。
  // README が無ければ null、maxBytes を超えれば 'too_large' を返す。中身は UTF-8 として読む。
  async getReadmeAt(
    owner: string,
    repo: string,
    ref: string,
    maxBytes: number,
  ): Promise<{ path: string; content: string } | 'too_large' | null> {
    let response: Response;
    try {
      response = await this.request(
        `${API}/repos/${path(owner, repo)}/readme?ref=${encodeURIComponent(path(ref))}`,
        'application/vnd.github+json',
      );
    } catch (error) {
      if (error instanceof GitHubError && error.kind === 'not_found') return null;
      throw error;
    }
    // 中身は base64 で 4/3 倍になる。JSON のほかの欄の分を足した上限で読み、超えたら読まずに打ち切る。
    const text = await readLimited(response, Math.ceil((maxBytes * 4) / 3) + 16 * 1024);
    if (text === null) return 'too_large';
    const body = JSON.parse(text) as { path?: unknown; size?: unknown; encoding?: unknown; content?: unknown };
    if (typeof body.path !== 'string' || typeof body.size !== 'number') throw new Error('unexpected readme response');
    if (body.size > maxBytes) return 'too_large';
    if (body.encoding !== 'base64' || typeof body.content !== 'string') throw new Error('unexpected readme encoding');
    const binary = atob(body.content.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return { path: body.path, content: new TextDecoder().decode(bytes) };
  }

  // ファイルが無ければ null、上限を超えれば 'too_large' を返す。文字列は UTF-8 として読む。
  async getTextFile(
    owner: string,
    repo: string,
    dir: string,
    file: string,
    ref: string,
    maxBytes: number,
  ): Promise<string | 'too_large' | null> {
    try {
      const bytes = await this.getFileBytes(owner, repo, dir, file, ref, maxBytes);
      return bytes === null ? 'too_large' : new TextDecoder().decode(bytes);
    } catch (error) {
      if (error instanceof GitHubError && error.kind === 'not_found') return null;
      throw error;
    }
  }

  // 2 つのタグの間の差分を diff の形式で受け、先頭の maxChars 文字だけを読んで接続を切る。
  // JSON の compare は大きな差分で解析の CPU 時間が 10 ms を超えるため使わない (2026-11-13 の測定)。
  async getCompareDiff(
    owner: string,
    repo: string,
    base: string,
    head: string,
    maxChars: number,
  ): Promise<{ text: string; truncated: boolean }> {
    const response = await this.request(
      `${API}/repos/${path(owner, repo)}/compare/${path(base)}...${path(head)}`,
      'application/vnd.github.diff',
    );
    const reader = response.body?.getReader();
    if (!reader) return { text: '', truncated: false };
    const decoder = new TextDecoder();
    let text = '';
    let done = false;
    while (text.length <= maxChars) {
      const chunk = await reader.read();
      if (chunk.done) {
        done = true;
        break;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    if (!done) await reader.cancel();
    return { text: text.slice(0, maxChars), truncated: !done || text.length > maxChars };
  }

  // 2 つのタグの間で変更されたファイルの一覧。差分の本文が上限を超えたときにだけ呼ぶ。
  // GitHub の compare の JSON は、変更されたファイルを比較の全体で 300 件までしか返さない
  // (https://docs.github.com/en/rest/commits/commits#compare-two-commits)。300 件に達したら、一覧は欠けているものとする。
  // 応答は各ファイルの差分の本文を含むため、CPU 時間を抑えるよう MAX_COMPARE_BYTES を超える応答は読み切らずに欠けとする。
  async getCompareFiles(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<{ files: ChangedFile[]; complete: boolean }> {
    const response = await this.request(
      `${API}/repos/${path(owner, repo)}/compare/${path(base)}...${path(head)}?per_page=1`,
    );
    if (Number(response.headers.get('Content-Length') ?? '0') > MAX_COMPARE_BYTES) {
      await response.body?.cancel();
      return { files: [], complete: false };
    }
    const text = await readLimited(response, MAX_COMPARE_BYTES);
    if (!text) return { files: [], complete: false };
    let body: { files?: unknown };
    try {
      body = JSON.parse(text);
    } catch {
      return { files: [], complete: false };
    }
    if (!Array.isArray(body.files)) return { files: [], complete: false };
    const files: ChangedFile[] = [];
    for (const item of body.files as Array<Record<string, unknown>>) {
      if (typeof item?.filename !== 'string') continue;
      const status = (typeof item.status === 'string' ? item.status : 'modified') as ChangedFile['status'];
      files.push({
        path: item.filename,
        ...(typeof item.previous_filename === 'string' ? { previousPath: item.previous_filename } : {}),
        status,
        // バイナリのファイルは patch を持たず、行の増減が 0 になる。名前だけの変更も同じ形のため除く。
        binary:
          status !== 'removed' &&
          status !== 'renamed' &&
          typeof item.patch !== 'string' &&
          item.additions === 0 &&
          item.deletions === 0,
      });
    }
    return { files, complete: files.length < MAX_COMPARE_FILES };
  }

  // コミットが既定のブランチ (HEAD) の履歴にあれば 'inside'、無ければ 'outside' を返す。
  // 既定のブランチにあるコミットの応答は commits と files が空で小さい。上限を超える応答は、
  // そのコミットにだけあるコミットを含むため、解析せずに 'outside' とする。大きな JSON の解析は CPU 時間の上限を超えるため。
  async getTagAncestry(owner: string, repo: string, commitSha: string): Promise<'inside' | 'outside'> {
    if (!/^[0-9a-f]{40}$/.test(commitSha)) throw new Error('invalid commit sha');
    const response = await this.request(`${API}/repos/${path(owner, repo)}/compare/HEAD...${commitSha}?per_page=1`);
    const text = await readLimited(response, MAX_ANCESTRY_BYTES);
    if (text === null) return 'outside';
    const status = (JSON.parse(text) as { status?: unknown }).status;
    if (status === 'behind' || status === 'identical') return 'inside';
    if (status === 'ahead' || status === 'diverged') return 'outside';
    throw new Error('unexpected compare status');
  }

  // 有効な ruleset の中身を返す。一覧から、target が branch のもの、tag のものの順に最大 maxDetails 件の詳細を読む。
  // 公開リポジトリの ruleset はトークンなしでも読める。bypass_actors は返らない。
  async getRulesets(owner: string, repo: string, maxDetails: number): Promise<RulesetSnapshot> {
    const list = (await (
      await this.request(`${API}/repos/${path(owner, repo)}/rulesets?per_page=100`)
    ).json()) as Array<{ id?: unknown; target?: unknown; enforcement?: unknown }>;
    const active = (Array.isArray(list) ? list : [])
      .filter((entry) => entry.enforcement === 'active' && Number.isSafeInteger(entry.id))
      .filter((entry) => entry.target === 'branch' || entry.target === 'tag')
      .sort((a, b) => Number(a.target === 'tag') - Number(b.target === 'tag'));
    const items: RulesetSnapshot['items'] = [];
    for (const entry of active.slice(0, maxDetails)) {
      const detail = (await (
        await this.request(`${API}/repos/${path(owner, repo)}/rulesets/${entry.id as number}`)
      ).json()) as { target?: unknown; conditions?: unknown; rules?: unknown };
      items.push({
        target: detail.target === 'tag' ? 'tag' : 'branch',
        include: readInclude(detail.conditions),
        rules: Array.isArray(detail.rules)
          ? detail.rules
              .filter(
                (rule): rule is { type: string; parameters?: Record<string, unknown> } =>
                  typeof rule === 'object' && rule !== null && typeof (rule as { type?: unknown }).type === 'string',
              )
              .map((rule) => ({ type: rule.type, parameters: rule.parameters ?? {} }))
          : [],
      });
    }
    return { truncated: active.length > maxDetails, items };
  }

  // その digest の配布物に、このリポジトリで作った証明が 1 件以上あるときに true。署名の検証はしない。
  async hasAttestation(owner: string, repo: string, digest: string): Promise<boolean> {
    if (!/^sha256:[0-9a-f]{64}$/.test(digest)) return false;
    try {
      const response = await this.request(`${API}/repos/${path(owner, repo)}/attestations/${digest}`);
      const body = (await response.json()) as { attestations?: unknown[] };
      return Array.isArray(body.attestations) && body.attestations.length > 0;
    } catch (error) {
      if (error instanceof GitHubError && error.kind === 'not_found') return false;
      throw error;
    }
  }

  async getCommitSha(owner: string, repo: string, ref: string): Promise<string> {
    const response = await this.request(`${API}/repos/${path(owner, repo)}/commits/${path(ref)}`);
    const body = (await response.json()) as { sha: string };
    return body.sha;
  }
}
