// Web の危険側の境界: 外部メタデータによる XSS、検査前のプラグインの公開、スクリプトの許可。
import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { submitPlugin } from '../src/domain/submit';
import { aiSearchUrl } from '../src/web/app';
import { PAGE_KEYS, PAGES } from '../src/web/content';
import { DICTS, LANGS } from '../src/web/i18n';
import { markListable } from './fixtures/checks';
import { githubHandlers, OWNER, REPO, USER_TOKEN } from './fixtures/github';
import { png } from './fixtures/images';
import { network } from './setup';

const ORIGIN = 'http://localhost:8787';

async function register(): Promise<void> {
  network.use(...githubHandlers());
  const result = await submitPlugin(
    env,
    { githubUserId: 4242, githubToken: USER_TOKEN },
    `https://github.com/${OWNER}/${REPO}`,
  );
  if (!result.ok) throw new Error(result.code);
  network.resetHandlers();
}

describe('Web', () => {
  it('GitHub の説明文に含まれる script をエスケープして表示する', async () => {
    await register();
    await markListable(env.DB);
    const html = await (await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=en`)).text();
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  // DAW のオーディオプラグインを作る相談を受けた AI エージェントが、作り方と掲載の条件を一度で読めるようにする。
  // VST の語を表示するページにはロゴが要る (ADR 0004) ため、テキストの本文には VST の語を書かない。
  it('/llms.txt に、スキルの導入のコマンドと MCP の接続先を出し、VST の語は出さない', async () => {
    const response = await SELF.fetch(`${ORIGIN}/llms.txt`);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('claude plugin install audio-soko-kun-plugin-dev@audio-plugin-soko-kun');
    expect(text).toContain(`${ORIGIN}/mcp`);
    expect(text).not.toMatch(/vst/i);
  });

  it('トップページの横の欄から /llms.txt へリンクする', async () => {
    const html = await (await SELF.fetch(`${ORIGIN}/?lang=ja`)).text();
    expect(html).toContain('href="/llms.txt"');
  });

  it('スクリプトを許可しない CSP を付ける', async () => {
    const response = await SELF.fetch(`${ORIGIN}/?lang=en`);
    const csp = response.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain('script-src');
  });

  // X03: トップ以外の画面と、404 や画像の応答にも同じ CSP を付ける。
  it('トップ以外の画面にも、スクリプトを許可しない CSP を付ける', async () => {
    await register();
    await markListable(env.DB);
    const paths = [
      `/plugins/${OWNER}/${REPO}?lang=en`,
      '/?lang=en&q=pitch',
      '/notices?lang=en',
      ...PAGE_KEYS.map((key) => `/${key}?lang=en`),
      '/plugins/nobody/nothing?lang=en',
      '/sitemap.xml',
    ];
    for (const path of paths) {
      const response = await SELF.fetch(`${ORIGIN}${path}`);
      const csp = response.headers.get('Content-Security-Policy') ?? '';
      expect(csp, path).toContain("default-src 'none'");
      expect(csp, path).not.toContain('script-src');
      await response.arrayBuffer();
    }
    const contact = await SELF.fetch(`${ORIGIN}/contact?lang=en`, { method: 'POST' });
    expect(contact.headers.get('Content-Security-Policy') ?? '').toContain("default-src 'none'");
    await contact.arrayBuffer();
  });

  // X01: 宣言ファイルの name と配布物名も外部データとしてエスケープする。
  it('宣言ファイルの name と配布物名に含まれる script をエスケープして表示する', async () => {
    await register();
    await markListable(env.DB);
    await env.DB.prepare("UPDATE release_checks SET config_state = 'ok', config_json = ?")
      .bind(JSON.stringify({ name: 'Pitch<script>alert(3)</script>' }))
      .run();
    await env.DB.prepare("UPDATE assets SET name = 'pitch<script>alert(4)</script>.zip' WHERE kind = 'archive'").run();
    for (const path of [`/plugins/${OWNER}/${REPO}?lang=en`, '/?lang=en', '/?lang=en&q=pitch']) {
      const html = await (await SELF.fetch(`${ORIGIN}${path}`)).text();
      expect(html, path).toContain('Pitch&lt;script&gt;alert(3)&lt;/script&gt;');
      expect(html, path).not.toContain('<script>alert(3)</script>');
    }
    const detail = await (await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=en`)).text();
    expect(detail).toContain('pitch&lt;script&gt;alert(4)&lt;/script&gt;.zip');
    expect(detail).not.toContain('<script>alert(4)</script>');
  });

  // V05: サイトマップには掲載中のプラグインだけを載せる。
  it('サイトマップに、検査待ちと停止のプラグインの詳細ページを含めない', async () => {
    const sitemap = async () => (await SELF.fetch(`${ORIGIN}/sitemap.xml`)).text();
    const detail = `${ORIGIN}/plugins/${OWNER}/${REPO}`;
    await register();
    expect(await sitemap()).not.toContain(detail);
    await markListable(env.DB);
    expect(await sitemap()).toContain(detail);
    await env.DB.prepare('UPDATE plugins SET admin_suspended = 1').run();
    expect(await sitemap()).not.toContain(detail);
  });

  // V03: 停止したプラグインも、一覧と検索結果のページにリンクを出さない。
  it('停止したプラグインを、一覧と検索結果のページに出さない', async () => {
    await register();
    await markListable(env.DB);
    const link = `/plugins/${OWNER}/${REPO}`;
    const pages = ['/?lang=en', '/?lang=en&q=pitch', '/?lang=en&category=utility'];
    for (const path of pages) expect(await (await SELF.fetch(`${ORIGIN}${path}`)).text(), path).toContain(link);
    await env.DB.prepare('UPDATE plugins SET admin_suspended = 1').run();
    for (const path of pages) expect(await (await SELF.fetch(`${ORIGIN}${path}`)).text(), path).not.toContain(link);
  });

  // V03: 検査待ちのプラグインは、検索結果のページにも出さない。
  it('検査待ちのプラグインを、検索結果のページに出さない', async () => {
    await register();
    const html = await (await SELF.fetch(`${ORIGIN}/?lang=en&q=pitch`)).text();
    expect(html).not.toContain(`/plugins/${OWNER}/${REPO}`);
  });

  // V04: 右の列の新着と週間のランキングに、検査待ちと停止のプラグインを出さない。
  it('右の列の新着と週間 DL 数ランキングに、検査待ちと停止のプラグインを出さない', async () => {
    await register();
    const id = `${OWNER}/${REPO}`.toLowerCase();
    const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
    for (const [offset, total] of [
      [7, 90],
      [0, 140],
    ] as const) {
      await env.DB.prepare('INSERT INTO download_snapshots (plugin_id, day, total) VALUES (?, ?, ?)')
        .bind(id, day(offset), total)
        .run();
    }
    // 本文にプラグインの一覧が無い画面で、右の列を見る。
    const side = async () => (await SELF.fetch(`${ORIGIN}/about?lang=ja`)).text();
    const link = `/plugins/${OWNER}/${REPO}`;
    const pending = await side();
    expect(pending).not.toContain(link);
    expect(pending).not.toContain('<ol class="weekly">');

    await markListable(env.DB);
    const listed = await side();
    expect(listed).toContain(link);
    expect(listed).toContain('<ol class="weekly">');

    await env.DB.prepare('UPDATE plugins SET admin_suspended = 1').run();
    const suspended = await side();
    expect(suspended).not.toContain(link);
    expect(suspended).not.toContain('<ol class="weekly">');
  });

  // 姉妹サービスへ移っても、利用者が選んだ言語のまま読めること。
  it('フッターの姉妹サービスへのリンクは表示中の言語を引き継ぐ', async () => {
    const html = await (await SELF.fetch(`${ORIGIN}/?lang=ko`)).text();
    expect(html).toContain('href="https://soko-kun.allegromoltov.jp/?lang=ko"');
  });

  it('検査待ちのプラグインを一覧に出さず、詳細にもダウンロードの案内を出さない', async () => {
    await register();
    const list = await (await SELF.fetch(`${ORIGIN}/?lang=en`)).text();
    expect(list).not.toContain(`/plugins/${OWNER}/${REPO}`);
    const detail = await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=en`);
    expect(detail.status).toBe(404);
    expect(await detail.text()).not.toContain('releases/download');
  });

  it('名前を変える前の URL は新しい URL へ 301 で転送する', async () => {
    await register();
    await markListable(env.DB);
    await env.DB.prepare("UPDATE plugins SET repo = 'fixture-pitchshift'").run();
    await env.DB.prepare(
      "INSERT INTO plugin_aliases (alias, plugin_id, created_at) VALUES (?, (SELECT id FROM plugins), '2026-11-13T00:00:00Z')",
    )
      .bind(`${OWNER}/${REPO}`)
      .run();
    const response = await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=en`, { redirect: 'manual' });
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toContain(`/plugins/${OWNER}/fixture-pitchshift`);
  });

  // 旧い名前に別のプラグインができても、旧い URL は元のプラグインに向ける (派生元の ADR 0015)。
  it('旧い URL は、同じ名前の別のプラグインより、名前を変えた元のプラグインに向ける', async () => {
    await register();
    await markListable(env.DB);
    await env.DB.prepare("UPDATE plugins SET repo = 'fixture-pitchshift'").run();
    await env.DB.prepare(
      "INSERT INTO plugin_aliases (alias, plugin_id, created_at) VALUES (?, (SELECT id FROM plugins), '2026-11-13T00:00:00Z')",
    )
      .bind(`${OWNER}/${REPO}`.toLowerCase())
      .run();
    // 旧い名前を使う別のプラグイン (この修正の前に登録できた場合を想定)。
    await env.DB.prepare(
      `INSERT INTO plugins (id, github_repo_id, owner, repo, license_spdx, submitter_github_id, created_at, updated_at, last_synced_at)
       VALUES ('attacker/x', 777, ?, ?, 'MIT', 2, '2026-11-14T00:00:00Z', '2026-11-14T00:00:00Z', '2026-11-14T00:00:00Z')`,
    )
      .bind(OWNER, REPO)
      .run();
    const response = await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=en`, { redirect: 'manual' });
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toContain(`/plugins/${OWNER}/fixture-pitchshift`);
  });

  // 画像の表は内部の ID (名前を変える前の owner/repo) で引く。URL の ID で引くと、名前を変えたプラグインの画像が 404 になる。
  it('名前を変えたプラグインの画像を、新しい URL で配信する', async () => {
    await register();
    await markListable(env.DB);
    const internalId = `${OWNER}/${REPO}`.toLowerCase();
    await env.DB.prepare(
      "INSERT INTO plugin_images (plugin_id, kind, blob_sha, content_type, width, height, bytes, fetched_at) VALUES (?, 'logo', 'x', 'image/png', 64, 64, ?, '2026-11-09T00:00:00Z')",
    )
      .bind(internalId, png(64, 64))
      .run();
    await env.DB.prepare(
      "INSERT INTO plugin_images (plugin_id, kind, blob_sha, content_type, width, height, bytes, fetched_at) VALUES (?, 'image', 'g1', 'image/gif', 640, 360, ?, '2026-11-09T00:00:00Z')",
    )
      .bind(internalId, new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x80, 0x02, 0x68, 0x01]))
      .run();
    await env.DB.prepare(
      "INSERT INTO plugin_image_previews (plugin_id, source_sha, width, height, bytes, made_at) VALUES (?, 'g1', 640, 360, ?, '2026-11-09T00:00:00Z')",
    )
      .bind(internalId, new Uint8Array([1]))
      .run();
    await env.DB.prepare("UPDATE plugins SET repo = 'fixture-pitchshift'").run();

    for (const kind of ['logo', 'image', 'preview']) {
      const response = await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/fixture-pitchshift/${kind}`);
      expect(response.status, kind).toBe(200);
      await response.arrayBuffer();
    }
  });

  it('止めた版は、詳細ページと告知ページに警告として出し、告知の文はエスケープする', async () => {
    await register();
    await markListable(env.DB);
    // 掲載中の版より前の版を止めた状態を作る。
    await env.DB.prepare(
      "INSERT INTO releases (github_release_id, plugin_id, tag, name, commit_sha, published_at, html_url) SELECT 1, plugin_id, 'v0.9.0', NULL, 'x', '2026-01-01T00:00:00Z', 'https://example.invalid' FROM releases",
    ).run();
    await env.DB.prepare(
      "INSERT INTO release_suspensions (plugin_id, github_release_id, tag, reason, note, suspended_at) SELECT id, 1, 'v0.9.0', 'admin', 'Delete <b>it</b>', '2026-11-13T00:00:00Z' FROM plugins",
    ).run();
    const notices = await (await SELF.fetch(`${ORIGIN}/notices?lang=en`)).text();
    expect(notices).toContain('v0.9.0');
    expect(notices).toContain('Delete &lt;b&gt;it&lt;/b&gt;');
    const detail = await (await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=en`)).text();
    expect(detail).toContain('Suspended versions');
    expect(detail).toContain('releases/download');
  });

  it('機械翻訳した概要に含まれる script もエスケープする', async () => {
    await register();
    await markListable(env.DB);
    await env.DB.prepare(
      "INSERT INTO plugin_translations (plugin_id, lang, source_hash, text, translated_at) VALUES (?, 'ja', 'x', '訳\u003cscript>alert(2)\u003c/script>', '2026-11-09T00:00:00Z')",
    )
      .bind(`${OWNER}/${REPO}`.toLowerCase())
      .run();
    const html = await (await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=ja`)).text();
    expect(html).toContain('訳&lt;script&gt;alert(2)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(2)</script>');
    // 詳細ページの構造化データにも概要が入るため、< を置き換えて script の外へ出さない。
    expect(html).toContain('"@type":"SoftwareApplication"');
    expect(html).toContain('訳\\u003cscript>alert(2)\\u003c/script>');
  });

  it('連絡先のアドレスをページに書かず、フォームの送信を受けたときだけ [at] の形で返す', async () => {
    for (const path of ['/', '/report', '/terms', '/privacy', '/contact']) {
      const html = await (await SELF.fetch(`${ORIGIN}${path}?lang=ja`)).text();
      expect(html).not.toContain('audio-soko-kun.example');
    }
    const response = await SELF.fetch(`${ORIGIN}/contact?lang=ja`, { method: 'POST' });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('allegromoltov [at] audio-soko-kun.example');
    expect(html).not.toContain('allegromoltov@audio-soko-kun.example');
  });

  it('画像は掲載中で、非表示にしていないプラグインのものだけを配信する', async () => {
    await register();
    await env.DB.prepare(
      "INSERT INTO plugin_images (plugin_id, kind, blob_sha, content_type, width, height, bytes, fetched_at) VALUES (?, 'logo', 'x', 'image/png', 64, 64, ?, '2026-11-09T00:00:00Z')",
    )
      .bind(`${OWNER}/${REPO}`.toLowerCase(), png(64, 64))
      .run();
    const url = `${ORIGIN}/plugins/${OWNER}/${REPO}/logo`;
    expect((await SELF.fetch(url)).status).toBe(404);

    await markListable(env.DB);
    const listed = await SELF.fetch(url);
    expect(listed.status).toBe(200);
    expect(listed.headers.get('Content-Type')).toBe('image/png');
    expect(listed.headers.get('X-Content-Type-Options')).toBe('nosniff');
    await listed.arrayBuffer();

    await env.DB.prepare('UPDATE plugins SET images_hidden = 1').run();
    expect((await SELF.fetch(url)).status).toBe(404);
  });

  // P41: ロゴに加えて、説明の画像と表示用の静止画も、検査待ちのプラグインでは 404 にする。
  it('検査待ちのプラグインの説明の画像と表示用の静止画は 404 にする', async () => {
    await register();
    const id = `${OWNER}/${REPO}`.toLowerCase();
    await env.DB.prepare(
      "INSERT INTO plugin_images (plugin_id, kind, blob_sha, content_type, width, height, bytes, fetched_at) VALUES (?, 'image', 'g1', 'image/gif', 640, 360, ?, '2026-11-09T00:00:00Z')",
    )
      .bind(id, new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x80, 0x02, 0x68, 0x01]))
      .run();
    await env.DB.prepare(
      "INSERT INTO plugin_image_previews (plugin_id, source_sha, width, height, bytes, made_at) VALUES (?, 'g1', 640, 360, ?, '2026-11-09T00:00:00Z')",
    )
      .bind(id, new Uint8Array([1]))
      .run();
    const fetchKind = (kind: string) => SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}/${kind}`);
    for (const kind of ['image', 'preview']) {
      const response = await fetchKind(kind);
      expect(response.status, kind).toBe(404);
      await response.arrayBuffer();
    }
    // 対照: 掲載すれば同じ画像を配信する。
    await markListable(env.DB);
    for (const kind of ['image', 'preview']) {
      const response = await fetchKind(kind);
      expect(response.status, kind).toBe(200);
      await response.arrayBuffer();
    }
  });

  // 閉じた details の中の img は loading="lazy" のときだけ読み込まれない。外れると、開く前に GIF を読み込んで重くなる。
  it('説明の GIF は閉じた details の中に loading="lazy" で置き、表示用の静止画を先に見せる', async () => {
    await register();
    await markListable(env.DB);
    const id = `${OWNER}/${REPO}`.toLowerCase();
    await env.DB.prepare(
      "INSERT INTO plugin_images (plugin_id, kind, blob_sha, content_type, width, height, bytes, fetched_at) VALUES (?, 'image', 'g1', 'image/gif', 640, 360, ?, '2026-11-09T00:00:00Z')",
    )
      .bind(id, new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x80, 0x02, 0x68, 0x01]))
      .run();
    const page = async () => (await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=ja`)).text();

    const before = await page();
    expect(before).toMatch(/<details class="shot anim"><summary><svg class="placeholder"/);
    expect(before).toMatch(/<img src="\/plugins\/[^"]+\/image\?v=g1"[^>]*loading="lazy"/);

    await env.DB.prepare(
      "INSERT INTO plugin_image_previews (plugin_id, source_sha, width, height, bytes, made_at) VALUES (?, 'g1', 640, 360, ?, '2026-11-09T00:00:00Z')",
    )
      .bind(id, new Uint8Array([1]))
      .run();
    const after = await page();
    expect(after).toMatch(/<summary><img src="\/plugins\/[^"]+\/preview\?v=g1"/);
    expect(after).toMatch(/<img src="\/plugins\/[^"]+\/image\?v=g1"[^>]*loading="lazy"/);
  });

  it('週間 DL 数ランキングは 7 日以上前の記録がたまるまで右の列に出さない', async () => {
    await register();
    await markListable(env.DB);
    const id = `${OWNER}/${REPO}`.toLowerCase();
    const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
    const insert = (offset: number, total: number) =>
      env.DB.prepare('INSERT INTO download_snapshots (plugin_id, day, total) VALUES (?, ?, ?)')
        .bind(id, day(offset), total)
        .run();
    await insert(6, 100);
    await insert(0, 140);
    expect(await (await SELF.fetch(`${ORIGIN}/?lang=ja`)).text()).not.toContain('週間 DL 数ランキング 5 件');

    await insert(7, 90);
    const html = await (await SELF.fetch(`${ORIGIN}/?lang=ja`)).text();
    expect(html).toContain('週間 DL 数ランキング 5 件');
    expect(html).toMatch(/<ol class="weekly">.*?50<\/span>/s);
  });

  it('canonical は lang と category と page だけを残し、検索語のページは noindex にする', async () => {
    const top = await (await SELF.fetch(`${ORIGIN}/?lang=en&utm_source=x&category=effect`)).text();
    expect(top).toContain(`<link rel="canonical" href="${ORIGIN}/?category=effect&amp;lang=en"/>`);
    expect(top).not.toContain('<meta name="robots" content="noindex"/>');
    const search = await (await SELF.fetch(`${ORIGIN}/?lang=en&q=pitch`)).text();
    expect(search).toContain('<meta name="robots" content="noindex"/>');
  });

  // 有料・素材の申告の表示 (docs/design/scanning.md の「有料・素材の申告」)。申告は作者の主張で、外部データとして扱う。
  const declare = (config: Record<string, unknown>) =>
    env.DB.prepare("UPDATE release_checks SET config_state = 'ok', config_json = ?").bind(JSON.stringify(config)).run();
  const detailPage = async () => (await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=en`)).text();
  // 一覧の本文。右の列にはタグが無いため、本文だけを見る。
  const listMain = async () =>
    (await (await SELF.fetch(`${ORIGIN}/?lang=en`)).text()).split('<main')[1]?.split('</main>')[0] ?? '';
  const row = (html: string, label: string) =>
    html.match(new RegExp(`<th scope="row">${label}</th><td>(.*?)</td>`, 's'))?.[1] ?? '';

  it('申告の無い項目は「作者の申告なし」と表示し、「なし」と表示しない。一覧にも申告のタグを付けない', async () => {
    await register();
    await markListable(env.DB);
    await declare({ name: 'Pitch', paidServices: [] });
    const detail = await detailPage();
    expect(row(detail, 'Features unlocked by payment')).toBe('Not declared by the author');
    expect(row(detail, 'Restrictions on bundled assets, such as no commercial use')).toBe('Not declared by the author');
    expect(row(detail, 'Support or purchase page')).toBe('Not declared by the author');
    // [] は無いと申告したことで、申告なしと区別する。
    expect(row(detail, 'Paid services used separately')).toBe('None (declared)');
    expect(detail).toContain('This platform does not verify them.');
    // 申告なしでも、掲載中のものには無料と商用利用可のタグを付け、有料と素材の制限のタグは付けない。
    const list = await listMain();
    expect(list).toContain('<span class="pill">Free</span>');
    expect(list).toContain('<span class="pill">Commercial use OK</span>');
    for (const tag of ['Paid features', 'Needs paid external services', 'Assets restrict commercial use']) {
      expect(list, tag).not.toContain(tag);
    }
  });

  // U4: 再配布の条件を本文で確かめられるよう、確かめたライセンスを SPDX の本文へリンクする。
  it('確かめたライセンスの SPDX 識別子を、SPDX のライセンスの本文へリンクする', async () => {
    await register();
    await markListable(env.DB);
    const license = row(await detailPage(), 'License');
    expect(license).toMatch(
      /<a href="https:\/\/spdx\.org\/licenses\/[A-Za-z0-9.+-]+\.html" rel="noopener noreferrer">/,
    );
  });

  it('申告した値を作者の申告の区画に表示し、作者の文字列はエスケープし、支援のページには nofollow を付ける', async () => {
    await register();
    await markListable(env.DB);
    await declare({
      paidFeatures: true,
      paidServices: ['Cloud<script>alert(5)</script>', 'Sync'],
      restrictedAssets: false,
      supportUrl: 'https://example.booth.pm/items/1',
    });
    const detail = await detailPage();
    expect(row(detail, 'Features unlocked by payment')).toBe('Yes');
    expect(row(detail, 'Restrictions on bundled assets, such as no commercial use')).toBe('No');
    expect(row(detail, 'Paid services used separately')).toContain('Cloud&lt;script&gt;alert(5)&lt;/script&gt;, Sync');
    expect(detail).not.toContain('<script>alert(5)</script>');
    expect(row(detail, 'Support or purchase page')).toMatch(
      /^<a href="https:\/\/example\.booth\.pm\/items\/1" rel="noopener noreferrer nofollow" target="_blank"/,
    );
    // ライセンスは、このプラットフォームが確かめた項目の区画に置く。作者の申告の区画より前にある。
    expect(detail.indexOf('Checked by this platform')).toBeLessThan(detail.indexOf('Approved by the OSI'));
    expect(detail.indexOf('Approved by the OSI')).toBeLessThan(detail.indexOf('Declared by the author'));

    const list = await listMain();
    // 有料の機能と外部の有料サービスは別のタグで、両方を申告すれば両方を付ける。並びは無料・商用・機能・サービスの順。
    const order = [
      '<span class="pill">Free to download</span>',
      '<span class="pill">Commercial use OK</span>',
      '<span class="pill">Paid features</span>',
      '<span class="pill">Needs paid external services</span>',
    ].map((tag) => list.indexOf(tag));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // false と申告した素材の制限には、タグを付けない。
    expect(list).not.toContain('Assets restrict commercial use');
  });

  it('掲載していない新しい版の申告は、詳細ページにも一覧にも出さない', async () => {
    await register();
    await markListable(env.DB);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO releases (github_release_id, plugin_id, tag, name, commit_sha, published_at, html_url)
         SELECT 7003, plugin_id, 'v9.9.9-new', NULL, 'y', '2026-11-15T00:00:00Z', 'https://example.invalid' FROM releases`,
      ),
      env.DB.prepare(
        `INSERT INTO release_checks (github_release_id, immutable, license_state, diff_state, config_state, config_json, review_state)
         VALUES (7003, 1, 'passed', 'held', 'ok', ?, 'done')`,
      ).bind(
        JSON.stringify({
          paidFeatures: true,
          paidServices: ['NEW-SERVICE-MARKER'],
          restrictedAssets: true,
          supportUrl: 'https://ko-fi.com/newmarker',
        }),
      ),
    ]);
    const detail = await detailPage();
    expect(detail).toContain('v1.1.0');
    expect(detail).not.toContain('NEW-SERVICE-MARKER');
    expect(detail).not.toContain('ko-fi.com/newmarker');
    expect(row(detail, 'Features unlocked by payment')).toBe('Not declared by the author');
    expect(await listMain()).not.toContain('Paid features');
  });

  // 無料のものに「入手は無料」と書くと留保に見える (依頼者 2026-11-19)。有料の申告が無ければ「無料」にする。
  it('有料の申告があるときだけ「入手は無料」を付け、無いときは「無料」を付ける', async () => {
    await register();
    await markListable(env.DB);
    expect(await listMain()).toContain('<span class="pill">Free</span>');
    expect(await listMain()).not.toContain('Free to download');
    await declare({ paidFeatures: false, paidServices: ['Example Cloud'], restrictedAssets: false });
    const paid = await listMain();
    expect(paid).toContain('<span class="pill">Free to download</span>');
    expect(paid).not.toContain('<span class="pill">Free</span>');
  });

  it('素材の制限を true と申告したプラグインにだけ、一覧で素材の制限のタグを付ける', async () => {
    await register();
    await markListable(env.DB);
    await declare({ paidFeatures: false, paidServices: [], restrictedAssets: true });
    const list = await listMain();
    expect(list).toContain('<span class="pill">Assets restrict commercial use</span>');
    // 制限のタグと商用利用可のタグは同時に出さない。
    expect(list).not.toContain('Commercial use OK');
    expect(list).not.toContain('Paid features');
    expect(list).not.toContain('Needs paid external services');
  });

  // 詳細の見出しの下にも、一覧と同じタグを付ける (本家と共通)。見た目はほかのタグと同じ素の .pill。
  it('詳細の見出しの下に無料と商用利用可のタグを付け、カードの区切りの線はカードの li にだけ当てる', async () => {
    await register();
    await markListable(env.DB);
    await declare({ restrictedAssets: false });
    const detail = await detailPage();
    const tags = detail.split('<ul class="tags">')[1]?.split('</ul>')[0] ?? '';
    expect(tags).toContain('<span class="pill">Free</span>');
    expect(tags).toContain('<span class="pill">Commercial use OK</span>');
    expect(detail).not.toContain('pill declared');
    // カードの中のタグの li に点線と余白を当てない。
    const css = await (await SELF.fetch(`${ORIGIN}/style.css`)).text();
    expect(css).toContain('ol.cards > li {');
    expect(css).not.toContain('ol.cards li {');
  });

  // 商用利用の 1 行 (本家と共通)。作者に新しい項目は申告させず、ライセンスの判定と restrictedAssets から組み立てる。
  // 外部の有料サービスだけを申告したものに、作者に払う有料の機能があるように見えるタグを付けない (本家 0.3.0 の不具合)。
  it('外部の有料サービスだけを申告したものには、有料の機能のタグを付けない', async () => {
    await register();
    await markListable(env.DB);
    await declare({ paidFeatures: false, paidServices: ['OpenAI API'] });
    const list = await listMain();
    expect(list).toContain('<span class="pill">Needs paid external services</span>');
    expect(list).not.toContain('<span class="pill">Paid features</span>');
  });

  it('商用利用の行は restrictedAssets の申告で書き分け、外部の有料サービスがあれば規約の注意を添える', async () => {
    await register();
    await markListable(env.DB);
    const commercial = async () => row(await detailPage(), 'Commercial use');
    await declare({ restrictedAssets: false });
    expect(await commercial()).toContain('Bundled assets: the author declared no restrictions.');
    await declare({ restrictedAssets: true });
    expect(await commercial()).toContain('the author declared restrictions such as no commercial use');
    await declare({ paidServices: ['Cloud'] });
    const undeclared = await commercial();
    expect(undeclared).toContain('Bundled assets: not declared by the author.');
    expect(undeclared).toContain('The code can be used commercially under the conditions of its license');
    expect(undeclared).toContain('Also check the terms of the paid services.');
    await declare({ restrictedAssets: false, paidServices: [] });
    expect(await commercial()).not.toContain('terms of the paid services');
  });

  // ヘッダーの副題は入手が無料であることを示し、注意の帯は「無料のサービス」と書かない (本家と共通)。
  it('副題は無料で入手できることを示し、注意の帯からは無料を外す', async () => {
    const ja = await (await SELF.fetch(`${ORIGIN}/?lang=ja`)).text();
    expect(ja).toContain('無料で入手できるオーディオプラグインの倉庫');
    expect(ja).not.toContain('非公式で無料のサービス');
    const en = await (await SELF.fetch(`${ORIGIN}/?lang=en`)).text();
    expect(en).toContain('A warehouse of free-to-download audio plugins');
    expect(en).not.toContain('unofficial, free service');
  });

  // 作者向けの最重要の文は、/submit と /policy の先頭に枠で置く。
  it.each(['submit', 'policy'])('/%s の本文の先頭に、作者向けの最重要の文を枠で置く', async (page) => {
    const html = await (await SELF.fetch(`${ORIGIN}/${page}?lang=en`)).text();
    const main = html.split('<main')[1] ?? '';
    const first = main.indexOf('<p');
    expect(main.slice(first, first + 40)).toContain('<p class="callout important">');
    expect(main).toContain('anyone can use and redistribute its code commercially under the conditions of its license');
  });

  // VST の語の表示 (ADR 0004、docs/design/testing.md の V10〜V13)。
  const LOGO = '<img src="/images/vst-compatible.png"';
  const NOTICE = 'VST is a registered trademark of Steinberg Media Technologies GmbH.';

  it('VST 3 のバンドルを検出しなかったプラグインは、VST 3 の絞り込みに出さず、詳細ページに VST の語もロゴも出さない', async () => {
    await register();
    await markListable(env.DB);
    await env.DB.prepare(
      `UPDATE content_checks SET formats = '["clap"]',
         bundles = '[{"path":"Fixture.clap","format":"clap","os":["windows"],"arches":["x86_64"]}]'`,
    ).run();
    // 右の列の新着は絞り込みに関係なく出るため、本文だけを見る。
    const main = async (query: string) =>
      (await (await SELF.fetch(`${ORIGIN}/?lang=en&${query}`)).text()).split('<main')[1]?.split('</main>')[0] ?? '';
    expect(await main('format=vst3')).not.toContain(`/plugins/${OWNER}/${REPO}`);
    expect(await main('format=clap')).toContain(`/plugins/${OWNER}/${REPO}`);
    const detail = await (await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=en`)).text();
    expect(detail).toContain('CLAP');
    expect(detail).not.toContain('VST');
    expect(detail).not.toContain(LOGO);
  });

  it('VST 3 のバンドルを検出したプラグインの詳細ページは、VST® 3 のタグと同じ行にロゴを置き、商標の注記を出す', async () => {
    await register();
    await markListable(env.DB);
    const detail = await (await SELF.fetch(`${ORIGIN}/plugins/${OWNER}/${REPO}?lang=ja`)).text();
    // 同じタグの並び (ul.tags) の中に、VST® 3 のタグとロゴの両方がある。
    expect(detail).toMatch(/<ul class="tags">(?:(?!<\/ul>).)*VST® 3(?:(?!<\/ul>).)*<picture class="vst-logo">/s);
    expect(detail).toContain(NOTICE);
    expect(detail.indexOf('VST® 3')).toBe(detail.indexOf('VST'));
  });

  it('規格の選択肢に VST® 3 を出す一覧と検索結果のページは、説明の文と組にしたロゴと、ロゴを伴う商標の注記を出す', async () => {
    for (const query of ['', '&format=vst3', '&q=pitch']) {
      const html = await (await SELF.fetch(`${ORIGIN}/?lang=en${query}`)).text();
      // 本文の中で、ロゴは VST® 3 のタグの条件を説明する文と同じ行にある。
      expect(html, query).toMatch(
        /<p class="vst-note"><picture class="vst-logo">.*?<\/picture><span>The VST® 3 tag is shown only/s,
      );
      // 絞り込みの隣には、説明の無いロゴを置かない。
      expect(html, query).not.toMatch(/<\/select><\/label><picture class="vst-logo">/);
      // 商標の注記の横にもロゴがある。
      expect(html, query).toMatch(
        /<p class="trademark" lang="en"><picture class="vst-logo">.*?<\/picture><span>VST is a registered trademark/s,
      );
      expect(html, query).toContain(NOTICE);
    }
  });

  it('VST の語を書く固定ページは、VST の語より前にロゴを伴う規格の行を置き、商標の注記を出す', async () => {
    for (const lang of Object.keys(PAGES) as Array<keyof typeof PAGES>) {
      for (const key of PAGE_KEYS) {
        const blocks = PAGES[lang][key].sections.flatMap((section) => [section.heading, ...section.paragraphs]);
        const firstVst = blocks.findIndex((block) => JSON.stringify(block).includes('VST'));
        if (firstVst === -1) continue;
        const formats = blocks.findIndex((block) => typeof block === 'object' && 'formats' in block);
        expect(formats, `${lang} ${key}`).toBeGreaterThanOrEqual(0);
        expect(formats, `${lang} ${key}`).toBeLessThan(firstVst);
      }
    }
    for (const key of ['about', 'policy', 'submit', 'security']) {
      const html = await (await SELF.fetch(`${ORIGIN}/${key}?lang=ja`)).text();
      expect(html, key).toContain(LOGO);
      expect(html, key).toContain(NOTICE);
    }
    const terms = await (await SELF.fetch(`${ORIGIN}/terms?lang=ja`)).text();
    expect(terms).not.toContain(NOTICE);
  });
});

// 検索欄の文を利用者自身の AI (Google の AI モード) に渡すボタン。倉庫くんは検索をせず、質問の文を組み立てて移るだけ。
describe('Google AI で検索', () => {
  async function postAiSearch(fields: Record<string, string>, init: RequestInit = {}): Promise<Response> {
    return SELF.fetch(`${ORIGIN}/ai-search`, { method: 'POST', body: new URLSearchParams(fields), ...init });
  }

  // 応答の meta refresh とリンクから、移り先の URL を取り出す。属性の & は &amp; で出る。
  function targetsOf(html: string): { refresh: URL; link: URL } {
    const refresh = html.match(/<meta http-equiv="refresh" content="0;url=([^"]+)"/)?.[1];
    const link = html.match(/<a href="(https:\/\/www\.google\.com\/[^"]+)"/)?.[1];
    if (!refresh || !link) throw new Error('the redirect targets are missing');
    const decode = (value: string) => new URL(value.replaceAll('&amp;', '&'));
    return { refresh: decode(refresh), link: decode(link) };
  }

  function searchFormsOf(html: string): string[] {
    return html
      .split('<form')
      .slice(1)
      .filter((form) => form.includes('name="q"'));
  }

  it('2 つの検索フォームの両方に、検索のボタンより後ろにボタンを置く', async () => {
    const html = await (await SELF.fetch(`${ORIGIN}/?lang=ja`)).text();
    const searchForms = searchFormsOf(html);
    expect(searchForms).toHaveLength(2);
    for (const form of searchForms) {
      const button = form.indexOf('formaction="/ai-search"');
      expect(button).toBeGreaterThan(form.indexOf('class="icon-button"'));
      const tag = form.slice(form.lastIndexOf('<button', button), form.indexOf('>', button));
      expect(tag).toContain('formmethod="post"');
      expect(tag).toContain('formtarget="_blank"');
    }
    // 上部の帯だけを持つ固定ページにも、上部の帯のボタンがある
    const about = await (await SELF.fetch(`${ORIGIN}/about?lang=ja`)).text();
    expect(about.split('formaction="/ai-search"')).toHaveLength(2);
  });

  it('7 言語のそれぞれで、ボタンの文言と、その言語の質問の文とカタログの URL で移る', async () => {
    for (const lang of LANGS) {
      const t = DICTS[lang];
      const page = await (await SELF.fetch(`${ORIGIN}/?lang=${lang}`)).text();
      expect(page).toContain(escapeHtml(t.aiSearchButton));
      expect(page).toContain(escapeHtml(t.aiSearchHint));
      const response = await postAiSearch({ lang, q: '  音量 balance  ' });
      expect(response.status).toBe(200);
      const html = await response.text();
      const { refresh, link } = targetsOf(html);
      expect(refresh.href).toBe(link.href);
      expect(refresh.origin + refresh.pathname).toBe('https://www.google.com/search');
      expect(refresh.searchParams.get('udm')).toBe('50');
      const q = refresh.searchParams.get('q');
      expect(q).toBe(t.aiSearchPrompt(`${ORIGIN}/`, '音量 balance'));
      expect(q, lang).not.toContain('?lang=');
      expect(html, lang).not.toContain('&#39;');
      expect(t.aiSearchPrompt('CATALOG', 'INPUT'), lang).toMatch(/URL.*INPUT$/s);
      expect(html).toContain(escapeHtml(t.aiSearchRedirect));
    }
  });

  // 言語を決めるミドルウェアは本文を読まない。Cookie の無い初回の利用者でも、画面の言語の質問の文にする。
  it('Cookie が無いときも、フォームの lang の言語で質問の文を組み立てる', async () => {
    const response = await postAiSearch({ lang: 'ko', q: 'mosaic' }, { headers: { 'Accept-Language': 'en' } });
    const { refresh } = targetsOf(await response.text());
    expect(refresh.searchParams.get('q')).toBe(DICTS.ko.aiSearchPrompt(`${ORIGIN}/`, 'mosaic'));
  });

  it('入力は 100 文字で切り、空のときは探したいものを尋ねるよう伝える', async () => {
    const long = await postAiSearch({ lang: 'ja', q: 'あ'.repeat(150) });
    expect(targetsOf(await long.text()).refresh.searchParams.get('q')).toBe(
      DICTS.ja.aiSearchPrompt(`${ORIGIN}/`, 'あ'.repeat(100)),
    );
    const empty = await postAiSearch({ lang: 'ja', q: '   ' });
    expect(targetsOf(await empty.text()).refresh.searchParams.get('q')).toBe(
      DICTS.ja.aiSearchPrompt(`${ORIGIN}/`, DICTS.ja.aiSearchEmpty),
    );
  });

  // 100 単位目で絵文字が割れると、片割れのサロゲートで encodeURIComponent が例外を投げ、500 になる。
  it('100 単位目で割れるサロゲートペアは落として移る', async () => {
    const response = await postAiSearch({ lang: 'en', q: `${'a'.repeat(99)}😀` });
    expect(response.status).toBe(200);
    expect(targetsOf(await response.text()).refresh.searchParams.get('q')).toBe(
      DICTS.en.aiSearchPrompt(`${ORIGIN}/`, 'a'.repeat(99)),
    );
  });

  // 大きな本文や multipart をメモリに展開しない。
  it('フォームの送信以外の形と、4 KB を超える本文は受け付けない', async () => {
    const multipart = new FormData();
    multipart.set('q', 'noise');
    const asMultipart = await SELF.fetch(`${ORIGIN}/ai-search`, { method: 'POST', body: multipart });
    expect(asMultipart.status).toBe(415);
    const large = await postAiSearch({ lang: 'en', q: 'a'.repeat(5000) });
    expect(large.status).toBe(413);
  });

  // 検索のボタンと AI のボタンを並列に扱い、2 つのフォームで同じ文言を見せる。
  it('7 言語のそれぞれで、2 つのフォームとも検索のボタンと AI のボタンに同じ文言を見せる', async () => {
    for (const lang of LANGS) {
      const t = DICTS[lang];
      const html = await (await SELF.fetch(`${ORIGIN}/?lang=${lang}`)).text();
      const searchForms = searchFormsOf(html);
      expect(searchForms).toHaveLength(2);
      for (const form of searchForms) {
        expect(form).toContain(`<span>${escapeHtml(t.searchButton)}</span>`);
        expect(form).toContain(`<span>${escapeHtml(t.aiSearchButton)}</span>`);
      }
    }
  });

  // Google の確認画面が出た質問の URL は 1,911 文字だった。原因は未特定のため、最大の入力での長さを見張る。
  it('最大の長さの入力でも、移り先の URL は 7 言語とも 2,048 文字に収まる', async () => {
    for (const lang of LANGS) {
      const response = await postAiSearch({ lang, q: '漢'.repeat(100) });
      const { refresh } = targetsOf(await response.text());
      expect(refresh.href.length, lang).toBeLessThanOrEqual(2048);
      // 本番の ORIGIN でも収まる
      const production = DICTS[lang].aiSearchPrompt('https://audio-soko-kun.allegromoltov.jp/', '漢'.repeat(100));
      expect(aiSearchUrl(production).length, lang).toBeLessThanOrEqual(2048);
    }
  });

  it('移るための応答は検索エンジンに載せず、キャッシュさせず、CSP を変えない', async () => {
    const response = await postAiSearch({ lang: 'en', q: 'noise' });
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).toContain('<meta name="robots" content="noindex"/>');
    const csp = response.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain('google');
    expect(csp).not.toContain('script-src');
  });

  it('プライバシーポリシーに、送った文を保存せず Google の AI モードへ渡すことを書く', async () => {
    const html = await (await SELF.fetch(`${ORIGIN}/privacy?lang=ja`)).text();
    expect(html).toContain('「Google AI で検索」のボタンで送った文は、このプラットフォームに保存せず');
  });
});

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
