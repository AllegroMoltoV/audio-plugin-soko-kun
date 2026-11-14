// サービスのロゴの仮置き。上部の帯とファビコンに使う。正式なロゴは画面と文言の段階 (S8) で置き換える。
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="音のプラグイン倉庫くん">
  <circle cx="32" cy="32" r="31" fill="#20256e"/>
  <text x="32" y="42" text-anchor="middle" font-size="28" fill="#e2c69c">音</text>
</svg>
`;

// URL のクエリに付け、ロゴが変わったときに閲覧者のキャッシュを使わせない。
export const LOGO_VERSION = 'placeholder1';
