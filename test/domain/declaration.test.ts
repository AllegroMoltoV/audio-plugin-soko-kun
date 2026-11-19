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
  it('plugins.declared_assets の pattern に一致しないアーカイブは、条件を満たしても案内しない', async () => {
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

    await env.DB.prepare('UPDATE plugins SET declared_assets = ?')
      .bind(JSON.stringify([{ pattern: '*-macos.zip', os: 'macos', arch: ['arm64'], formats: ['vst3'] }]))
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

describe('古い版の宣言の判定と、新しい版の判定済みの宣言', () => {
  // 新しい版の判定の後に古い版を判定し直すと、古い版の値で plugins の表示名・カテゴリ・配布物の宣言を上書きしていた
  // (2026-11-15、retry-declaration で simple-whitenoise のカテゴリが utility に戻った)。古い版の pattern が新しい版の
  // ファイル名に合わないと、新しい版の配布物が案内から外れ、掲載が旧い版に移る。
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
    await copy('releases', 'github_release_id = 7001', {
      github_release_id: '7000',
      tag: "'v1.0.0'",
      published_at: "'2026-10-01T00:00:00Z'",
    });
    await copy('release_checks', 'github_release_id = 7001', { github_release_id: '7000' });
    await copy('assets', 'release_id = 7001', {
      github_asset_id: 'github_asset_id + 100000',
      release_id: '7000',
      name: "replace(name, 'audio-fixture-pitchshift-1.1.0', 'old-plugin-1.0.0')",
    });
    for (const table of ['attestation_checks', 'content_checks', 'macos_signing_checks']) {
      await copy(table, 'github_asset_id IN (SELECT github_asset_id FROM assets WHERE release_id = 7001)', {
        github_asset_id: 'github_asset_id + 100000',
      });
    }
  }

  const settle = async (releaseId: number, declaration: unknown) => {
    await env.DB.prepare(
      "UPDATE release_checks SET config_state = 'pending', config_fetched_at = '2026-11-15T00:00:00Z', config_json = ? WHERE github_release_id = ?",
    )
      .bind(JSON.stringify(declaration), releaseId)
      .run();
    await settleDeclarations(env, [releaseId]);
  };
  const plugin = () =>
    env.DB.prepare('SELECT display_name, category, declared_assets FROM plugins').first<{
      display_name: string | null;
      category: string;
      declared_assets: string | null;
    }>();

  it('新しい版の判定の後に古い版を判定し直しても、表示名・カテゴリ・配布物の宣言を書き換えない', async () => {
    await setup();
    await settle(7001, NEW_DECLARATION);
    await settle(7000, OLD_DECLARATION);
    expect(await plugin()).toEqual({
      display_name: 'New Name',
      category: 'instrument',
      declared_assets: JSON.stringify(NEW_DECLARATION.assets),
    });
  });

  it('古い版の pattern が新しい版のファイル名に合わなくても、新しい版の掲載が続く', async () => {
    await setup();
    await settle(7001, NEW_DECLARATION);
    expect((await getPluginViewByInternalId(env, internalId))?.listedRelease?.tag).toBe('v1.1.0');
    await settle(7000, OLD_DECLARATION);
    expect((await getPluginViewByInternalId(env, internalId))?.listedRelease?.tag).toBe('v1.1.0');
  });

  it('対照: 新しい版が判定待ちなら、古い版の判定で書き換える', async () => {
    await setup();
    await env.DB.prepare(
      "UPDATE release_checks SET config_state = 'pending', config_fetched_at = NULL WHERE github_release_id = 7001",
    ).run();
    await settle(7000, OLD_DECLARATION);
    expect((await plugin())?.display_name).toBe('Old Name');
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
