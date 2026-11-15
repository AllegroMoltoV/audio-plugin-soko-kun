// 配布物の検証の受け口 (docs/design/scanning.md の「Worker の経路」)。
// GitHub Actions の verify.yaml に、証明の検証と中身の検査を待つ配布物と、通信の検出を待つ版を渡し、結果を受け取る。
// どちらも OIDC のトークンを求める。
import { INFERABLE_CATEGORIES, settleDeclarations } from '../domain/declaration';
import { MAX_CHECK_ATTEMPTS } from '../domain/status';
import type { Env } from '../env';
import { NETWORK_PENDING, NETWORK_PENDING_LIMIT, parseNetworkScans } from '../review/network';
import { VERIFY_WORKFLOW_REF, verifyActionsToken } from './oidc';

const MAX_PENDING = 50;
const MAX_RESULTS = 100;
const MAX_BUNDLES = 200;
const MAX_VST2_FILES = 100;
const MAX_PATH_LENGTH = 1024;
const WORKFLOW_PATH = /^\.github\/workflows\/[A-Za-z0-9._-]{1,100}\.ya?ml$/;
const REASON = /^[a-z_]{1,40}$/;

const CONTENT_RESULTS = ['passed', 'no_plugin', 'vst2_detected', 'undetermined', 'error'] as const;
const FORMATS = ['vst3', 'clap', 'lv2', 'au'] as const;
const OS_VALUES = ['windows', 'macos', 'linux'] as const;
const ARCHES = ['x86_64', 'x86', 'arm64'] as const;

type ContentResult = (typeof CONTENT_RESULTS)[number];
type Format = (typeof FORMATS)[number];
type OsValue = (typeof OS_VALUES)[number];
type Arch = (typeof ARCHES)[number];
type InferableCategory = (typeof INFERABLE_CATEGORIES)[number];

// 検証を待つ配布物の条件。GET /internal/checks/pending と、定期処理からの verify.yaml の起動で同じ条件を使う。
// 結合する別名は、配布物 a・リリース r・プラグイン p・証明の検証 t・中身の検査 c。bind には試行の上限を 2 回渡す。
export const PENDING_CHECKS_FROM = `FROM assets a JOIN releases r ON r.github_release_id = a.release_id
  JOIN plugins p ON p.id = r.plugin_id
  LEFT JOIN attestation_checks t ON t.github_asset_id = a.github_asset_id
  LEFT JOIN content_checks c ON c.github_asset_id = a.github_asset_id
  WHERE p.removed = 0 AND (t.result = 'pending' OR (t.result = 'error' AND t.attempts < ?)
    OR c.result = 'pending' OR (c.result = 'error' AND c.attempts < ?))`;
export const PENDING_CHECKS_BINDINGS = [MAX_CHECK_ATTEMPTS, MAX_CHECK_ATTEMPTS] as const;

// 通信の検出を待つ版の条件。結合する別名は、新しい版の検査 c・リリース r・プラグイン p。
export const PENDING_SCANS_FROM = `FROM release_checks c JOIN releases r ON r.github_release_id = c.github_release_id
  JOIN plugins p ON p.id = r.plugin_id
  WHERE ${NETWORK_PENDING}`;

interface PendingAsset {
  github_asset_id: number;
  kind: string;
  download_url: string;
  digest: string;
  owner: string;
  repo: string;
  tag: string;
  commit_sha: string;
  release_workflow: string | null;
  github_repo_id: number;
  previous_names: string | null;
}

interface AttestationInput {
  result: 'passed' | 'failed' | 'error';
  reason: string | null;
  signerWorkflow: string | null;
}

interface BundleInput {
  path: string;
  format: Format;
  os: OsValue[];
  arches: Arch[];
}

interface ContentInput {
  result: ContentResult;
  reason: string | null;
  bundles: BundleInput[];
  formats: Format[];
  os: OsValue[];
  arches: Arch[];
  vst2Files: string[];
  categories: InferableCategory[];
}

interface ResultInput {
  assetId: number;
  attestation: AttestationInput | null;
  content: ContentInput | null;
}

// アーカイブの中のパスは外部データで、macos-verify.yaml が判定のコマンドの引数に使う。
// 絶対パス・親のフォルダーを指す .. ・制御文字・バックスラッシュを含むものは受け付けない。
function isSafePath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PATH_LENGTH) return false;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字を拒否するための正規表現
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return false;
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) return false;
  return !value.split('/').includes('..');
}

