// 宣言ファイル (docs/design/scanning.md の「宣言ファイル」と「表示用の値の推定」)。
// .audio-soko-kun/config.json の形の検証、配布物の名前の型の照合、中身の検査の結果との照合、カテゴリの決定を行う。
// 規格・OS・アーキテクチャは中身の検査の検出を正とし、宣言は照合と案内の絞り込みにだけ使う。
import type { Budget } from '../budget';
import type { Env } from '../env';
import type { GitHubClient } from '../github';
import { CATEGORIES, type Category, OS_VALUES, type Os } from './metadata';
import type { ContentResult } from './status';

export const CONFIG_DIR = '.audio-soko-kun';
const CONFIG_FILE = 'config.json';
const MAX_CONFIG_BYTES = 16 * 1024;
const MAX_NAME_LENGTH = 60;
const MAX_ASSETS = 20;
// pattern の長さは文書で決めていない。配布物の名前の上限に合わせて抑える。
const MAX_PATTERN_LENGTH = 255;

const FORMATS = ['vst3', 'clap', 'lv2', 'au'] as const;
const ARCHES = ['x86_64', 'x86', 'arm64'] as const;
type Format = (typeof FORMATS)[number];
type Arch = (typeof ARCHES)[number];

// 中身の検査から推定するカテゴリ。utility は推定の結果にならない。複数の手がかりがあれば、先に並べたものを採る。
const INFERENCE_ORDER = ['instrument', 'midi', 'analyzer', 'effect'] as const satisfies readonly Category[];
export const INFERABLE_CATEGORIES = INFERENCE_ORDER;

export interface DeclaredAsset {
  pattern: string;
  os: Os;
  arch: Arch[];
  formats: Format[];
}

export interface Declaration {
  name: string | null;
  category: Category | null;
  assets: DeclaredAsset[] | null;
}

export type ParsedDeclaration =
  | { state: 'missing' }
  | { state: 'invalid' }
  | { state: 'parsed'; declaration: Declaration };

export type DeclarationState = 'missing' | 'ok' | 'no_declared_assets' | 'mismatch';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// 決めた値の一覧の中の値だけからなる、空でない配列なら、重複を除いて並べ替えた配列を返す。
function enumSet<T extends string>(value: unknown, allowed: readonly T[]): T[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > allowed.length * 2) return null;
  if (!value.every((item) => (allowed as readonly unknown[]).includes(item))) return null;
  return [...new Set(value as T[])].sort();
}

function parseAsset(raw: unknown): DeclaredAsset | null {
  if (!isObject(raw)) return null;
  const { pattern, os } = raw;
  if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > MAX_PATTERN_LENGTH) return null;
  if (!(OS_VALUES as readonly unknown[]).includes(os)) return null;
  const arch = enumSet(raw.arch, ARCHES);
  const formats = enumSet(raw.formats, FORMATS);
  if (!arch || !formats) return null;
  return { pattern, os: os as Os, arch, formats };
}

// 宣言ファイルの形を検証する。text は取得した本文。null はファイルが無いこと、too_large は 16 KB を超えたこと。
// 知らない項目は無視する。
export function parseDeclaration(text: string | 'too_large' | null): ParsedDeclaration {
  if (text === null) return { state: 'missing' };
  if (text === 'too_large') return { state: 'invalid' };
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { state: 'invalid' };
  }
  if (!isObject(body)) return { state: 'invalid' };
  const { name, category, assets } = body;
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.length > MAX_NAME_LENGTH)) {
    return { state: 'invalid' };
  }
  if (category !== undefined && !(CATEGORIES as readonly unknown[]).includes(category)) return { state: 'invalid' };
  let declared: DeclaredAsset[] | null = null;
  if (assets !== undefined) {
    if (!Array.isArray(assets) || assets.length === 0 || assets.length > MAX_ASSETS) return { state: 'invalid' };
    declared = [];
    for (const item of assets) {
      const asset = parseAsset(item);
      if (!asset) return { state: 'invalid' };
      declared.push(asset);
    }
  }
  return {
    state: 'parsed',
    declaration: {
      name: typeof name === 'string' ? name.trim() : null,
      category: (category as Category | undefined) ?? null,
      assets: declared,
    },
  };
}

