// サービスのロゴ (docs/design/ui.md の「サービスのロゴ」)。上部の帯とファビコンに使う。
// 丸いバッジに、図形で描いた「音」の字を置き、長い横線の左端をプラグの形にする。配信プラグイン倉庫くんのロゴと同じ作り。
// 字形を図形で描くのは、閲覧環境のフォントに左右されないため。
// VST Compatible ロゴと VST の語は含めない (ADR 0004)。public/logo.png と public/og.png は scripts/render-images.cjs でこの図形から作る。
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="音のプラグイン倉庫くん">
  <circle cx="32" cy="32" r="31" fill="#20256e" stroke="#363d94" stroke-width="1"/>
  <circle cx="32" cy="32" r="27.5" fill="none" stroke="#e2c69c" stroke-width="1.5"/>
  <path d="M33 11.5 V15.5 M22 19 H45 M27 22.5 L29 27.5 M40 22.5 L38 27.5 M20 31 H49 M24 35.5 H43 V51.5 H24 Z M24 43.5 H43" fill="none" stroke="#e2c69c" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="12.5" y="27.5" width="8" height="7" rx="2" fill="#e2c69c"/>
  <rect x="8.6" y="28.6" width="4.4" height="1.7" rx=".6" fill="#e2c69c"/>
  <rect x="8.6" y="31.7" width="4.4" height="1.7" rx=".6" fill="#e2c69c"/>
</svg>
`;

// URL のクエリに付け、ロゴが変わったときに閲覧者のキャッシュを使わせない。LOGO_SVG の SHA-256 の先頭 8 桁。
export const LOGO_VERSION = '1c873d29';
