// 宣言ファイルの形と照合 (docs/design/testing.md の X08・X09・C13・S14)。
// 宣言の誤りが通る経路と、宣言で中身の検査の検出を上書きできる経路を塞いでいることを確かめる。
import { env } from 'cloudflare:test';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { Budget } from '../../src/budget';
import { getPluginViewByInternalId } from '../../src/domain/catalog';
import {
  type ArchiveForDeclaration,
  type Declaration,
  judgeDeclaration,
  matchesPattern,
  NO_PRICING,
  parseDeclaration,
  parseSupportUrl,
  serializeDeclaration,
  settleDeclarations,
  storedPricing,
} from '../../src/domain/declaration';
import { runReleaseChecks } from '../../src/domain/release-checks';
import { submitPlugin } from '../../src/domain/submit';
import { markListable } from '../fixtures/checks';
import { githubHandlers, OWNER, REPO, releaseCheckHandlers, USER_TOKEN } from '../fixtures/github';
import { network } from '../setup';

const WINDOWS_ZIP = 'simple-pitchshift-1.0.0-windows-x64.zip';
const asset = {
  pattern: 'simple-pitchshift-*-windows-x64.zip',
  os: 'windows',
  arch: ['x86_64'],
  formats: ['vst3', 'clap'],
};

describe('X08 宣言ファイルの pattern', () => {
  it('* だけを任意の文字列として扱う', () => {
    expect(matchesPattern(asset.pattern, WINDOWS_ZIP)).toBe(true);
    expect(matchesPattern(asset.pattern, 'simple-pitchshift-1.0.0-windows-x64.zip.sig')).toBe(false);
    expect(matchesPattern('*', 'anything.zip')).toBe(true);
  });

  it('.・?・[ などを文字として照合する', () => {
    expect(matchesPattern('plugin.zip', 'pluginXzip')).toBe(false);
    expect(matchesPattern('plugin-?.zip', 'plugin-a.zip')).toBe(false);
    expect(matchesPattern('plugin-?.zip', 'plugin-?.zip')).toBe(true);
    expect(matchesPattern('[ab].zip', 'a.zip')).toBe(false);
    expect(matchesPattern('[ab].zip', '[ab].zip')).toBe(true);
    expect(matchesPattern('(a|b)+.zip', 'aa.zip')).toBe(false);
  });
});

describe('X09 宣言ファイルの形の誤りは invalid にする', () => {
  const invalid: Array<[string, string]> = [
    ['JSON でない', 'not json'],
    ['オブジェクトでない', '["windows"]'],
    ['name が空', '{"name": "  "}'],
    ['name が 61 文字', JSON.stringify({ name: 'a'.repeat(61) })],
    ['category が一覧の外', '{"category": "other"}'],
    ['os が一覧の外', JSON.stringify({ assets: [{ ...asset, os: 'android' }] })],
    ['os が配列', JSON.stringify({ assets: [{ ...asset, os: ['windows'] }] })],
    ['arch が一覧の外', JSON.stringify({ assets: [{ ...asset, arch: ['ppc'] }] })],
    ['formats が空', JSON.stringify({ assets: [{ ...asset, formats: [] }] })],
    ['formats が無い', JSON.stringify({ assets: [{ pattern: asset.pattern, os: 'windows', arch: ['x86_64'] }] })],
    ['pattern が空', JSON.stringify({ assets: [{ ...asset, pattern: '' }] })],
    ['assets が空', '{"assets": []}'],
    ['assets が 21 件', JSON.stringify({ assets: Array.from({ length: 21 }, () => asset) })],
  ];
  for (const [label, text] of invalid) {
    it(label, () => {
      expect(parseDeclaration(text)).toEqual({ state: 'invalid' });
    });
  }

  it('16 KB を超える', () => {
    expect(parseDeclaration('too_large')).toEqual({ state: 'invalid' });
  });

  it('対照: ファイルが無ければ missing、正しい形なら値を正規化して返す', () => {
    expect(parseDeclaration(null)).toEqual({ state: 'missing' });
    expect(
      parseDeclaration(
        JSON.stringify({
          name: ' Simple Pitch Shift ',
          category: 'effect',
          assets: [{ ...asset, arch: ['x86_64', 'x86_64'], formats: ['vst3', 'clap'] }],
        }),
      ),
    ).toEqual({
      state: 'parsed',
      declaration: {
        name: 'Simple Pitch Shift',
        category: 'effect',
        assets: [{ pattern: asset.pattern, os: 'windows', arch: ['x86_64'], formats: ['clap', 'vst3'] }],
        pricing: NO_PRICING,
        notices: [],
      },
    });
  });
});