// 決めた値の一覧の中の値だけからなる、重複の無い配列なら、その配列を返す。
function enumArray<T extends string>(value: unknown, allowed: readonly T[], minLength = 0): T[] | null {
  if (!Array.isArray(value) || value.length < minLength || value.length > allowed.length) return null;
  if (!value.every((item) => (allowed as readonly unknown[]).includes(item))) return null;
  if (new Set(value).size !== value.length) return null;
  return value as T[];
}

const sameSet = (left: readonly string[], right: Set<string>) =>
  left.length === right.size && left.every((item) => right.has(item));

function parseAttestation(raw: unknown): AttestationInput | null | undefined {
  if (raw === undefined) return null;
  const entry = raw as Record<string, unknown>;
  if (typeof entry !== 'object' || entry === null) return undefined;
  if (entry.result !== 'passed' && entry.result !== 'failed' && entry.result !== 'error') return undefined;
  const reason = typeof entry.reason === 'string' && REASON.test(entry.reason) ? entry.reason : null;
  const signerWorkflow =
    typeof entry.signerWorkflow === 'string' && WORKFLOW_PATH.test(entry.signerWorkflow) ? entry.signerWorkflow : null;
  return { result: entry.result, reason, signerWorkflow };
}

// 中身の検査の結果を検証する。形が合わなければ undefined を返し、要求全体を 400 で拒否する。
function parseContent(raw: unknown): ContentInput | null | undefined {
  if (raw === undefined) return null;
  const entry = raw as Record<string, unknown>;
  if (typeof entry !== 'object' || entry === null) return undefined;
  if (!(CONTENT_RESULTS as readonly unknown[]).includes(entry.result)) return undefined;
  const result = entry.result as ContentResult;
  if (
    entry.reason !== undefined &&
    entry.reason !== null &&
    !(typeof entry.reason === 'string' && REASON.test(entry.reason))
  )
    return undefined;
  const reason = typeof entry.reason === 'string' ? entry.reason : null;

  const rawBundles = entry.bundles ?? [];
  if (!Array.isArray(rawBundles) || rawBundles.length > MAX_BUNDLES) return undefined;
  const bundles: BundleInput[] = [];
  for (const item of rawBundles) {
    const bundle = item as Record<string, unknown>;
    if (typeof bundle !== 'object' || bundle === null || !isSafePath(bundle.path)) return undefined;
    if (!(FORMATS as readonly unknown[]).includes(bundle.format)) return undefined;
    const os = enumArray(bundle.os, OS_VALUES, 1);
    const arches = enumArray(bundle.arches, ARCHES, 1);
    if (!os || !arches) return undefined;
    bundles.push({ path: bundle.path, format: bundle.format as Format, os, arches });
  }

  // 一覧の規格・OS・アーキテクチャは、バンドルの値の和と一致しなければならない。
  // os の取り違えで macOS の判定を省かれないよう、食い違いは受け付けない。
  const formats = enumArray(entry.formats ?? [], FORMATS);
  const os = enumArray(entry.os ?? [], OS_VALUES);
  const arches = enumArray(entry.arches ?? [], ARCHES);
  // カテゴリの手がかりは、検出したバンドルから読んだものだけ。バンドルが無ければ空でなければならない。
  const categories = enumArray(entry.categories ?? [], INFERABLE_CATEGORIES);
  if (!formats || !os || !arches || !categories) return undefined;
  if (bundles.length === 0 && categories.length > 0) return undefined;
  if (!sameSet(formats, new Set(bundles.map((bundle) => bundle.format)))) return undefined;
  if (!sameSet(os, new Set(bundles.flatMap((bundle) => bundle.os)))) return undefined;
  if (!sameSet(arches, new Set(bundles.flatMap((bundle) => bundle.arches)))) return undefined;

  const rawVst2 = entry.vst2Files ?? [];
  if (!Array.isArray(rawVst2) || rawVst2.length > MAX_VST2_FILES || !rawVst2.every(isSafePath)) return undefined;
  const vst2Files = rawVst2 as string[];

  // VST 2 のエントリーポイントを検出しながら passed とする組は、どちらかが誤りのため受け付けない。
  if (result === 'passed' && (vst2Files.length > 0 || bundles.length === 0)) return undefined;
  if (result === 'vst2_detected' && vst2Files.length === 0) return undefined;
  if (result === 'no_plugin' && (bundles.length > 0 || vst2Files.length > 0)) return undefined;
  return { result, reason, bundles, formats, os, arches, vst2Files, categories };
}

