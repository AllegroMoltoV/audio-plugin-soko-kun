// submit_plugin の処理。検証を通ったリポジトリを検査待ちで登録し、検査は Cron で進める。
import { Budget } from '../budget';
import type { Env } from '../env';
import {
  type GitHubAsset,
  GitHubClient,
  GitHubError,
  type GitHubRelease,
  type GitHubRepo,
  TARBALL_COST,
} from '../github';
import { scanDocsForCheck } from '../review/check-docs';
import { CRITERIA_BY_ID, referenceOf } from '../review/criteria';
import type { Finding } from '../review/llm';
import { NOTICE_TEXT, type ReviewSummary, reviewView } from './author';
import { resetAttestationStatement, resetContentStatements, resetScanStatements } from './cron';
import { CONFIG_DIR, type Pricing, readDeclaration } from './declaration';
import { type LicenseFailure, licenseAtCommit } from './license';
import { assetKind, summarizeReadme } from './metadata';
import {
  collectReviewFiles,
  quotaRetryAt,
  REVIEW_FILES_COST,
  type ReviewOutcome,
  reviewRepository,
} from './release-checks';
import { releaseNotesStatement } from './release-notes';

export const SUBMITS_PER_DAY = 10;

export type SubmitErrorCode =
  | 'invalid_url'
  | 'rate_limited'
  | 'not_found'
  | 'not_admin'
  | 'private_repository'
  | 'archived_repository'
  | 'no_release'
  | 'no_verifiable_asset'
  | 'unsupported_tag'
  | LicenseFailure
  | 'not_immutable'
  | 'no_archive'
  | 'no_attestation'
  | 'duplicate'
  | 'name_reserved'
  | 'github_unavailable';

export type SubmitResult =
  | { ok: true; pluginId: string; status: 'pending'; detailUrl: string; assetsToScan: number; note: string }
  | { ok: false; code: SubmitErrorCode; message: string; fix: string; resumesAt?: string };

export interface Submitter {
  githubUserId: number;
  githubToken: string;
}

const REPO_URL = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9._-]{1,100})\/?$/;
const TAG = /^[A-Za-z0-9._-]{1,100}$/;

export function parseRepositoryUrl(input: string): { owner: string; repo: string } | null {
  const match = REPO_URL.exec(input.trim());
  if (!match) return null;
  const owner = match[1] as string;
  const repo = (match[2] as string).replace(/\.git$/, '');
  if (repo === '.' || repo === '..' || repo.length === 0) return null;
  return { owner, repo };
}

const fail = (code: SubmitErrorCode, message: string, fix: string): SubmitResult => ({ ok: false, code, message, fix });

function now(): string {
  return new Date().toISOString();
}

async function logAttempt(env: Env, userId: number, outcome: string): Promise<void> {
  await env.DB.prepare('INSERT INTO submit_log (github_user_id, created_at, outcome) VALUES (?, ?, ?)')
    .bind(userId, now(), outcome)
    .run();
}

export async function submitPlugin(env: Env, submitter: Submitter, repositoryUrl: string): Promise<SubmitResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const count = await env.DB.prepare('SELECT count(*) AS n FROM submit_log WHERE github_user_id = ? AND created_at > ?')
    .bind(submitter.githubUserId, since)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= SUBMITS_PER_DAY) {
    return fail(
      'rate_limited',
      `You can submit up to ${SUBMITS_PER_DAY} repositories per 24 hours.`,
      'Wait and try again later.',
    );
  }

  const result = await validateAndStore(env, submitter, repositoryUrl);
  await logAttempt(env, submitter.githubUserId, result.ok ? 'accepted' : result.code);
  return result;
}

export type ConditionCode =
  | 'not_admin'
  | 'private_repository'
  | 'archived_repository'
  | 'no_release'
  | 'no_verifiable_asset'
  | 'unsupported_tag'
  | LicenseFailure
  | 'not_immutable'
  | 'no_archive'
  | 'no_attestation';

// 確認のモードで、判定せずに説明だけを返す条件。配布物の取得を伴い、GitHub Actions で行うため。
export type DeferredConditionCode = 'plugin_content' | 'macos_signing';