describe('C13 宣言と中身の検査の結果の照合', () => {
  const declaration = (assets: Declaration['assets']): Declaration => ({
    name: null,
    category: null,
    assets,
    pricing: NO_PRICING,
    notices: [],
  });
  const detected = (changes: Partial<ArchiveForDeclaration> = {}): ArchiveForDeclaration => ({
    name: WINDOWS_ZIP,
    result: 'passed',
    formats: ['clap', 'vst3'],
    os: ['windows'],
    arches: ['x86_64'],
    categories: [],
    ...changes,
  });
  const windows = { pattern: asset.pattern, os: 'windows', arch: ['x86_64'], formats: ['vst3', 'clap'] } as const;
  const state = (decl: Declaration | null, archives: ArchiveForDeclaration[]) => judgeDeclaration(decl, archives).state;

  it('os・arch・formats のどれかが食い違えば mismatch', () => {
    const decl = declaration([{ ...windows, arch: [...windows.arch], formats: [...windows.formats] }]);
    expect(state(decl, [detected({ os: ['linux'] })])).toBe('mismatch');
    expect(state(decl, [detected({ os: ['windows', 'macos'] })])).toBe('mismatch');
    expect(state(decl, [detected({ arches: ['x86_64', 'arm64'] })])).toBe('mismatch');
    expect(state(decl, [detected({ formats: ['vst3'] })])).toBe('mismatch');
    // 規格のバンドルを検出しなかったアーカイブに規格を宣言しても、宣言で検出を上書きしない。
    expect(state(decl, [detected({ result: 'no_plugin', formats: [], os: [], arches: [] })])).toBe('mismatch');
  });

  it('対照: 集合が一致すれば並びによらず ok。fat binary は含むアーキテクチャをすべて並べたとき一致する', () => {
    const fat = declaration([{ pattern: '*-macos.zip', os: 'macos', arch: ['arm64', 'x86_64'], formats: ['vst3'] }]);
    const mac = detected({ name: 'p-macos.zip', os: ['macos'], arches: ['x86_64', 'arm64'], formats: ['vst3'] });
    expect(state(fat, [mac])).toBe('ok');
    expect(state(declaration([{ ...windows, arch: ['x86_64'], formats: ['clap', 'vst3'] }]), [detected()])).toBe('ok');
  });

  it('どのアーカイブもどの pattern にも一致しなければ no_declared_assets', () => {
    const decl = declaration([{ ...windows, pattern: '*-linux.zip', arch: ['x86_64'], formats: ['vst3'] }]);
    expect(state(decl, [detected()])).toBe('no_declared_assets');
  });

  it('pattern に一致しないアーカイブは照合しない。assets が無ければ照合しない', () => {
    const decl = declaration([{ ...windows, arch: ['x86_64'], formats: ['vst3', 'clap'] }]);
    expect(state(decl, [detected(), detected({ name: 'other-linux.zip', os: ['linux'] })])).toBe('ok');
    expect(state(declaration(null), [detected({ os: ['linux'] })])).toBe('ok');
    expect(state(null, [detected()])).toBe('missing');
  });
});

