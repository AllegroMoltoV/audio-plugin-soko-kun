// macOS の署名と公証の判定の受け口 (docs/design/scanning.md の「Worker の経路」と「署名と公証の判定」)。
// GitHub Actions の macos-verify.yaml に、判定を待つ配布物と macOS 向けのバンドルのパスを渡し、結果を受け取る。
// macos-verify.yaml の OIDC のトークンだけを受け付け、verify.yaml のトークンでは書けない。
import { isMacosJudged, parseBundles } from '../domain/metadata';
import { MAX_CHECK_ATTEMPTS } from '../domain/status';
import type { Env } from '../env';
import { MACOS_VERIFY_WORKFLOW_REF, verifyActionsToken } from './oidc';
import { isSafePath } from './route';

const MAX_PENDING = 50;
const MAX_RESULTS = 100;
const MAX_TEAM_IDS = 10;
const TEAM_ID = /^[A-Z0-9]{10}$/;

// 結果と理由のコードの組。Developer ID でない署名は codesign の Authority で決まるため failed にする。
// Developer ID の署名があるのに公証済みと判定されないものは、照会の失敗と却下を区別できないため error にする (検証 V2)。
// unsafe_archive は、展開の前の zip の項目の確かめで、絶対パス・.. ・バンドルの外を指すシンボリックリンクを見つけたもの。
const REASONS = {
  passed: [],
  failed: ['not_signed', 'adhoc', 'not_developer_id'],
  error: ['not_notarized', 'check_error', 'unsafe_archive'],
} as const satisfies Record<string, readonly string[]>;

type MacosResultInput = keyof typeof REASONS;

// 判定を待つ配布物の条件。GET /internal/macos-checks/pending と、定期処理からの macos-verify.yaml の起動で同じ条件を使う。
// 結合する別名は、macOS の判定 m・配布物 a・リリース r・プラグイン p。bind には試行の上限を渡す。
export const PENDING_MACOS_FROM = `FROM macos_signing_checks m JOIN assets a ON a.github_asset_id = m.github_asset_id
  JOIN releases r ON r.github_release_id = a.release_id
  JOIN plugins p ON p.id = r.plugin_id
  WHERE p.removed = 0 AND (m.result = 'pending' OR (m.result = 'error' AND m.attempts < ?))`;
export const PENDING_MACOS_BINDINGS = [MAX_CHECK_ATTEMPTS] as const;

interface MacosInput {
  assetId: number;
  result: MacosResultInput;
  reason: string | null;
  teamIds: string[];
}

function parseEntry(raw: unknown): MacosInput | null {
  const entry = raw as Record<string, unknown>;
  if (typeof entry !== 'object' || entry === null) return null;
  if (typeof entry.assetId !== 'number' || !Number.isSafeInteger(entry.assetId)) return null;
  if (entry.result !== 'passed' && entry.result !== 'failed' && entry.result !== 'error') return null;
  const result = entry.result;
  const reason = entry.reason ?? null;
  const allowed: readonly string[] = REASONS[result];
  if (result === 'passed' ? reason !== null : typeof reason !== 'string' || !allowed.includes(reason)) return null;

  const teamIds = entry.teamIds ?? [];
  if (!Array.isArray(teamIds) || teamIds.length > MAX_TEAM_IDS) return null;
  if (!teamIds.every((id) => typeof id === 'string' && TEAM_ID.test(id))) return null;
  if (new Set(teamIds).size !== teamIds.length) return null;
  // 合格は Developer ID の署名を求めるため、Team ID を必ず持つ。
  if (result === 'passed' && teamIds.length === 0) return null;
  return { assetId: entry.assetId, result, reason: reason as string | null, teamIds: teamIds as string[] };
}

// 形が合わない結果、または同じ配布物の結果を 2 つ含む要求は、全体を拒否する。
function parseResults(body: unknown): MacosInput[] | null {
  const raw = (body as { results?: unknown })?.results;
  if (!Array.isArray(raw) || raw.length > MAX_RESULTS) return null;
  const results: MacosInput[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    const entry = parseEntry(item);
    if (!entry || seen.has(entry.assetId)) return null;
    seen.add(entry.assetId);
    results.push(entry);
  }
  return results;
}

async function listPending(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT a.github_asset_id, a.download_url, a.digest, p.owner, p.repo, r.tag,
       (SELECT bundles FROM content_checks c WHERE c.github_asset_id = a.github_asset_id) AS bundles
     ${PENDING_MACOS_FROM}
     ORDER BY COALESCE(m.checked_at, '') LIMIT ?`,
  )
    .bind(...PENDING_MACOS_BINDINGS, MAX_PENDING)
    .all<{
      github_asset_id: number;
      download_url: string;
      digest: string;
      owner: string;
      repo: string;
      tag: string;
      bundles: string | null;
    }>();
  return Response.json({
    assets: results.map((row) => ({
      assetId: row.github_asset_id,
      downloadUrl: row.download_url,
      digest: row.digest,
      repository: `${row.owner}/${row.repo}`,
      tag: row.tag,
      // 判定のコマンドの引数になるため、受け取ったときと同じ規則でもう一度確かめる。macOS の LV2 は判定しない。
      bundles: parseBundles(row.bundles)
        .filter(isMacosJudged)
        .map((bundle) => bundle.path)
        .filter(isSafePath),
    })),
  });
}

function teamIdValue(teamIds: string[]): string | null {
  if (teamIds.length === 0) return null;
  return teamIds.length === 1 ? (teamIds[0] ?? null) : JSON.stringify([...teamIds].sort());
}

async function saveResults(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }
  const results = parseResults(body);
  if (!results) return new Response('bad request', { status: 400 });
  if (results.length === 0) return Response.json({ updated: 0 });
  const timestamp = new Date().toISOString();
  // 行の無い配布物には書かない。結果が確定した行と、試行の上限に達した error の行も書き換えない。
  // 上限に達した行は、管理者が retry-checks で pending に戻すまで管理者の確認を待つ。
  const statements = results.map((input) =>
    env.DB.prepare(
      `UPDATE macos_signing_checks SET result = ?, reason = ?, team_id = ?, attempts = attempts + 1, checked_at = ?
       WHERE github_asset_id = ? AND result IN ('pending', 'error')`,
    ).bind(input.result, input.reason, teamIdValue(input.teamIds), timestamp, input.assetId),
  );
  const outcomes = await env.DB.batch(statements);
  const updated = outcomes.reduce((sum, outcome) => sum + (outcome.meta?.changes ?? 0), 0);
  return Response.json({ updated });
}

export async function handleMacosChecks(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token || !(await verifyActionsToken(token, MACOS_VERIFY_WORKFLOW_REF))) {
    return new Response('unauthorized', { status: 401 });
  }
  if (url.pathname === '/internal/macos-checks/pending' && request.method === 'GET') return listPending(env);
  if (url.pathname === '/internal/macos-checks/results' && request.method === 'POST') return saveResults(request, env);
  return new Response('not found', { status: 404 });
}
