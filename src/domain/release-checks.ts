// 新しい版の検査 (docs/design/scanning.md の「新しい版の検査」)。Cron の定期処理から 1 回の起動で 1 件ずつ行う。
// 宣言ファイルとライセンスの判定、乗っ取りの兆候のルールの検査、規則と LLM による開発の実践のレビューを行い、release_checks に書く。
import { type Budget, BudgetExceededError } from '../budget';
import type { Env } from '../env';
import { GitHubClient, GitHubError } from '../github';
import { LLM_CRITERIA } from '../review/criteria';
import { type ChangedFile, checkDiff, type DiffHit, tooLargeHits } from '../review/diff-rules';
import { type Finding, runReview } from '../review/llm';
import { NETWORK_WAIT_MS, NETWORK_WAITING, readNetworkScan } from '../review/network';
import {
  clean,
  computeFacts,
  judgeByRules,
  llmFiles,
  MAX_LLM_README_CHARS,
  mergeFindings,
  networkFiles,
  type RepositorySnapshot,
} from '../review/rules';
import { getPluginViewByInternalId } from './catalog';
import { readDeclaration, settleDeclarations } from './declaration';
import { licenseAtTag } from './license';
import { MAX_REVIEW_ATTEMPTS } from './status';

// ルートのビルド系のファイル (docs/design/scanning.md の「定期処理で行う検査」の順序 5)。
export const BUILD_FILES = ['CMakeLists.txt', 'Cargo.toml', 'vcpkg.json', '.gitmodules', 'meson.build'];
const MAX_WORKFLOWS = 6;
// ruleset の詳細を読む上限。
const MAX_RULESET_DETAILS = 3;
// レビューの入力の収集の外部呼び出しの上限。ファイルの一覧 1、ワークフロー 6、README の API 1、ビルド系のファイル 5、
// CONTRIBUTING 1、PR テンプレート 1、ruleset の一覧 1 と詳細 MAX_RULESET_DETAILS の合計。
export const REVIEW_FILES_COST = 1 + MAX_WORKFLOWS + 1 + BUILD_FILES.length + 1 + 1 + 1 + MAX_RULESET_DETAILS;
// 1 件の検査の外部呼び出しの上限。宣言ファイル 1、ライセンス 1、差分 1、差分が上限を超えたときの変更されたファイルの一覧 1、
// 版のコミットの位置 1、レビューの入力の収集、LLM 1 の合計。通信の検出の結果は D1 から読むため数えない。
export const RELEASE_CHECK_COST = 6 + REVIEW_FILES_COST;
const MAX_DIFF_CHARS = 24_000;
const MAX_FILE_BYTES = 32 * 1024;
// README は no-security-bypass と no-terminal-paste が全文を照合するため、大きな上限で読む。LLM には先頭だけを渡す
// (MAX_LLM_README_CHARS)。この上限を超える README は読めなかったものとし、規則が重大の指摘にする。
const MAX_README_BYTES = 128 * 1024;
// LLM に渡すファイルの合計の上限。README は LLM に渡す分だけを数える。
const MAX_TOTAL_CHARS = 60_000;

interface PendingRow {
  github_release_id: number;
  plugin_id: string;
  owner: string;
  repo: string;
  tag: string;
  commit_sha: string;
  diff_state: string;
  license_state: string;
  config_state: string;
  config_fetched_at: string | null;
  review_state: string;
  review_attempts: number;
  network_state: string;
  network_hits: string | null;
  network_ready: number;
}

// 通信の検出の結果が届いた、または待つ期限を過ぎた。プレースホルダーには期限の時刻を 1 つ渡す。
const NETWORK_READY = `(NOT ${NETWORK_WAITING} OR r.published_at <= ?)`;

