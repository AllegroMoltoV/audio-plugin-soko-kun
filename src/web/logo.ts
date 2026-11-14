// サービスのロゴ (docs/design/ui.md の「サービスのロゴ」)。上部の帯とファビコンに使う。
// 丸いバッジに、図形で描いた「音」の字を置く。字形を図形で描くのは、閲覧環境のフォントに左右されないため。
// VST Compatible ロゴと VST の語は含めない (ADR 0004)。public/logo.png と public/og.png はこの図形から作る。
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="音のプラグイン倉庫くん">
  <circle cx="32" cy="32" r="31" fill="#20256e" stroke="#363d94" stroke-width="1"/>
  <circle cx="32" cy="32" r="27.5" fill="none" stroke="#e2c69c" stroke-width="1.5"/>
  <path d="M32 11.5 V15.5 M20 19 H44 M25.5 22.5 L27.5 27.5 M38.5 22.5 L36.5 27.5 M16 31 H48 M22.5 35.5 H41.5 V51.5 H22.5 Z M22.5 43.5 H41.5" fill="none" stroke="#e2c69c" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

// URL のクエリに付け、ロゴが変わったときに閲覧者のキャッシュを使わせない。LOGO_SVG の SHA-256 の先頭 8 桁。
export const LOGO_VERSION = 'c475b854';