describe('S14 宣言した配布物だけを案内する', () => {
  it('その版の宣言の pattern に一致しないアーカイブは、条件を満たしても案内しない', async () => {
    network.use(...githubHandlers());
    const result = await submitPlugin(
      env,
      { githubUserId: 4242, githubToken: USER_TOKEN },
      `https://github.com/${OWNER}/${REPO}`,
    );
    if (!result.ok) throw new Error(result.code);
    await markListable(env.DB);
    const id = `${OWNER}/${REPO}`.toLowerCase();
    expect((await getPluginViewByInternalId(env, id))?.listedRelease?.assets).toHaveLength(1);

    await env.DB.prepare("UPDATE release_checks SET config_state = 'ok', config_json = ?")
      .bind(JSON.stringify({ assets: [{ pattern: '*-macos.zip', os: 'macos', arch: ['arm64'], formats: ['vst3'] }] }))
      .run();
    const view = await getPluginViewByInternalId(env, id);
    expect(view?.status).not.toBe('listed');
    expect(view?.listedRelease).toBeNull();
  });
});

describe('保存した宣言の再解析', () => {
  // config_json に保存した宣言を、照合のときに parseDeclaration で読み直す。未指定の項目を null で保存すると、
  // 正しい宣言が照合の段階で invalid になり、宣言ファイルのあるリポジトリがすべて掲載されなかった (2026-11-15)。
  const cases: Array<[string, unknown]> = [
    ['name だけ', { name: 'Simple White Noise' }],
    ['category だけ', { category: 'effect' }],
    ['assets だけ', { assets: [asset] }],
    ['すべて', { name: 'Fixture', category: 'instrument', assets: [asset] }],
    ['申告だけ', { paidFeatures: false, paidServices: [], restrictedAssets: true }],
    ['申告と支援のページ', { paidServices: ['OpenAI API'], supportUrl: 'https://example.booth.pm/items/1' }],
  ];
  for (const [label, body] of cases) {
    it(`${label}の宣言は、保存して読み直しても parsed のまま同じ内容になる`, () => {
      const first = parseDeclaration(JSON.stringify(body));
      expect(first.state).toBe('parsed');
      if (first.state !== 'parsed') return;
      const again = parseDeclaration(serializeDeclaration(first.declaration));
      expect(again).toEqual(first);
    });
  }
});

describe('宣言の取得から照合までの通し', () => {
  // 宣言を取得して config_json に保存する処理 (runReleaseChecks) と、中身の検査の後に読み直して照合する処理
  // (settleDeclarations) をつないで確かめる。個々の関数のテストだけでは、保存の形と読み直しの食い違いを見逃した。
  it('name だけの宣言は、中身の検査が passed なら照合を通り、表示名に使われる', async () => {
    network.use(...githubHandlers());
    const result = await submitPlugin(
      env,
      { githubUserId: 4242, githubToken: USER_TOKEN },
      `https://github.com/${OWNER}/${REPO}`,
    );
    if (!result.ok) throw new Error(result.code);
    await markListable(env.DB);
    await env.DB.prepare("UPDATE release_checks SET config_state = 'pending', config_fetched_at = NULL").run();
    // 先に並べたハンドラーが優先される。宣言ファイルを返すハンドラーを、404 を返す共通のハンドラーより前に置く。
    network.use(
      http.get('https://api.github.com/repos/:owner/:repo/contents/.audio-soko-kun/config.json', () =>
        HttpResponse.text('{"name": "Simple White Noise"}\n'),
      ),
      ...releaseCheckHandlers(),
    );
    await runReleaseChecks(env, new Budget());
    const row = await env.DB.prepare('SELECT config_state FROM release_checks').first<{ config_state: string }>();
    expect(row?.config_state).toBe('ok');
    const view = await getPluginViewByInternalId(env, `${OWNER}/${REPO}`.toLowerCase());
    expect(view?.name).toBe('Simple White Noise');
  });
});