export async function runReleaseChecks(env: Env, budget: Budget): Promise<number> {
  if (!budget.canFetch(RELEASE_CHECK_COST) || !budget.canQuery(6)) return 0;
  const now = new Date();
  // 通信の検出の結果を、版の公開から NETWORK_WAIT_MS まで待つ。過ぎたら検出の結果なしでレビューする。
  const networkDeadline = new Date(now.getTime() - NETWORK_WAIT_MS).toISOString();
  budget.takeD1Query();
  const row = await env.DB.prepare(
    `SELECT c.github_release_id, r.plugin_id, p.owner, p.repo, r.tag, r.commit_sha, c.diff_state, c.license_state, c.config_state,
       c.config_fetched_at, c.review_state, c.review_attempts, c.network_state, c.network_hits,
       ${NETWORK_READY} AS network_ready
     FROM release_checks c JOIN releases r ON r.github_release_id = c.github_release_id JOIN plugins p ON p.id = r.plugin_id
     WHERE p.removed = 0 AND c.review_attempts < ? AND (c.diff_state = 'pending'
       OR c.license_state = 'pending' OR (c.config_state = 'pending' AND c.config_fetched_at IS NULL)
       OR (c.review_state IN ('pending', 'failed') AND (c.review_wait_until IS NULL OR c.review_wait_until <= ?)
         AND ${NETWORK_READY}))
     ORDER BY r.published_at LIMIT 1`,
  )
    .bind(networkDeadline, MAX_REVIEW_ATTEMPTS, now.toISOString(), networkDeadline)
    .first<PendingRow>();
  if (!row) return 0;

  const github = new GitHubClient(budget, {
    kind: 'app',
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
  });
  try {
    await checkOne(env, budget, github, row);
  } catch (error) {
    // レート制限は試行に数えず、次の起動へ回す。予算の超過も呼び出し元 (runCron) に任せる。
    if (error instanceof GitHubError && error.kind === 'rate_limited') throw error;
    if (!(error instanceof GitHubError)) throw error;
    // それ以外の GitHub の失敗 (403、5xx など) は、試行の回数を進める。unavailable はそのリポジトリだけの恒常的な失敗も含むため、
    // 数えないと同じ版が検査の先頭を占め続ける。上限に達した版は選ばれなくなり、管理者の一覧に残る。
    budget.takeD1Query();
    await env.DB.prepare(
      "UPDATE release_checks SET review_state = 'failed', review_attempts = review_attempts + 1 WHERE github_release_id = ?",
    )
      .bind(row.github_release_id)
      .run();
  }
  return 1;
}