export interface Condition<Code = ConditionCode> {
  code: Code;
  result: 'passed' | 'failed' | 'unchecked';
  message?: string;
  fix?: string;
}

interface Evaluated {
  conditions: Condition[];
  repo: GitHubRepo;
  release: GitHubRelease | null;
  assets: GitHubAsset[];
  etag: string | null;
  // タグが指すコミット。ライセンスの判定と保存に使う。
  commitSha: string | null;
  // タグが指すコミットの時点で GitHub が検出したライセンス。保存に使う。
  licenseSpdx: string | null;
}

// 1 回の登録で証明の有無を確かめる配布物の上限。外部呼び出しの予算に収めるため。
export const MAX_SUBMIT_ASSETS = 30;

const MESSAGES: Record<ConditionCode, { message: string; fix: string }> = {
  not_admin: {
    message: 'You do not have admin permission on this repository.',
    fix: 'Ask an administrator of the repository to submit it.',
  },
  private_repository: { message: 'The repository is private.', fix: 'Make the repository public, then submit again.' },
  archived_repository: { message: 'The repository is archived.', fix: 'Unarchive the repository, then submit again.' },
  no_release: {
    message: 'The repository has no published release.',
    fix: 'Publish a release on GitHub with the plugin files attached.',
  },
  no_verifiable_asset: {
    message: `The latest release has no files with a SHA-256 digest from GitHub, or more than ${MAX_SUBMIT_ASSETS} files.`,
    fix: `Attach the plugin files (up to ${MAX_SUBMIT_ASSETS}) to the release. GitHub records a digest for uploaded files.`,
  },
  unsupported_tag: {
    message: 'The release tag contains unsupported characters.',
    fix: 'Use a tag made of letters, digits, dot, hyphen, and underscore.',
  },
  no_license: {
    message: 'GitHub finds no license file at the release tag.',
    fix: 'Put a LICENSE file with an open source license at the root of the repository, then publish a new release.',
  },
  license_unrecognized: {
    message: 'GitHub cannot identify the license at the release tag (NOASSERTION).',
    fix: 'Keep only the standard license text in LICENSE. Move copyright preambles, third-party notices, and asset licenses to NOTICE or README, then publish a new release.',
  },
  license_not_open: {
    message: 'The license at the release tag is neither OSI approved nor FSF free (SPDX License List).',
    fix: 'License the plugin under an OSI approved or FSF free license, then publish a new release.',
  },
  not_immutable: {
    message: 'The latest release is not immutable.',
    fix: `${criterionFix('immutable-release')} See ${referenceOf('immutable-release')}`,
  },
  no_archive: {
    message: 'The latest release has no zip archive. Installers and other files are not guided.',
    fix: 'Attach the plugin bundles as zip archives to the release.',
  },
  no_attestation: {
    message: 'Some release files have no build provenance attestation. Installers need attestations too.',
    fix: `${criterionFix('attestation')} See ${referenceOf('attestation')}`,
  },
};

const DEFERRED: Condition<DeferredConditionCode>[] = [
  {
    code: 'plugin_content',
    result: 'unchecked',
    message:
      'After registration, every zip archive is inspected for VST 3, CLAP, LV2, or Audio Unit bundles. Archives with a VST 2 entry point, or with installers or nested archives inside, block the version.',
  },
  {
    code: 'macos_signing',
    result: 'unchecked',
    message:
      'After registration, macOS bundles must be signed with a Developer ID and notarized by Apple. Archives that fail are not guided.',
  },
];

function criterionFix(id: string): string {
  return CRITERIA_BY_ID.get(id)?.fix ?? '';
}

function condition(code: ConditionCode, passed: boolean): Condition {
  return passed ? { code, result: 'passed' } : { code, result: 'failed', ...MESSAGES[code] };
}

// リリースが無いと判定できない条件。確認のモードで、リリースの前に直し方を示す。
const RELEASE_CONDITIONS: ConditionCode[] = [
  'not_immutable',
  'no_verifiable_asset',
  'unsupported_tag',
  'no_license',
  'no_archive',
  'no_attestation',
];