describe('X09 宣言ファイルの取得の 16 KB の閾値', () => {
  // 正しい形の宣言を、空白で bytes バイトに伸ばして返す。
  async function checkDeclarationOf(bytes: number): Promise<string | undefined> {
    network.use(...githubHandlers());
    const result = await submitPlugin(
      env,
      { githubUserId: 4242, githubToken: USER_TOKEN },
      `https://github.com/${OWNER}/${REPO}`,
    );
    if (!result.ok) throw new Error(result.code);
    await markListable(env.DB);
    await env.DB.prepare("UPDATE release_checks SET config_state = 'pending', config_fetched_at = NULL").run();
    const json = '{"name": "Simple White Noise"}';
    const body = json + ' '.repeat(bytes - json.length);
    network.use(
      http.get('https://api.github.com/repos/:owner/:repo/contents/.audio-soko-kun/config.json', () =>
        HttpResponse.text(body),
      ),
      ...releaseCheckHandlers(),
    );
    await runReleaseChecks(env, new Budget());
    const row = await env.DB.prepare('SELECT config_state FROM release_checks').first<{ config_state: string }>();
    return row?.config_state;
  }

  it('16 KB ちょうどの宣言は読む', async () => {
    expect(await checkDeclarationOf(16 * 1024)).toBe('ok');
  });

  it('16 KB を 1 バイトでも超えれば invalid にする', async () => {
    expect(await checkDeclarationOf(16 * 1024 + 1)).toBe('invalid');
  });
});