async function checkOne(env: Env, budget: Budget, github: GitHubClient, row: PendingRow): Promise<void> {
  const statements: D1PreparedStatement[] = [];
  const update = (sql: string, ...values: unknown[]) =>
    statements.push(
      env.DB.prepare(`UPDATE release_checks SET ${sql} WHERE github_release_id = ?`).bind(
        ...values,
        row.github_release_id,
      ),
    );

  // 宣言ファイル。形の誤りはその場で invalid にし、それ以外は取得の結果を保存する。
  // 宣言と中身の検査の結果の照合は、中身の検査が終わってから settleDeclarations が行う。
  let declarationFetched = false;
  if (row.config_state === 'pending' && row.config_fetched_at === null) {
    const parsed = await readDeclaration(github, row.owner, row.repo, row.tag);
    const fetchedAt = new Date().toISOString();
    if (parsed.state === 'invalid') {
      update("config_state = 'invalid', config_fetched_at = ?", fetchedAt);
    } else {
      update(
        'config_fetched_at = ?, config_json = ?',
        fetchedAt,
        parsed.state === 'parsed' ? JSON.stringify(parsed.declaration) : null,
      );
      declarationFetched = true;
    }
  }

  // ライセンス。版のタグの時点で判定する。
  if (row.license_state === 'pending') {
    const license = await licenseAtTag(github, row.owner, row.repo, row.tag);
    update('license_state = ?, license_spdx = ?', license.state, license.spdx);
  }

  // 差分の起点は、その時点の掲載対象のリリース。掲載中の版が無ければ、差分の検査を当てない。
  // 版のコミットが既定のブランチにあるかは、掲載中の版の有無にかかわらず確かめる。
  let diff: string | null = null;
  let diffFacts: string[] = [];
  let names = [row.repo];
  if (row.diff_state === 'pending' || row.review_state !== 'done') {
    budget.takeD1Query();
    const view = await getPluginViewByInternalId(env, row.plugin_id);
    if (view && view.name !== row.repo) names = [row.repo, view.name];
    const base = view?.listedRelease ?? null;
    try {
      const hits: DiffHit[] = [];
      let compared = false;
      if (base && base.tag !== row.tag) {
        const result = await github.getCompareDiff(row.owner, row.repo, base.tag, row.tag, MAX_DIFF_CHARS);
        diff = result.text;
        hits.push(...checkDiff(result.text, row.owner, row.repo));
        if (result.truncated) {
          const listed = await changedFiles(github, row.owner, row.repo, base.tag, row.tag);
          const tooLarge = tooLargeHits(listed.files, listed.complete);
          hits.push(...tooLarge);
          diffFacts = tooLargeFacts(listed.files, listed.complete, tooLarge);
        }
        compared = true;
      }
      if (row.diff_state === 'pending') {
        // タグの名前ではなく、証明と結び付いた版のコミットで比べる。タグと同じ名前のブランチで判定を変えられないようにするため。
        if ((await github.getTagAncestry(row.owner, row.repo, row.commit_sha)) === 'outside') {
          hits.push({ rule: 'tag-not-on-default-branch' });
        }
        const state = hits.length > 0 ? 'held' : compared ? 'passed' : 'skipped';
        update('diff_state = ?, diff_hits = ?', state, JSON.stringify(hits));
      }
    } catch (error) {
      // 予算の超過を差分の失敗として記録しない。打ち切って次の起動でやり直す。
      if (error instanceof BudgetExceededError) throw error;
      if (error instanceof GitHubError && (error.kind === 'rate_limited' || error.kind === 'unavailable')) throw error;
      if (row.diff_state === 'pending') update('diff_state = ?', 'error');
    }
  }

  // LLM のレビュー
  // 通信の検出の結果を待つ間は、宣言ファイル・ライセンス・差分の検査だけを進める。
  if (row.review_state !== 'done' && row.network_ready === 1) {
    const input = await collectReviewFiles(github, row.owner, row.repo, row.tag);
    input.network = row.network_state === 'done' ? readNetworkScan(row.network_hits) : null;
    const outcome = await reviewRepository(env, budget, `${row.owner}/${row.repo}`, input, diff, {
      names,
      diffFacts,
    });
    if (outcome.kind === 'done') {
      const findings = outcome.findings;
      const serious = findings.filter((finding) => finding.serious).length;
      update(
        "review_state = 'done', review_attempts = review_attempts + 1, review_json = ?, review_serious = ?, reviewed_at = ?",
        JSON.stringify({ findings, unreadFiles: input.unreadFiles }),
        serious,
        new Date().toISOString(),
      );
    } else if (outcome.kind === 'quota') {
      update('review_wait_until = ?', quotaRetryAt());
    } else if (outcome.kind === 'failed') {
      update("review_state = 'failed', review_attempts = review_attempts + 1");
    }
  }

  if (statements.length > 0) {
    budget.takeD1Query();
    await env.DB.batch(statements);
  }
  if (declarationFetched) await settleDeclarations(env, [row.github_release_id], budget);
}

// 変更されたファイルの一覧。レート制限と予算の超過は呼び出し側へ投げ、それ以外の失敗は一覧を取り切れなかったものとして扱う。
// 大きな比較で GitHub が 5xx を返し続けても、版を確認待ちにして検査を先へ進めるため。
async function changedFiles(
  github: GitHubClient,
  owner: string,
  repo: string,
  base: string,
  head: string,
): Promise<{ files: ChangedFile[] | null; complete: boolean }> {
  try {
    return await github.getCompareFiles(owner, repo, base, head);
  } catch (error) {
    if (error instanceof BudgetExceededError) throw error;
    if (error instanceof GitHubError && error.kind === 'rate_limited') throw error;
    return { files: null, complete: false };
  }
}