// リリースの前の確認で、未判定の条件に付ける説明。不変のリリースは公開の後に直せないため、公開の前の確かめ方を書く。
// リポジトリの設定を読む API は管理者の読み取りの権限を求め、本サービスのサインインはスコープを求めないため使わない。
function beforeRelease(code: ConditionCode): Condition {
  if (code === 'not_immutable') {
    return {
      code,
      result: 'unchecked',
      message:
        'There is no release yet. The first release must be an immutable release, which cannot be changed after it is published.',
      fix: 'Before you publish, turn on immutable releases in the repository settings. You can confirm it with: gh api repos/<owner>/<repository>/immutable-releases (it should show "enabled": true). Attach all files to a draft release first, then publish it, because files cannot be added after publishing.',
    };
  }
  return {
    code,
    result: 'unchecked',
    message: 'There is no release yet, so this condition was not checked.',
    fix: MESSAGES[code].fix,
  };
}

// 掲載の条件を順に判定する。リポジトリを取得できない、または管理者でないときは、そこで止める。
// stopOnFailure のときは、最初に満たさなかった条件で止める (登録)。そうでなければ、判定できる条件をすべて判定する (確認のモード)。
async function evaluateConditions(
  asUser: GitHubClient,
  asApp: GitHubClient,
  parsed: { owner: string; repo: string },
  stopOnFailure: boolean,
): Promise<Evaluated> {
  const conditions: Condition[] = [];
  const done = () => stopOnFailure && conditions.some((item) => item.result === 'failed');
  // 管理権限は利用者のトークンで確かめる。permissions は認証した利用者から見た権限を表す。
  const repo = await asUser.getRepo(parsed.owner, parsed.repo);
  const evaluated: Evaluated = {
    conditions,
    repo,
    release: null,
    assets: [],
    etag: null,
    commitSha: null,
    licenseSpdx: null,
  };
  conditions.push(condition('not_admin', repo.permissions?.admin === true));
  if (done() || repo.permissions?.admin !== true) return evaluated;
  conditions.push(condition('private_repository', !repo.private));
  if (done()) return evaluated;
  conditions.push(condition('archived_repository', !repo.archived));
  if (done()) return evaluated;
  const owner = repo.owner.login;
  const name = repo.name;
  const latest = await asApp.getLatestRelease(owner, name);
  const release = latest?.release ?? null;
  const published = release !== null && !release.draft && Boolean(release.published_at);
  conditions.push(condition('no_release', published));
  if (!published || !release) {
    // 確認のモードでは、リリースを要る残りの条件を未判定として直し方とともに返す。
    // 不変のリリースは公開の後に直せないため、作者が公開の前に条件を知れるようにする。
    if (!stopOnFailure) conditions.push(...RELEASE_CONDITIONS.map(beforeRelease));
    return evaluated;
  }
  evaluated.release = release;
  evaluated.etag = latest?.etag ?? null;
  const assets = release.assets.filter((asset) => asset.digest?.startsWith('sha256:'));
  evaluated.assets = assets;
  conditions.push(condition('no_verifiable_asset', assets.length > 0 && assets.length <= MAX_SUBMIT_ASSETS));
  if (done()) return evaluated;
  const tagValid = TAG.test(release.tag_name);
  conditions.push(condition('unsupported_tag', tagValid));
  if (done()) return evaluated;
  // ライセンスは最新のリリースのタグが指すコミットの時点で判定する。タグ名が規則に合わなければ取得しない。
  // タグの短い名前は同じ名前のブランチに解決されうるため、先にタグの完全な参照からコミットを解決する。
  if (tagValid) {
    evaluated.commitSha = await asApp.getCommitSha(owner, name, release.tag_name);
    const license = await licenseAtCommit(asApp, owner, name, evaluated.commitSha);
    evaluated.licenseSpdx = license.spdx;
    conditions.push(
      license.state === 'passed' ? { code: 'no_license', result: 'passed' } : condition(license.state, false),
    );
  } else {
    conditions.push({ code: 'no_license', result: 'unchecked' });
  }
  if (done()) return evaluated;
  conditions.push(condition('not_immutable', release.immutable === true));
  if (done()) return evaluated;
  conditions.push(
    condition(
      'no_archive',
      assets.some((asset) => assetKind(asset.name) === 'archive'),
    ),
  );
  if (done()) return evaluated;
  if (assets.length === 0 || assets.length > MAX_SUBMIT_ASSETS) {
    conditions.push({ code: 'no_attestation', result: 'unchecked' });
    return evaluated;
  }
  // 証明は、案内しないインストーラーと other の配布物を含むすべての配布物に求める (ADR 0003)。
  let attested = true;
  for (const asset of assets) {
    if (!(await asApp.hasAttestation(owner, name, asset.digest as string))) {
      attested = false;
      break;
    }
  }
  conditions.push(condition('no_attestation', attested));
  return evaluated;
}