// 配布物の名前の型。* だけを任意の文字列として扱い、ほかの文字はそのまま照合する。
export function matchesPattern(pattern: string, name: string): boolean {
  const source = pattern
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}$`, 's').test(name);
}

export function isDeclared(name: string, assets: readonly DeclaredAsset[]): boolean {
  return assets.some((asset) => matchesPattern(asset.pattern, name));
}

// plugins.declared_assets の値。本サービスが検証してから保存した JSON だが、形の合わない値は宣言が無いものとして扱う。
export function parseDeclaredAssets(value: string | null): DeclaredAsset[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    const assets = parsed.map(parseAsset);
    return assets.every((asset): asset is DeclaredAsset => asset !== null) && assets.length > 0 ? assets : null;
  } catch {
    return null;
  }
}

export async function readDeclaration(
  github: GitHubClient,
  owner: string,
  repo: string,
  tag: string,
): Promise<ParsedDeclaration> {
  return parseDeclaration(await github.getTextFile(owner, repo, CONFIG_DIR, CONFIG_FILE, tag, MAX_CONFIG_BYTES));
}

export interface ArchiveForDeclaration {
  name: string;
  // 中身の検査の結果。行が無ければ null。
  result: ContentResult | null;
  formats: string[];
  os: string[];
  arches: string[];
  categories: string[];
}

const sameSet = (left: readonly string[], right: readonly string[]) => {
  const a = new Set(left);
  const b = new Set(right);
  return a.size === b.size && [...a].every((item) => b.has(item));
};

// 中身の検査の手がかりから推定したカテゴリ。手がかりが無ければ null。
export function inferCategory(archives: readonly ArchiveForDeclaration[]): Category | null {
  const found = new Set(archives.flatMap((archive) => archive.categories));
  return INFERENCE_ORDER.find((category) => found.has(category)) ?? null;
}

// 宣言と中身の検査の結果を照合する。すべてのアーカイブの中身の検査を終えてから呼ぶ。
// 一致したアーカイブは、最初に一致した宣言と、os は値の一致、arch と formats は集合の一致で照合する。
// カテゴリは、案内の対象になりうるアーカイブ (中身の検査に通り、宣言があれば宣言に含まれる) の手がかりから推定し、
// 推定できなければ宣言の category、それも無ければ utility にする。
export function judgeDeclaration(
  declaration: Declaration | null,
  archives: readonly ArchiveForDeclaration[],
): { state: DeclarationState; category: Category } {
  const assets = declaration?.assets ?? null;
  const relevant = assets ? archives.filter((archive) => isDeclared(archive.name, assets)) : archives;
  const category =
    inferCategory(relevant.filter((archive) => archive.result === 'passed')) ?? declaration?.category ?? 'utility';
  if (!declaration) return { state: 'missing', category };
  if (assets) {
    if (relevant.length === 0) return { state: 'no_declared_assets', category };
    for (const archive of relevant) {
      const entry = assets.find((asset) => matchesPattern(asset.pattern, archive.name));
      if (
        !entry ||
        !sameSet([entry.os], archive.os) ||
        !sameSet(entry.arch, archive.arches) ||
        !sameSet(entry.formats, archive.formats)
      ) {
        return { state: 'mismatch', category };
      }
    }
  }
  return { state: 'ok', category };
}

function jsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

interface PendingDeclarationRow {
  github_release_id: number;
  plugin_id: string;
  published_at: string;
  config_json: string | null;
}

interface ArchiveRow {
  release_id: number;
  name: string;
  result: ContentResult | null;
  formats: string | null;
  os: string | null;
  arches: string | null;
  categories: string | null;
}

// 宣言を取得済みで config_state が pending の版について、すべてのアーカイブの中身の検査が終わっていれば判定を書く。
// 新しい版の検査で宣言を取得したときと、中身の検査の結果を受け取ったときに呼ぶ。どちらが後になっても判定が行われる。
// ok と missing では、plugins の表示名・配布物の宣言・カテゴリを、その版の値に替える。
export async function settleDeclarations(env: Env, releaseIds: readonly number[], budget?: Budget): Promise<number> {
  if (releaseIds.length === 0) return 0;
  const placeholders = releaseIds.map(() => '?').join(', ');
  budget?.takeD1Query();
  const [pending, archives] = await env.DB.batch([
    env.DB.prepare(
      `SELECT c.github_release_id, r.plugin_id, r.published_at, c.config_json
       FROM release_checks c JOIN releases r ON r.github_release_id = c.github_release_id
       WHERE c.github_release_id IN (${placeholders}) AND c.config_state = 'pending' AND c.config_fetched_at IS NOT NULL
       ORDER BY r.published_at`,
    ).bind(...releaseIds),
    env.DB.prepare(
      `SELECT a.release_id, a.name, k.result, k.formats, k.os, k.arches, k.categories
       FROM assets a LEFT JOIN content_checks k ON k.github_asset_id = a.github_asset_id
       WHERE a.release_id IN (${placeholders}) AND a.kind = 'archive'`,
    ).bind(...releaseIds),
  ]);
  const archivesByRelease = new Map<number, ArchiveRow[]>();
  for (const row of (archives?.results ?? []) as ArchiveRow[]) {
    archivesByRelease.set(row.release_id, [...(archivesByRelease.get(row.release_id) ?? []), row]);
  }

  const statements: D1PreparedStatement[] = [];
  for (const row of (pending?.results ?? []) as PendingDeclarationRow[]) {
    const rows = archivesByRelease.get(row.github_release_id) ?? [];
    // 中身の検査が終わっていないアーカイブがあれば待つ。試行の上限に達した error も、管理者がやり直すまで待つ。
    if (rows.some((archive) => archive.result === null || archive.result === 'pending' || archive.result === 'error')) {
      continue;
    }
    let declaration: Declaration | null = null;
    if (row.config_json !== null) {
      const parsed = parseDeclaration(row.config_json);
      if (parsed.state !== 'parsed') {
        statements.push(
          env.DB.prepare(
            "UPDATE release_checks SET config_state = 'invalid' WHERE github_release_id = ? AND config_state = 'pending'",
          ).bind(row.github_release_id),
        );
        continue;
      }
      declaration = parsed.declaration;
    }
    const judged = judgeDeclaration(
      declaration,
      rows.map((archive) => ({
        name: archive.name,
        result: archive.result,
        formats: jsonArray(archive.formats),
        os: jsonArray(archive.os),
        arches: jsonArray(archive.arches),
        categories: jsonArray(archive.categories),
      })),
    );
    statements.push(
      env.DB.prepare(
        "UPDATE release_checks SET config_state = ? WHERE github_release_id = ? AND config_state = 'pending'",
      ).bind(judged.state, row.github_release_id),
    );
    if (judged.state === 'ok' || judged.state === 'missing') {
      statements.push(
        env.DB.prepare('UPDATE plugins SET display_name = ?, declared_assets = ?, category = ? WHERE id = ?').bind(
          declaration?.name ?? null,
          declaration?.assets ? JSON.stringify(declaration.assets) : null,
          judged.category,
          row.plugin_id,
        ),
      );
    }
  }
  if (statements.length === 0) return 0;
  budget?.takeD1Query();
  await env.DB.batch(statements);
  return statements.length;
}