describe('宣言の判定は版ごとに保存し、掲載中の版の値を表示する', () => {
  // 以前は、判定した版の値で plugins の表示名・カテゴリ・配布物の宣言を書き換えていた。掲載されていない新しい版が
  // 宣言で name を変えると、掲載中の古い版の表示名が変わり、配布物の絞り込みも掲載中の版と食い違った (jtl.42)。
  const internalId = `${OWNER}/${REPO}`.toLowerCase();
  const NEW_DECLARATION = {
    name: 'New Name',
    category: 'instrument',
    assets: [
      { pattern: 'audio-fixture-pitchshift-*-windows-x64.zip', os: 'windows', arch: ['x86_64'], formats: ['vst3'] },
    ],
  };
  const OLD_DECLARATION = {
    name: 'Old Name',
    assets: [{ pattern: 'old-plugin-*-windows-x64.zip', os: 'windows', arch: ['x86_64'], formats: ['vst3'] }],
  };

  const columns = async (table: string) =>
    (await env.DB.prepare('SELECT name FROM pragma_table_info(?)').bind(table).all<{ name: string }>()).results.map(
      (row) => row.name,
    );
  const copy = async (table: string, where: string, overrides: Record<string, string>) => {
    const names = await columns(table);
    const select = names.map((name) => overrides[name] ?? name).join(', ');
    await env.DB.prepare(
      `INSERT INTO ${table} (${names.join(', ')}) SELECT ${select} FROM ${table} WHERE ${where}`,
    ).run();
  };
  // 版 7001 の行を、別の版の行として複製する。配布物の名前は fromName を toName に替える。
  async function cloneRelease(
    releaseId: number,
    tag: string,
    publishedAt: string,
    fromName: string,
    toName: string,
  ): Promise<void> {
    const offset = releaseId * 100;
    await copy('releases', 'github_release_id = 7001', {
      github_release_id: String(releaseId),
      tag: `'${tag}'`,
      published_at: `'${publishedAt}'`,
    });
    await copy('release_checks', 'github_release_id = 7001', { github_release_id: String(releaseId) });
    await copy('assets', 'release_id = 7001', {
      github_asset_id: `github_asset_id + ${offset}`,
      release_id: String(releaseId),
      name: `replace(name, '${fromName}', '${toName}')`,
    });
    for (const table of ['attestation_checks', 'content_checks', 'macos_signing_checks']) {
      await copy(table, 'github_asset_id IN (SELECT github_asset_id FROM assets WHERE release_id = 7001)', {
        github_asset_id: `github_asset_id + ${offset}`,
      });
    }
  }

  // 登録した版 7001 (v1.1.0) を掲載できる状態にし、配布物の名前を変えた旧い版 7000 (v1.0.0) を足す。
  async function setup(): Promise<void> {
    network.use(...githubHandlers());
    const result = await submitPlugin(
      env,
      { githubUserId: 4242, githubToken: USER_TOKEN },
      `https://github.com/${OWNER}/${REPO}`,
    );
    if (!result.ok) throw new Error(result.code);
    network.resetHandlers();
    await markListable(env.DB);
    await env.DB.prepare("UPDATE release_checks SET admin_approved_at = '2026-11-15T00:00:00Z'").run();
    await cloneRelease(7000, 'v1.0.0', '2026-10-01T00:00:00Z', 'audio-fixture-pitchshift-1.1.0', 'old-plugin-1.0.0');
  }

  const settle = async (releaseId: number, declaration: unknown) => {
    await env.DB.prepare(
      "UPDATE release_checks SET config_state = 'pending', config_fetched_at = '2026-11-15T00:00:00Z', config_json = ?, category = NULL WHERE github_release_id = ?",
    )
      .bind(JSON.stringify(declaration), releaseId)
      .run();
    await settleDeclarations(env, [releaseId]);
  };
  const categoryOf = async (releaseId: number) =>
    (
      await env.DB.prepare('SELECT category FROM release_checks WHERE github_release_id = ?')
        .bind(releaseId)
        .first<{ category: string | null }>()
    )?.category;

  it('判定したカテゴリを、その版の release_checks に書く。plugins の列は書き換えない', async () => {
    await setup();
    const before = await env.DB.prepare('SELECT display_name, declared_assets, category FROM plugins').first();
    await settle(7001, NEW_DECLARATION);
    await settle(7000, OLD_DECLARATION);
    expect(await categoryOf(7001)).toBe('instrument');
    // 旧い版の宣言に category は無く、中身の検査の手がかりも無いため utility になる。
    expect(await categoryOf(7000)).toBe('utility');
    expect(await env.DB.prepare('SELECT display_name, declared_assets, category FROM plugins').first()).toEqual(before);
  });

  it('掲載中の版があるとき、掲載されていない新しい版が宣言を判定しても、表示名・カテゴリ・配布物は掲載中の版のまま', async () => {
    await setup();
    await settle(7001, NEW_DECLARATION);
    await cloneRelease(
      7002,
      'v1.2.0',
      '2026-12-01T00:00:00Z',
      'audio-fixture-pitchshift-1.1.0',
      'audio-fixture-pitchshift-1.2.0',
    );
    // 新しい版は差分の検査で保留のままにし、掲載しない。
    await env.DB.prepare(
      "UPDATE release_checks SET diff_state = 'held', admin_approved_at = NULL WHERE github_release_id = 7002",
    ).run();
    await settle(7002, {
      name: 'Hijacked Name',
      category: 'effect',
      assets: [{ pattern: 'audio-fixture-pitchshift-1.2.0-*.zip', os: 'windows', arch: ['x86_64'], formats: ['vst3'] }],
    });
    expect(await categoryOf(7002)).toBe('effect');
    const view = await getPluginViewByInternalId(env, internalId);
    expect(view?.listedRelease?.tag).toBe('v1.1.0');
    expect(view?.name).toBe('New Name');
    expect(view?.category).toBe('instrument');
    expect(view?.listedRelease?.assets.map((item) => item.name)).toEqual([
      'audio-fixture-pitchshift-1.1.0-windows-x64.zip',
    ]);
  });

  it('各版は、その版自身の宣言の配布物で判定する', async () => {
    await setup();
    await settle(7001, NEW_DECLARATION);
    await settle(7000, OLD_DECLARATION);
    expect((await getPluginViewByInternalId(env, internalId))?.listedRelease?.tag).toBe('v1.1.0');
    // 新しい版が掲載できなくなれば、旧い版を旧い版の宣言で判定して案内する。plugins 全体の宣言で判定すると、
    // 新しい版の pattern が旧い版のファイル名に合わず、旧い版の配布物が案内から外れる。
    await env.DB.prepare(
      "UPDATE release_checks SET diff_state = 'held', admin_approved_at = NULL WHERE github_release_id = 7001",
    ).run();
    const view = await getPluginViewByInternalId(env, internalId);
    expect(view?.listedRelease?.tag).toBe('v1.0.0');
    expect(view?.listedRelease?.assets.map((item) => item.name)).toEqual(['old-plugin-1.0.0-windows-x64.zip']);
    expect(view?.name).toBe('Old Name');
  });

  it('掲載中の版も、掲載していた版も無ければ、検査を通った版のうちいちばん新しい版の値を使う', async () => {
    await setup();
    await settle(7001, NEW_DECLARATION);
    await settle(7000, OLD_DECLARATION);
    await env.DB.prepare('DELETE FROM listing_periods').run();
    await env.DB.prepare("UPDATE release_checks SET diff_state = 'held', admin_approved_at = NULL").run();
    await env.DB.prepare("UPDATE release_checks SET config_state = 'invalid' WHERE github_release_id = 7001").run();
    const view = await getPluginViewByInternalId(env, internalId);
    expect(view?.listedRelease).toBeNull();
    // 7001 は invalid のため、ok の 7000 の値を使う。
    expect(view?.name).toBe('Old Name');
    expect(view?.category).toBe('utility');
  });
});