function githubFailure(error: unknown): SubmitResult {
  if (error instanceof GitHubError) {
    if (error.kind === 'not_found') {
      return fail(
        'not_found',
        'The repository was not found on GitHub.',
        'Check the URL and that the repository is public.',
      );
    }
    return fail('github_unavailable', 'GitHub is not available right now.', 'Try again in a few minutes.');
  }
  throw error;
}

function clients(env: Env, submitter: Submitter, budget: Budget) {
  return {
    asUser: new GitHubClient(budget, { kind: 'user', token: submitter.githubToken }),
    asApp: new GitHubClient(budget, {
      kind: 'app',
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    }),
  };
}

const INVALID_URL = (): SubmitResult =>
  fail(
    'invalid_url',
    'The repository URL is not a GitHub repository URL.',
    'Use the form https://github.com/<owner>/<repository>.',
  );

async function validateAndStore(env: Env, submitter: Submitter, repositoryUrl: string): Promise<SubmitResult> {
  const parsed = parseRepositoryUrl(repositoryUrl);
  if (!parsed) return INVALID_URL();
  const budget = new Budget();
  const { asUser, asApp } = clients(env, submitter, budget);
  try {
    const evaluated = await evaluateConditions(asUser, asApp, parsed, true);
    const failed = evaluated.conditions.find((item) => item.result === 'failed');
    if (failed) return fail(failed.code, failed.message ?? '', failed.fix ?? '');
    const { repo, release, assets, commitSha, licenseSpdx } = evaluated;
    if (!release || !commitSha || !licenseSpdx)
      return fail('no_release', MESSAGES.no_release.message, MESSAGES.no_release.fix);

    const duplicate = await env.DB.prepare('SELECT id FROM plugins WHERE github_repo_id = ?')
      .bind(repo.id)
      .first<{ id: string }>();
    if (duplicate) {
      return fail('duplicate', 'The repository is already registered.', `See the existing entry: ${duplicate.id}`);
    }
    // 名前を変えたプラグインの旧い名前を、別のリポジトリに使わせない。旧い URL の行き先を変えないため (派生元の ADR 0015)。
    const slug = `${repo.owner.login}/${repo.name}`.toLowerCase();
    const reserved = await env.DB.prepare(
      'SELECT 1 FROM plugins WHERE id = ? UNION ALL SELECT 1 FROM plugin_aliases WHERE alias = ? LIMIT 1',
    )
      .bind(slug, slug)
      .first();
    if (reserved) {
      return fail(
        'name_reserved',
        'Another listed plugin used this repository name before it was renamed, so this name cannot be registered.',
        'Rename the repository to a name that no listed plugin has used, then submit it again.',
      );
    }

    const owner = repo.owner.login;
    const name = repo.name;
    const summary = repo.description?.trim() || summarizeReadme((await asApp.getReadme(owner, name)) ?? '');

    const pluginId = `${owner}/${name}`.toLowerCase();
    const timestamp = now();
    const statements: D1PreparedStatement[] = [
      env.DB.prepare(
        `INSERT INTO plugins (id, github_repo_id, owner, repo, summary, license_spdx, category, submitter_github_id,
           releases_etag, created_at, updated_at, last_synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        pluginId,
        repo.id,
        owner,
        name,
        summary,
        licenseSpdx,
        // カテゴリは、中身の検査と宣言ファイルの照合を終えたときに決める (declaration.ts)。それまでは utility。
        'utility',
        submitter.githubUserId,
        evaluated.etag,
        timestamp,
        timestamp,
        timestamp,
      ),
      env.DB.prepare(
        'INSERT INTO releases (github_release_id, plugin_id, tag, name, commit_sha, published_at, html_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).bind(release.id, pluginId, release.tag_name, release.name, commitSha, release.published_at, release.html_url),
      // ライセンスは登録の判定で済ませたため、新しい版の検査では取得し直さない。
      env.DB.prepare(
        "INSERT INTO release_checks (github_release_id, immutable, license_state, license_spdx) VALUES (?, ?, 'passed', ?)",
      ).bind(release.id, release.immutable === true ? 1 : 0, licenseSpdx),
      // 登録の時点の版のリリースノートも照合する。結果は新しい版の検査のレビューで使う。
      await releaseNotesStatement(env.DB, release.id, release.body),
    ];
    for (const asset of assets) {
      const kind = assetKind(asset.name);
      statements.push(
        env.DB.prepare(
          'INSERT INTO assets (github_asset_id, release_id, name, size, digest, download_url, kind) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).bind(asset.id, release.id, asset.name, asset.size, asset.digest, asset.browser_download_url, kind),
      );
      statements.push(...resetScanStatements(env, asset.digest as string));
      statements.push(resetAttestationStatement(env, asset.id));
      statements.push(...resetContentStatements(env, asset.id, kind));
    }
    // 1 回の batch は D1 のクエリ 1 件として数えられ、途中で失敗しても部分的な書き込みが残らない。
    await env.DB.batch(statements);

    return {
      ok: true,
      pluginId,
      status: 'pending',
      detailUrl: `${env.ORIGIN}/plugins/${pluginId}`,
      assetsToScan: assets.length,
      note: 'The plugin page at detailUrl is published after the checks pass, usually within a few hours. Until then it returns 404. Call list_my_plugins to see the progress.',
    };
  } catch (error) {
    return githubFailure(error);
  }
}

export const CHECKS_PER_DAY = 5;

// 作者向けの最重要の文 (本家と共通)。掲載するとファイルは誰でも無料で入手でき、コードはライセンスにしたがって
// 誰でも商用利用・再配布できる。作者が意図しない形の商用利用を、掲載の後に取り消せないため、作者が読む文の先頭に置く。
export const AUTHOR_KEY_POINT =
  'When your plugin is listed on this platform, anyone can download its files from GitHub for free, and anyone can use and redistribute its code commercially under the conditions of its license. Income from sales is limited to selling or support outside this platform on that basis. If you want to earn only by selling the files, or to restrict commercial use, your plugin is not eligible for listing. If bundled assets restrict commercial use, declare restrictedAssets in .audio-soko-kun/config.json. Without the declaration, the plugin is shown as OK for commercial use. If your plugin has paid features or needs paid services the user subscribes to separately, declare paidFeatures and paidServices in .audio-soko-kun/config.json. Without the declaration, the plugin is shown as free.';

// 確認のモードで返す .audio-soko-kun/config.json の判定。宣言は任意のため、無いこと (missing) は誤りではない。
export interface ConfigCheck {
  result: 'ok' | 'missing' | 'invalid' | 'unchecked';
  message?: string;
  fix?: string;
  // 申告の形の誤り。掲載は止めない。固定のコードと固定の文言だけで、作者の文字列を入れない。
  notices?: Array<{ code: string; message: string; fix: string; waitsFor: 'author' }>;
}

const CONFIG_PATH = `${CONFIG_DIR}/config.json`;
const CONFIG_FIX = `Write a JSON object such as {"name": "<display name, 1-60 characters>"}. Every field is optional. "category" must be one of instrument, effect, analyzer, midi, utility. Each entry of "assets" needs "pattern", "os", "arch", and "formats". Optional declarations: "paidFeatures" (true or false), "paidServices" (names of paid services, [] for none), "restrictedAssets" (true or false), and "supportUrl" (an https URL on booth.pm, gumroad.com, itch.io, patreon.com, ko-fi.com, or github.com/sponsors/<name>); a wrong value there only drops that declaration and does not stop listing. Commit ${CONFIG_PATH} before you tag the release, because the catalog reads the file at the release tag.`;

// 既定のブランチの宣言ファイルの形を確かめる。宣言した配布物と、アーカイブの中身の検査の結果の照合は、
// 中身の検査 (GitHub Actions) を終えた版でしか行えないため、確認のモードでは形 (ok・missing・invalid) だけを返す。
// pricing は、レビューの事実の行に渡す申告。応答には含めない (作者の文字列のため)。
async function checkConfig(
  github: GitHubClient,
  owner: string,
  repo: string,
  ref: string,
): Promise<{ check: ConfigCheck; pricing: Pricing | null }> {
  let parsed: Awaited<ReturnType<typeof readDeclaration>>;
  try {
    parsed = await readDeclaration(github, owner, repo, ref);
  } catch (error) {
    if (error instanceof GitHubError && error.kind !== 'rate_limited' && error.kind !== 'unavailable') {
      return { check: { result: 'unchecked' }, pricing: null };
    }
    throw error;
  }
  if (parsed.state === 'missing') {
    return {
      check: {
        result: 'missing',
        message: `The default branch has no ${CONFIG_PATH}. The declaration is optional: without it, the catalog shows the repository name and decides the category from the plugin bundles, or uses utility, and shows paid features, paid services, and restricted assets as not declared by the author.`,
        fix: CONFIG_FIX,
      },
      pricing: null,
    };
  }
  if (parsed.state === 'invalid') {
    return {
      check: { result: 'invalid', message: `${CONFIG_PATH} on the default branch is not valid.`, fix: CONFIG_FIX },
      pricing: null,
    };
  }
  const notices = parsed.declaration.notices.map((code) => ({
    code,
    ...NOTICE_TEXT[code],
    waitsFor: 'author' as const,
  }));
  return {
    check: {
      result: 'ok',
      message: `${CONFIG_PATH} on the default branch is valid. Declared assets are compared with the archive contents only when a release is checked.`,
      ...(notices.length > 0 ? { notices } : {}),
    },
    pricing: parsed.declaration.pricing,
  };
}

export type CheckResult =
  | SubmitResult
  | {
      ok: boolean;
      mode: 'check';
      // conditions の前に置く作者向けの最重要の文。欄の名前は本家と同じ。
      important: string;
      conditions: Condition<ConditionCode | DeferredConditionCode>[];
      config: ConfigCheck;
      review: { status: 'done' | 'failed' | 'unavailable'; message?: string; resumesAt?: string } & ReviewSummary;
    };

// 確認のモード。登録せず、掲載の条件と、既定のブランチの最新のコミットのレビューを返す (docs/design/author-feedback.md)。
export async function checkPlugin(env: Env, submitter: Submitter, repositoryUrl: string): Promise<CheckResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const count = await env.DB.prepare('SELECT count(*) AS n FROM check_log WHERE github_user_id = ? AND created_at > ?')
    .bind(submitter.githubUserId, since)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= CHECKS_PER_DAY) {
    // 次に使える時刻は、枠の中の利用を新しい順に並べた CHECKS_PER_DAY 番目の 24 時間後。
    // 同時の要求で枠に上限を超える件数が入っても、その時刻には件数が上限を下回る。
    const nth = await env.DB.prepare(
      'SELECT created_at FROM check_log WHERE github_user_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1 OFFSET ?',
    )
      .bind(submitter.githubUserId, since, CHECKS_PER_DAY - 1)
      .first<{ created_at: string }>();
    const resumesAt = nth ? new Date(Date.parse(nth.created_at) + 24 * 60 * 60 * 1000).toISOString() : undefined;
    return {
      ok: false,
      code: 'rate_limited',
      message: `You can use the check mode up to ${CHECKS_PER_DAY} times per 24 hours for each GitHub account.`,
      fix: 'Try again after resumesAt.',
      ...(resumesAt ? { resumesAt } : {}),
    };
  }
  const loggedAt = now();
  await env.DB.prepare('INSERT INTO check_log (github_user_id, created_at) VALUES (?, ?)')
    .bind(submitter.githubUserId, loggedAt)
    .run();
  const parsed = parseRepositoryUrl(repositoryUrl);
  if (!parsed) return INVALID_URL();
  const budget = new Budget();
  const { asUser, asApp } = clients(env, submitter, budget);
  try {
    const evaluated = await evaluateConditions(asUser, asApp, parsed, false);
    const { repo } = evaluated;
    const admin = evaluated.conditions.find((item) => item.code === 'not_admin')?.result === 'passed';
    // 既定のブランチは名前でなく HEAD で指す。名前は release/1.x のように / などを含み、API のパスの区切りの検査を通らない。
    const ref = 'HEAD';
    // 宣言ファイルは版の検査でだけ読んでいたため、誤りが不変のリリースの公開の後に分かった。公開の前に形を確かめる。
    let config: ConfigCheck = { result: 'unchecked' };
    let pricing: Pricing | null = null;
    if (admin && budget.canFetch(1 + REVIEW_FILES_COST + TARBALL_COST + 1)) {
      ({ check: config, pricing } = await checkConfig(asApp, repo.owner.login, repo.name, ref));
    }
    let review: { findings: Finding[]; unreadFiles: string[] } | null = null;
    let unavailable: ReviewOutcome['kind'] | null = null;
    if (admin && budget.canFetch(REVIEW_FILES_COST + 1)) {
      const collected = await collectReviewFiles(asApp, repo.owner.login, repo.name, ref);
      // README 以外の文書も、本審査と同じ選び方で照合する。照合できなかったときも重大にし、作者が公開の前に知れるようにする。
      collected.docScan = budget.canFetch(TARBALL_COST + 1)
        ? await scanDocsForCheck(asApp, repo.owner.login, repo.name, ref, collected.paths, collected.truncated)
        : {
            missing:
              'Checked by rules: the documents other than the README could not be checked in the check mode because this request ran out of its budget of GitHub API calls (the latest release has many files). The check after a release checks them.',
          };
      // 宣言の申告をレビューの事実の行に渡す。宣言の判定とレビューは別の処理のため、ここで受け渡す。
      const outcome = await reviewRepository(env, budget, `${repo.owner.login}/${repo.name}`, collected, null, {
        pricing,
      });
      if (outcome.kind === 'done') review = { findings: outcome.findings, unreadFiles: collected.unreadFiles };
      else unavailable = outcome.kind;
    }
    // 本サービスの側の都合 (AI Gateway の支出の上限、無料枠の不足、混雑) でレビューできなかった回は、回数に数えない。
    if (unavailable === 'quota' || unavailable === 'busy') {
      await env.DB.prepare('DELETE FROM check_log WHERE github_user_id = ? AND created_at = ?')
        .bind(submitter.githubUserId, loggedAt)
        .run();
    }
    const view = reviewView(review);
    return {
      ok: evaluated.conditions.every((item) => item.result === 'passed'),
      mode: 'check',
      important: AUTHOR_KEY_POINT,
      conditions: admin ? [...evaluated.conditions, ...DEFERRED] : evaluated.conditions,
      config,
      review: {
        status: review ? 'done' : unavailable === 'quota' || unavailable === 'busy' ? 'unavailable' : 'failed',
        ...(unavailable === 'quota'
          ? {
              message:
                'The daily review capacity of this service is used up. This check was not counted. Try again after resumesAt.',
              resumesAt: quotaRetryAt(),
            }
          : {}),
        ...(unavailable === 'busy'
          ? { message: 'The review service is busy. This check was not counted. Try again in a few minutes.' }
          : {}),
        ...view,
      },
    };
  } catch (error) {
    return githubFailure(error);
  }
}
