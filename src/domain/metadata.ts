// GitHub の情報から、表示と検索に使う値を推定する。
// カテゴリの値 (docs/design/scanning.md の「表示用の値の推定」)。推定と宣言の規則は declaration.ts に置く。
export const CATEGORIES = ['instrument', 'effect', 'analyzer', 'midi', 'utility'] as const;
export type Category = (typeof CATEGORIES)[number];

export const OS_VALUES = ['windows', 'macos', 'linux'] as const;
export type Os = (typeof OS_VALUES)[number];

// 規格とアーキテクチャの値 (docs/design/scanning.md の「中身の検査」)。表示と絞り込みは中身の検査の結果だけで行う。
export const FORMAT_VALUES = ['vst3', 'clap', 'lv2', 'au'] as const;
export type Format = (typeof FORMAT_VALUES)[number];

export const ARCH_VALUES = ['x86_64', 'x86', 'arm64'] as const;
export type Arch = (typeof ARCH_VALUES)[number];

// 中身の検査で検出したバンドル。content_checks の bundles の JSON の 1 件。
export interface DetectedBundle {
  path: string;
  format: Format;
  os: Os[];
  arches: Arch[];
}

const isIn =
  <T extends string>(allowed: readonly T[]) =>
  (value: unknown): value is T =>
    (allowed as readonly unknown[]).includes(value);

// content_checks の bundles の JSON。形の合わない件は捨てる。値は受け口で検証してから書いている。
export function parseBundles(text: string | null): DetectedBundle[] {
  if (!text) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    const bundle = item as Record<string, unknown>;
    if (typeof bundle !== 'object' || bundle === null || typeof bundle.path !== 'string') return [];
    if (!isIn(FORMAT_VALUES)(bundle.format) || !Array.isArray(bundle.os) || !Array.isArray(bundle.arches)) return [];
    return [
      {
        path: bundle.path,
        format: bundle.format,
        os: bundle.os.filter(isIn(OS_VALUES)),
        arches: bundle.arches.filter(isIn(ARCH_VALUES)),
      },
    ];
  });
}

// macOS の判定 (macos-verify.yaml) の対象のバンドル。macOS の LV2 は判定せず、案内もしない。
// Gatekeeper の spctl は LV2 のフォルダーを判定の対象にせず、Developer ID の LV2 のバイナリが合格する例も
// 確かめられていないため (検証 V2、docs/design/scanning.md の「署名と公証の判定」)。
export function isMacosJudged(bundle: DetectedBundle): boolean {
  return bundle.format !== 'lv2' && bundle.os.includes('macos');
}

// 案内に使う規格・OS・アーキテクチャ。中身の検査が検出した値から、macOS の LV2 を除く。
// LV2 のバンドルは macOS を除いた OS が残るときだけ数え、アーキテクチャはバンドルの値をそのまま使う。
export function guidedPlatforms(bundles: DetectedBundle[]): { formats: Format[]; os: Os[]; arches: Arch[] } {
  const kept = bundles
    .map((bundle) => (bundle.format === 'lv2' ? { ...bundle, os: bundle.os.filter((os) => os !== 'macos') } : bundle))
    .filter((bundle) => bundle.os.length > 0);
  const union = <T extends string>(order: readonly T[], pick: (bundle: DetectedBundle) => readonly T[]) =>
    order.filter((value) => kept.some((bundle) => pick(bundle).includes(value)));
  return {
    formats: union(FORMAT_VALUES, (bundle) => [bundle.format]),
    os: union(OS_VALUES, (bundle) => bundle.os),
    arches: union(ARCH_VALUES, (bundle) => bundle.arches),
  };
}

export type AssetKind = 'archive' | 'installer' | 'other';

// 配布物の種類をファイル名の拡張子から決める (docs/design/scanning.md の「配布物の種類」)。案内の対象になるのは zip だけ。
export function assetKind(assetName: string): AssetKind {
  const name = assetName.toLowerCase();
  if (name.endsWith('.zip')) return 'archive';
  if (/\.(exe|msi|pkg|dmg)$/.test(name)) return 'installer';
  return 'other';
}

const SUMMARY_MAX = 300;

// HTML のタグを除く。入れ子のタグ (<scr<script>ipt>) は 1 回の置換で <script が残るため、変化がなくなるまで繰り返す。
function stripTags(text: string): string {
  let current = text;
  let previous: string;
  do {
    previous = current;
    current = current.replace(/<[^>]*>/g, '');
  } while (current !== previous);
  return current;
}

// README の最初の段落を、マークアップを除いた平文で取り出す。外部データとして扱い、表示時にエスケープする。
export function summarizeReadme(readme: string): string | null {
  const blocks = readme.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  for (const block of blocks) {
    const text = block.trim();
    if (!text) continue;
    if (/^(#|<|!\[|\[!\[|```|\||>|-{3,}|={3,})/.test(text)) continue;
    const plain = stripTags(text.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'))
      // 閉じていないタグの断片 (<script のように > の無いもの) も残さない。
      .replace(/[<>]/g, '')
      .replace(/[`*_~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (plain.length < 10) continue;
    return plain.length > SUMMARY_MAX ? `${plain.slice(0, SUMMARY_MAX - 1)}…` : plain;
  }
  return null;
}