// 申告の 4 項目 (docs/design/testing.md の X10)。形の誤りで掲載を止めず、その項目だけを申告なしにする。
describe('X10 宣言ファイルの有料・素材の申告', () => {
  const parse = (body: Record<string, unknown>) => {
    const parsed = parseDeclaration(JSON.stringify(body));
    if (parsed.state !== 'parsed') throw new Error(parsed.state);
    return parsed.declaration;
  };

  it('項目が無ければ申告なし (null)、[] と false は申告として区別する', () => {
    expect(parse({}).pricing).toEqual(NO_PRICING);
    expect(parse({ paidFeatures: false, paidServices: [], restrictedAssets: false }).pricing).toEqual({
      paidFeatures: false,
      paidServices: [],
      restrictedAssets: false,
      supportUrl: null,
    });
  });

  it('形の誤った項目は null にして注意のコードを返し、宣言ファイル全体は invalid にしない', () => {
    const declaration = parse({
      name: 'Fixture',
      paidFeatures: 'yes',
      paidServices: ['a', 'b', 'c', 'd', 'e', 'f'],
      restrictedAssets: 1,
      supportUrl: 'http://booth.pm/x',
    });
    expect(declaration.name).toBe('Fixture');
    expect(declaration.pricing).toEqual(NO_PRICING);
    expect(declaration.notices).toEqual([
      'paid_features_invalid',
      'paid_services_invalid',
      'restricted_assets_invalid',
      'support_url_invalid',
    ]);
  });

  it.each([[['x'.repeat(61)]], [['']], [['line\nbreak']], [[1]], ['OpenAI API']])(
    'paidServices の形の誤り: %j',
    (value) => {
      expect(parse({ paidServices: value }).notices).toEqual(['paid_services_invalid']);
    },
  );

  it('paidServices の名前は前後の空白を除いて残す', () => {
    expect(parse({ paidServices: [' OpenAI API '] }).pricing.paidServices).toEqual(['OpenAI API']);
  });

  it.each([
    'https://booth.pm/ja/items/1',
    'https://example.booth.pm/',
    'https://gumroad.com/l/x',
    'https://someone.gumroad.com/',
    'https://someone.itch.io/game',
    'https://www.patreon.com/someone',
    'https://ko-fi.com/someone',
    'https://github.com/sponsors/AllegroMoltoV',
  ])('許可する支援のページ: %s', (url) => {
    expect(parseSupportUrl(url)).toBe(new URL(url).href);
  });

  it.each([
    'http://booth.pm/',
    'https://evilbooth.pm/',
    'https://booth.pm.evil.example/',
    'https://gist.github.com/sponsors/x',
    'https://github.com/AllegroMoltoV',
    'https://github.com/sponsors/x/../../evil',
    'https://user:pass@booth.pm/',
    'https://booth.pm:8443/',
    'javascript:alert(1)',
    'not a url',
    42,
  ])('許可しない支援のページ: %s', (url) => {
    expect(parseSupportUrl(url)).toBe('invalid');
  });

  it('作者の宣言ファイルに書いた notices は読まず、保存した値の notices だけを読む', () => {
    const declaration = parse({ paidFeatures: true, notices: ['support_url_invalid'] });
    expect(declaration.notices).toEqual([]);
    const stored = storedPricing(serializeDeclaration(parse({ paidFeatures: 'yes' })));
    expect(stored).toEqual({ pricing: NO_PRICING, notices: ['paid_features_invalid'] });
    expect(storedPricing(null)).toEqual({ pricing: NO_PRICING, notices: [] });
  });
});