// LLM に渡す、差分が上限を超えたときの事実。確認待ちはこの事実でルールが決め、LLM の判定では外さない。
export function tooLargeFacts(files: ChangedFile[] | null, complete: boolean, hits: DiffHit[]): string[] {
  const paths = (fact: string) =>
    hits
      .filter((hit) => hit.fact === fact && hit.file)
      .map((hit) => clean(hit.file ?? ''))
      .join(', ') || 'none';
  return [
    `Diff truncated: yes (only the first ${MAX_DIFF_CHARS.toLocaleString('en-US')} characters are given)`,
    `Changed files listed: ${files?.length ?? 0} (list complete: ${complete && files !== null ? 'yes' : 'no'})`,
    `Changed files under .github/: ${paths('github-changed')}`,
    `Changed build scripts: ${paths('build-script-changed')}`,
    `Binary files added or changed: ${paths('binary-added')}`,
    `Held for an administrator by these facts (decided by the catalog, not by this review): ${hits.length > 0 ? 'yes' : 'no'}`,
  ];
}

export type CollectedFiles = RepositorySnapshot;

// ファイルの一覧から、規則と LLM が読むファイルを決めて取得する。一覧に無いファイルは取得しない。
export async function collectReviewFiles(
  github: GitHubClient,
  owner: string,
  repo: string,
  ref: string,
): Promise<CollectedFiles> {
  const tree = await github.getTree(owner, repo, ref);
  // 一覧を得られないときは、ファイルの有無を判定できないものとして扱う。
  const paths = tree?.paths ?? [];
  const truncated = tree === null || tree.truncated;
  const files: CollectedFiles['files'] = [];
  const unreadFiles: string[] = [];
  let total = 0;
  const fetch = async (path: string) => {
    const slash = path.lastIndexOf('/');
    let text: string | 'too_large' | null;
    try {
      text = await github.getTextFile(
        owner,
        repo,
        slash < 0 ? '' : path.slice(0, slash),
        path.slice(slash + 1),
        ref,
        MAX_FILE_BYTES,
      );
    } catch (error) {
      // 取得の関数が受け付けない文字を含むパスは、読まずに未読として記録する。予算の超過は未読として記録しない。
      if (error instanceof GitHubError || error instanceof BudgetExceededError) throw error;
      unreadFiles.push(path);
      return;
    }
    if (text === null) return;
    if (text === 'too_large' || total + text.length > MAX_TOTAL_CHARS) {
      unreadFiles.push(path);
      return;
    }
    total += text.length;
    files.push({ path, content: text });
  };
  // README は GitHub がリポジトリの画面に表示するものを最初に取得する。名前を変えた README と、先に読むファイルで
  // 合計の上限を使い切ることで、README の照合を逃れられないようにするため。合計には LLM に渡す分だけを数える。
  let readmePath: string | null = null;
  let readmeUnread = false;
  try {
    const readme = await github.getReadmeAt(owner, repo, ref, MAX_README_BYTES);
    if (readme === 'too_large') readmeUnread = true;
    else if (readme) {
      readmePath = readme.path;
      files.push(readme);
      total += Math.min(readme.content.length, MAX_LLM_README_CHARS);
    }
  } catch (error) {
    if (error instanceof GitHubError || error instanceof BudgetExceededError) throw error;
    readmeUnread = true;
  }
  if (readmeUnread) unreadFiles.push('README');
  const plan = reviewFilePlan(paths);
  for (const path of plan.fetch) await fetch(path);
  unreadFiles.push(...plan.skipped);
  let rulesets: CollectedFiles['rulesets'];
  try {
    rulesets = { readable: true, ...(await github.getRulesets(owner, repo, MAX_RULESET_DETAILS)) };
  } catch (error) {
    if (error instanceof BudgetExceededError) throw error;
    if (error instanceof GitHubError && (error.kind === 'rate_limited' || error.kind === 'unavailable')) throw error;
    rulesets = { readable: false };
  }
  return { paths, truncated, files, unreadFiles, rulesets, readmePath, readmeUnread };
}

// 取得するファイルの順番と、上限で読まないファイル。上限は REVIEW_FILES_COST の内訳に合わせる。
export function reviewFilePlan(paths: string[]): { fetch: string[]; skipped: string[] } {
  const sorted = [...paths].sort();
  const workflows = sorted.filter((path) => /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(path));
  const first = (candidates: string[]) => candidates.filter((path) => paths.includes(path)).slice(0, 1);
  // README は collectReviewFiles が GitHub の README の API で先に取得するため、ここには含めない。
  const fetch = [
    ...workflows.slice(0, MAX_WORKFLOWS),
    ...BUILD_FILES.filter((path) => paths.includes(path)),
    ...first(['CONTRIBUTING.md', '.github/CONTRIBUTING.md']),
    ...first(['.github/PULL_REQUEST_TEMPLATE.md', '.github/pull_request_template.md']),
  ];
  return { fetch, skipped: workflows.slice(MAX_WORKFLOWS) };
}