function parseResults(body: unknown): ResultInput[] | null {
  const raw = (body as { results?: unknown })?.results;
  if (!Array.isArray(raw) || raw.length > MAX_RESULTS) return null;
  const results: ResultInput[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    const entry = item as Record<string, unknown>;
    if (typeof entry?.assetId !== 'number' || !Number.isSafeInteger(entry.assetId)) return null;
    if (seen.has(entry.assetId)) return null;
    seen.add(entry.assetId);
    const attestation = parseAttestation(entry.attestation);
    const content = parseContent(entry.content);
    if (attestation === undefined || content === undefined) return null;
    results.push({ assetId: entry.assetId, attestation, content });
  }
  return results;
}

async function listPending(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT a.github_asset_id, a.kind, a.download_url, a.digest, p.owner, p.repo, r.tag, r.commit_sha,
       p.release_workflow, p.github_repo_id,
       (SELECT group_concat(name, ' ') FROM (SELECT name FROM plugin_aliases
          WHERE plugin_id = p.id AND name IS NOT NULL ORDER BY created_at DESC)) AS previous_names
     ${PENDING_CHECKS_FROM}
     ORDER BY COALESCE(t.checked_at, ''), COALESCE(c.checked_at, '') LIMIT ?`,
  )
    .bind(...PENDING_CHECKS_BINDINGS, MAX_PENDING)
    .all<PendingAsset>();
  // 通信の API の検出を待つ版。版ごとに、そのコミットのソースを 1 回だけ調べる。
  const { results: releases } = await env.DB.prepare(
    `SELECT c.github_release_id, p.owner, p.repo, r.commit_sha
     ${PENDING_SCANS_FROM}
     ORDER BY c.network_checked_at IS NOT NULL, c.network_checked_at LIMIT ?`,
  )
    .bind(NETWORK_PENDING_LIMIT)
    .all<{ github_release_id: number; owner: string; repo: string; commit_sha: string }>();
  return Response.json({
    releases: releases.map((row) => ({
      releaseId: row.github_release_id,
      repository: `${row.owner}/${row.repo}`,
      commitSha: row.commit_sha,
    })),
    assets: results.map((row) => ({
      assetId: row.github_asset_id,
      kind: row.kind,
      downloadUrl: row.download_url,
      digest: row.digest,
      repository: `${row.owner}/${row.repo}`,
      // 名前を変える前に作られた証明は、作られたときの名前でしか検証に通らない。新しい順の旧い名前と、照合に使う ID (ADR 0015)。
      repositoryId: row.github_repo_id,
      previousRepositories: row.previous_names ? row.previous_names.split(' ') : [],
      tag: row.tag,
      commitSha: row.commit_sha,
      signerWorkflow: row.release_workflow,
    })),
  });
}

interface KnownAsset {
  github_asset_id: number;
  release_id: number;
  plugin_id: string;
  release_workflow: string | null;
  attestation: string | null;
  content: string | null;
}

const OPEN = ['pending', 'error'];

async function saveResults(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }
  const results = parseResults(body);
  const scans = parseNetworkScans((body as { networkScans?: unknown })?.networkScans);
  if (!results || !scans) return new Response('bad request', { status: 400 });
  const timestamp = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  // 結果が確定した行 (pending と error 以外) は書き換えない。
  for (const scan of scans) {
    statements.push(
      env.DB.prepare(
        `UPDATE release_checks SET network_state = ?, network_hits = ?, network_attempts = network_attempts + 1,
           network_checked_at = ?
         WHERE github_release_id = ? AND network_state IN ('pending', 'error')`,
      ).bind(scan.result, scan.scan ? JSON.stringify(scan.scan) : null, timestamp, scan.releaseId),
    );
  }
  if (results.length === 0) {
    if (statements.length > 0) await env.DB.batch(statements);
    return Response.json({ updated: statements.length });
  }

  const ids = results.map((result) => result.assetId);
  const { results: rows } = await env.DB.prepare(
    `SELECT a.github_asset_id, a.release_id, p.id AS plugin_id, p.release_workflow, t.result AS attestation, c.result AS content
     FROM assets a JOIN releases r ON r.github_release_id = a.release_id JOIN plugins p ON p.id = r.plugin_id
     LEFT JOIN attestation_checks t ON t.github_asset_id = a.github_asset_id
     LEFT JOIN content_checks c ON c.github_asset_id = a.github_asset_id
     WHERE a.github_asset_id IN (${ids.map(() => '?').join(', ')})`,
  )
    .bind(...ids)
    .all<KnownAsset>();
  const known = new Map(rows.map((row) => [row.github_asset_id, row]));
  // 同じ呼び出しの中で初めて記録するワークフローも、以降の配布物の照合に使う。
  const workflows = new Map<string, string | null>();
  // 中身の検査の結果を書いた版。宣言ファイルとの照合が残っていれば、書いたあとで行う。
  const contentReleases = new Set<number>();
  for (const input of results) {
    const row = known.get(input.assetId);
    if (!row) continue;
    const attestation = input.attestation;
    // 結果が確定した行 (pending と error 以外) は書き換えない。
    if (attestation && row.attestation && OPEN.includes(row.attestation)) {
      const expected = workflows.has(row.plugin_id) ? workflows.get(row.plugin_id) : row.release_workflow;
      let result = attestation.result;
      let reason = attestation.reason;
      // 記録したリリースのワークフローと違うワークフローが署名した証明は、検証が通っても受け付けない。
      if (
        result === 'passed' &&
        (!attestation.signerWorkflow || (expected && expected !== attestation.signerWorkflow))
      ) {
        result = 'failed';
        reason = attestation.signerWorkflow ? 'signer_workflow_mismatch' : 'signer_workflow_missing';
      }
      statements.push(
        env.DB.prepare(
          `UPDATE attestation_checks SET result = ?, reason = ?, signer_workflow = ?, attempts = attempts + 1, checked_at = ?
           WHERE github_asset_id = ? AND result IN ('pending', 'error')`,
        ).bind(result, reason, attestation.signerWorkflow, timestamp, input.assetId),
      );
      if (result === 'passed' && !expected) {
        workflows.set(row.plugin_id, attestation.signerWorkflow);
        statements.push(
          env.DB.prepare('UPDATE plugins SET release_workflow = ? WHERE id = ? AND release_workflow IS NULL').bind(
            attestation.signerWorkflow,
            row.plugin_id,
          ),
        );
      }
    }
    const content = input.content;
    if (content && row.content && OPEN.includes(row.content)) {
      statements.push(
        env.DB.prepare(
          `UPDATE content_checks SET result = ?, bundles = ?, formats = ?, os = ?, arches = ?, vst2_files = ?, reason = ?,
             categories = ?, attempts = attempts + 1, checked_at = ?
           WHERE github_asset_id = ? AND result IN ('pending', 'error')`,
        ).bind(
          content.result,
          JSON.stringify(content.bundles),
          JSON.stringify(content.formats),
          JSON.stringify(content.os),
          JSON.stringify(content.arches),
          JSON.stringify(content.vst2Files),
          content.reason,
          JSON.stringify(content.categories),
          timestamp,
          input.assetId,
        ),
      );
      contentReleases.add(row.release_id);
      // macOS 向けのバンドルを検出した配布物は、署名と公証の判定を待つ。
      if (content.os.includes('macos')) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO macos_signing_checks (github_asset_id, result) VALUES (?, 'pending')
             ON CONFLICT (github_asset_id) DO NOTHING`,
          ).bind(input.assetId),
        );
      }
    }
  }
  if (statements.length > 0) await env.DB.batch(statements);
  await settleDeclarations(env, [...contentReleases]);
  return Response.json({ updated: statements.length });
}

export async function handleChecks(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token || !(await verifyActionsToken(token, VERIFY_WORKFLOW_REF))) {
    return new Response('unauthorized', { status: 401 });
  }
  if (url.pathname === '/internal/checks/pending' && request.method === 'GET') return listPending(env);
  if (url.pathname === '/internal/checks/results' && request.method === 'POST') return saveResults(request, env);
  return new Response('not found', { status: 404 });
}
