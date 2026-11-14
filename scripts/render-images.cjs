// public/logo.png と public/og.png を、src/web/logo.ts の LOGO_SVG から作る。
// 使い方: node scripts/render-images.cjs
// 出力の最後に、src/web/logo.ts の LOGO_VERSION と src/web/layout.tsx の OG_VERSION に書く値を表示する。
// sharp は @cloudflare/vitest-plugin の依存として node_modules に入る。見つからないときは npm install --no-save sharp を実行する。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const repo = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(repo, 'src/web/logo.ts'), 'utf8');
const svg = src.match(/LOGO_SVG = `([\s\S]*?)`;/)[1];
const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f7efe3"/>
  <rect y="0" width="1200" height="24" fill="#20256e"/>
  <rect y="606" width="1200" height="24" fill="#20256e"/>
  <rect y="24" width="1200" height="6" fill="#e2c69c"/>
  <rect y="600" width="1200" height="6" fill="#e2c69c"/>
  <g transform="translate(90 175) scale(4.375)">${inner}</g>
  <text x="440" y="285" font-family="Yu Gothic UI, Yu Gothic, Meiryo, sans-serif" font-weight="bold" font-size="66" fill="#20256e">音のプラグイン倉庫くん</text>
  <text x="442" y="360" font-family="Verdana, Arial, sans-serif" font-weight="bold" font-size="44" fill="#2f3aa6">Audio Plugin Soko-kun</text>
  <text x="442" y="430" font-family="Yu Gothic UI, Yu Gothic, Meiryo, sans-serif" font-size="30" fill="#333333">オープンソースのオーディオプラグインの倉庫</text>
  <text x="442" y="475" font-family="Verdana, Arial, sans-serif" font-size="24" fill="#555555">An open registry of open-source audio plugins</text>
</svg>`;

const sha8 = (data) => crypto.createHash('sha256').update(data).digest('hex').slice(0, 8);

(async () => {
  await sharp(Buffer.from(svg), { density: 72 * 4 })
    .resize(256, 256)
    .png()
    .toFile(path.join(repo, 'public/logo.png'));
  await sharp(Buffer.from(og)).png().toFile(path.join(repo, 'public/og.png'));
  console.log(`LOGO_VERSION ${sha8(svg)}`);
  console.log(`OG_VERSION ${sha8(fs.readFileSync(path.join(repo, 'public/og.png')))}`);
})();