// 規則の判定、事実の計算、LLM の呼び出し、結果のまとめを行う。新しい版の検査、確認のモード、手元の確認が同じ関数を呼ぶ。
export async function reviewRepository(
  env: Env,
  budget: Budget,
  repository: string,
  collected: CollectedFiles,
  diff: string | null,
  // names はリポジトリ名と表示名。diffFacts は差分が上限を超えたときの事実の行。
  context: { names?: string[]; diffFacts?: string[] } = {},
): Promise<ReviewOutcome> {
  // テストの環境には Workers AI が無い。レビューできない版は失敗として記録し、管理者の判断に回る。
  if (!env.AI) return { kind: 'failed' };
  const ruled = judgeByRules(collected, context.names ?? [repository.slice(repository.indexOf('/') + 1)]);
  budget.takeSubrequest();
  try {
    const review = await runReview(
      env.AI,
      {
        repository,
        files: llmFiles(collected),
        unreadFiles: collected.unreadFiles,
        facts: computeFacts(collected, ruled, context.diffFacts),
        criteria: LLM_CRITERIA.map((criterion) => criterion.id),
        sourceFiles: networkFiles(collected),
        diff,
      },
      env.AI_GATEWAY_ID,
    );
    return review ? { kind: 'done', findings: mergeFindings(ruled, review.findings) } : { kind: 'failed' };
  } catch (error) {
    const outcome = classifyAiError(error);
    // 例外の形は本番で確かめる (3036 を binding で受けた実例はまだ無い)。
    console.log(JSON.stringify({ event: 'review_error', outcome: outcome.kind, message: String(error).slice(0, 200) }));
    return outcome;
  }
}

export type ReviewOutcome =
  | { kind: 'done'; findings: Finding[] }
  | { kind: 'failed' }
  // 無料枠の不足 (4006 か 3036) と AI Gateway の支出の上限 (2045)。試行に数えず、quotaRetryAt の時刻まで待つ。
  | { kind: 'quota' }
  // 一時的な混雑 (3040)。試行に数えず、次の起動でやり直す。
  | { kind: 'busy' };

// Workers AI の例外のメッセージ (AiError: <コード>: <説明>) からコードを取り出して分ける。
// 無料枠の不足は、2026-11-13 に binding で実際に受けた例外が 4006 だった。公式の文書の表は 3036 と書くため、両方を見る。
// 2045 は AI Gateway の支出の上限で断られたときのコード (2026-11-15 に派生元で受けた実例: AiGatewayError: 2045: Spend limit exceeded ...)。
// 上限の期間が過ぎれば通るため、無料枠の不足と同じく待つ。
// コードを取り出せない例外は、今までどおり失敗として数える。外れても前の版の掲載が続き、管理者の確認に回るだけで済むため。
const QUOTA_CODES = new Set(['4006', '3036', '2045']);

export function classifyAiError(error: unknown): ReviewOutcome {
  const code = /\b(\d{4}):/.exec(String(error))?.[1];
  if (code && QUOTA_CODES.has(code)) return { kind: 'quota' };
  if (code === '3040') return { kind: 'busy' };
  return { kind: 'failed' };
}

// 無料枠の不足のあと、次にレビューを試す時刻。
// 公式の文書は 00:00 UTC に戻ると書くが、2026-11-14 には 00:00 UTC を過ぎても不足と返り続けた
// (docs/design/scanning.md の順序 7)。戻る時刻を決め打ちせず、1 時間ごとにやり直す。失敗した呼び出しは Neurons を使わない。
const QUOTA_RETRY_MS = 60 * 60 * 1000;

export function quotaRetryAt(now = new Date()): string {
  return new Date(now.getTime() + QUOTA_RETRY_MS).toISOString();
}
