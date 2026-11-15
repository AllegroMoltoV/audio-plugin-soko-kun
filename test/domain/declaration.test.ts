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
  parseDeclaration,
  serializeDeclaration,
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
      },
    });
  });
});

describe('C13 宣言と中身の検査の結果の照合', () => {
  const declaration = (assets: Declaration['assets']): Declaration => ({ name: null, category: null, assets });
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
