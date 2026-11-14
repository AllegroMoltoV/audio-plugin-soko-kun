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
