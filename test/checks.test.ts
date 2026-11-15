// 配布物の検証の受け口 /internal/checks/ のアクセス権限と結果の受け取り (docs/design/testing.md の P20〜P34、I01〜I04・I06〜I09・C14)。
// 本サービスのリポジトリの main の verify.yaml 以外のトークンを 401 で拒否することと、
// 受け取った結果で掲載の条件をすり抜けられないことを確かめる (software-test スキル: 拒否の側を表で書く)。
// P35 と I05 は /internal/macos-checks/ の経路のテスト (macos-checks.test.ts) で確かめる。
import { env, SELF } from 'cloudflare:test';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { Budget } from '../src/budget';
import { VERIFY_WORKFLOW_REF } from '../src/checks/oidc';
import { runReleaseChecks } from '../src/domain/release-checks';
import { submitPlugin } from '../src/domain/submit';
import { githubHandlers, OWNER, REPO, REPO_ID, releaseCheckHandlers, USER_TOKEN } from './fixtures/github';
import { encode, installActionsJwks, sign, signHs256WithPublicKey, validClaims, workflowRef } from './fixtures/oidc';
import { network } from './setup';

const ORIGIN = 'http://localhost:8787';
const PENDING = `${ORIGIN}/internal/checks/pending`;
const RESULTS = `${ORIGIN}/internal/checks/results`;
const ARCHIVE_ID = 8001;
const SOURCE_ID = 8002;

const valid = () => validClaims(VERIFY_WORKFLOW_REF);

installActionsJwks();

describe('配布物の検証の受け口のアクセス権限', () => {
  const workflow = workflowRef;
  const rejected: Array<[string, () => Promise<string>]> = [
    ['P20 トークンが無い', async () => ''],
    [
      'P21 別のリポジトリのワークフロー',
      async () =>
        sign({
          ...valid(),
          repository: 'attacker/audio-plugin-soko-kun',
          job_workflow_ref: 'attacker/audio-plugin-soko-kun/.github/workflows/verify.yaml@refs/heads/main',
        }),
    ],
    [
      'P22 別のリポジトリから本サービスの verify.yaml を再利用のワークフローとして呼んだ',
      async () => sign({ ...valid(), repository: 'attacker/caller' }),
    ],
    [
      'P23 本サービスのリポジトリの別のワークフロー',
      async () => sign({ ...valid(), job_workflow_ref: workflow('ci.yml') }),
    ],
    [
      'P24 main 以外のブランチで動作した verify.yaml',
      async () => sign({ ...valid(), job_workflow_ref: workflow('verify.yaml', 'refs/heads/evil') }),
    ],
    [
      'P25 main という名前のタグで動作した verify.yaml',
      async () => sign({ ...valid(), job_workflow_ref: workflow('verify.yaml', 'refs/tags/main') }),
    ],
    ['P26 期限切れ', async () => sign({ ...valid(), exp: Math.floor(Date.now() / 1000) - 10 })],
    ['P27 宛先 (aud) が違う', async () => sign({ ...valid(), aud: 'sigstore' })],
    ['P28 発行者が違う', async () => sign({ ...valid(), iss: 'https://example.com' })],
    ['P29 公開されていない鍵で署名', async () => sign(valid(), true)],
    [
      'P30 署名のあとでクレームを書き換えた',
      async () => {
        const [head, , signature] = (await sign(valid())).split('.');
        return `${head}.${encode({ ...valid(), repository: 'attacker/x' })}.${signature}`;
      },
    ],
    ['P31 alg が none', async () => `${encode({ alg: 'none', typ: 'JWT', kid: 'test-key' })}.${encode(valid())}.`],
    ['P31 公開鍵を秘密鍵とみなした HS256', async () => signHs256WithPublicKey(valid())],
    // @cloudflare/workers-oauth-provider のアクセストークンは <ユーザー ID>:<付与の ID>:<秘密の値> の形
    [
      'P32 本サービスの認可サーバーが発行した MCP のアクセストークン',
      async () => '4242:grant-fixture:secretvalue0123456789',
    ],
    [
      'P34 main で動作した macos-verify.yaml',
      async () => sign({ ...valid(), job_workflow_ref: workflow('macos-verify.yaml') }),
    ],
  ];

  for (const [label, token] of rejected) {
    it(`${label}: 一覧の取得と結果の送信を 401 で拒否する`, async () => {
      const authorization = `Bearer ${await token()}`;
      expect((await SELF.fetch(PENDING, { headers: { Authorization: authorization } })).status).toBe(401);
      const post = await SELF.fetch(RESULTS, {
        method: 'POST',
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: [] }),
      });
      expect(post.status).toBe(401);
    });
  }

  it('P33 main の verify.yaml のトークンは、一覧の取得と結果の送信を受け付ける', async () => {
    const authorization = `Bearer ${await sign(valid())}`;
    expect((await SELF.fetch(PENDING, { headers: { Authorization: authorization } })).status).toBe(200);
    const post = await SELF.fetch(RESULTS, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: [] }),
    });
    expect(post.status).toBe(200);
  });
});

describe('配布物の検証の結果', () => {
  async function register(): Promise<void> {
    network.use(...githubHandlers());
    const result = await submitPlugin(
      env,
      { githubUserId: 4242, githubToken: USER_TOKEN },
      `https://github.com/${OWNER}/${REPO}`,
    );
    if (!result.ok) throw new Error(result.code);
  }

  async function post(results: unknown[]): Promise<Response> {
    return SELF.fetch(RESULTS, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await sign(valid())}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ results }),
    });
  }

  async function pending(): Promise<
    Array<{ assetId: number; kind: string; repositoryId: number; previousRepositories: string[] }>
  > {
    const response = await SELF.fetch(PENDING, { headers: { Authorization: `Bearer ${await sign(valid())}` } });
    expect(response.status).toBe(200);
    return ((await response.json()) as { assets: never[] }).assets;
  }

  const attestationOf = (id: number) =>
    env.DB.prepare('SELECT result, reason FROM attestation_checks WHERE github_asset_id = ?').bind(id).first();
  const contentOf = (id: number) =>
    env.DB.prepare('SELECT result, os, vst2_files, attempts FROM content_checks WHERE github_asset_id = ?')
      .bind(id)
      .first();
  const macosRows = async () =>
    (await env.DB.prepare('SELECT github_asset_id, result FROM macos_signing_checks').all()).results;

  const windowsBundle = { path: 'Fixture.vst3', format: 'vst3', os: ['windows'], arches: ['x86_64'] };
  const passedWindows = {
    result: 'passed',
    bundles: [windowsBundle],
    formats: ['vst3'],
    os: ['windows'],
    arches: ['x86_64'],
    vst2Files: [],
  };
  const passedMac = {
    result: 'passed',
    bundles: [{ path: 'Fixture.vst3', format: 'vst3', os: ['macos'], arches: ['x86_64', 'arm64'] }],
    formats: ['vst3'],
    os: ['macos'],
    arches: ['x86_64', 'arm64'],
    vst2Files: [],
  };
  const signer = { result: 'passed', signerWorkflow: '.github/workflows/push.yaml' };

  // 名前を変える前に作られた証明は、作られたときの名前 (大文字と小文字を含む) でしか検証に通らない (派生元の ADR 0015)。
  it('I03 一覧に、配布物の種類・リポジトリ ID・大文字と小文字を保った旧い名前を新しい順に含める', async () => {
    await register();
    await env.DB.prepare(
      "INSERT INTO plugin_aliases (alias, plugin_id, created_at, name) VALUES ('allegromoltov/older', (SELECT id FROM plugins), '2026-11-01T00:00:00Z', 'AllegroMoltoV/Older')",
    ).run();
    await env.DB.prepare(
      "INSERT INTO plugin_aliases (alias, plugin_id, created_at, name) VALUES ('allegromoltov/newer', (SELECT id FROM plugins), '2026-11-10T00:00:00Z', 'AllegroMoltoV/Newer')",
    ).run();
    const assets = await pending();
    const archive = assets.find((asset) => asset.assetId === ARCHIVE_ID);
    expect(archive?.kind).toBe('archive');
    expect(archive?.repositoryId).toBe(REPO_ID);
    expect(archive?.previousRepositories).toEqual(['AllegroMoltoV/Newer', 'AllegroMoltoV/Older']);
  });

  it('一覧は、中身の検査だけが残る配布物を含め、3 回目の error で試行を止めた配布物を含めない', async () => {
    await register();
    await env.DB.prepare("UPDATE attestation_checks SET result = 'passed'").run();
    expect((await pending()).map((asset) => asset.assetId)).toEqual([ARCHIVE_ID]);
    await env.DB.prepare("UPDATE content_checks SET result = 'error', attempts = 2").run();
    expect((await pending()).map((asset) => asset.assetId)).toEqual([ARCHIVE_ID]);
    await env.DB.prepare("UPDATE content_checks SET result = 'error', attempts = 3").run();
    expect(await pending()).toEqual([]);
  });

  it('I02 初めて検証できたワークフローを記録し、別のワークフローが署名した証明は通さない', async () => {
    await register();
    const response = await post([
      { assetId: ARCHIVE_ID, attestation: signer },
      { assetId: SOURCE_ID, attestation: { result: 'passed', signerWorkflow: '.github/workflows/evil.yaml' } },
    ]);
    expect(response.status).toBe(200);
    expect(await attestationOf(ARCHIVE_ID)).toMatchObject({ result: 'passed' });
    expect(await attestationOf(SOURCE_ID)).toMatchObject({ result: 'failed', reason: 'signer_workflow_mismatch' });
    expect(await env.DB.prepare('SELECT release_workflow FROM plugins').first('release_workflow')).toBe(
      '.github/workflows/push.yaml',
    );
  });

  describe('I01 確定した結果は、あとから passed を送っても書き換えない', () => {
    it('証明の検証の failed', async () => {
      await register();
      expect(
        (await post([{ assetId: ARCHIVE_ID, attestation: { result: 'failed', reason: 'no_attestation' } }])).status,
      ).toBe(200);
      await post([{ assetId: ARCHIVE_ID, attestation: signer }]);
      expect(await attestationOf(ARCHIVE_ID)).toMatchObject({ result: 'failed' });
    });

    const contentFailures: Array<[string, Record<string, unknown>]> = [
      ['no_plugin', { result: 'no_plugin' }],
      ['vst2_detected', { result: 'vst2_detected', vst2Files: ['x64/Fixture.dll'] }],
    ];
    for (const [label, content] of contentFailures) {
      it(`中身の検査の ${label}`, async () => {
        await register();
        expect((await post([{ assetId: ARCHIVE_ID, content }])).status).toBe(200);
        await post([{ assetId: ARCHIVE_ID, content: passedWindows }]);
        expect(await contentOf(ARCHIVE_ID)).toMatchObject({ result: label });
      });
    }
  });

  it('I04 確定した行と、存在しない配布物と、中身の検査の行が無い配布物には何も書かない', async () => {
    await register();
    await env.DB.prepare("UPDATE attestation_checks SET result = 'passed' WHERE github_asset_id = ?")
      .bind(ARCHIVE_ID)
      .run();
    const response = await post([
      { assetId: ARCHIVE_ID, attestation: { result: 'failed', reason: 'verification_failed' } },
      { assetId: SOURCE_ID, content: passedMac },
      { assetId: 999_999, attestation: signer, content: passedWindows },
    ]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: 0 });
    expect(await attestationOf(ARCHIVE_ID)).toMatchObject({ result: 'passed' });
    expect(await contentOf(SOURCE_ID)).toBeNull();
    expect(await macosRows()).toEqual([]);
  });

  describe('I06・I07・I09 形の合わない結果は 400 で拒否し、どの行も書かない', () => {
    const invalid: Array<[string, Record<string, unknown>]> = [
      ['I06 os の値が一覧の外 (MacOS)', { ...passedMac, os: ['MacOS'] }],
      [
        'I06 バンドルの os の値が一覧の外 (MacOS)',
        { ...passedMac, bundles: [{ ...passedMac.bundles[0], os: ['MacOS'] }], os: ['macos'] },
      ],
      ['I06 result の値が一覧の外', { ...passedWindows, result: 'pending' }],
      ['I06 formats の値が一覧の外', { ...passedWindows, formats: ['vst2'] }],
      ['I06 バンドルが macOS なのに os から macos を省いた', { ...passedMac, os: [] }],
      ['I07 バンドルのパスが絶対パス', { ...passedWindows, bundles: [{ ...windowsBundle, path: '/Fixture.vst3' }] }],
      [
        'I07 バンドルのパスがドライブ名で始まる',
        { ...passedWindows, bundles: [{ ...windowsBundle, path: 'C:/Fixture.vst3' }] },
      ],
      [
        'I07 バンドルのパスが ..を含む',
        { ...passedWindows, bundles: [{ ...windowsBundle, path: 'a/../../Fixture.vst3' }] },
      ],
      [
        'I07 バンドルのパスが制御文字を含む',
        { ...passedWindows, bundles: [{ ...windowsBundle, path: 'Fix\nture.vst3' }] },
      ],
      ['I07 vst2Files のパスが ..を含む', { result: 'vst2_detected', vst2Files: ['../Fixture.dll'] }],
      ['I09 passed で vst2Files が空でない', { ...passedWindows, vst2Files: ['x64/Fixture.dll'] }],
      ['I06 categories の値が一覧の外', { ...passedWindows, categories: ['utility'] }],
      ['I06 バンドルが無いのに categories がある', { result: 'no_plugin', categories: ['effect'] }],
    ];
    for (const [label, content] of invalid) {
      it(label, async () => {
        await register();
        const response = await post([
          { assetId: SOURCE_ID, attestation: signer },
          { assetId: ARCHIVE_ID, attestation: signer, content },
        ]);
        expect(response.status).toBe(400);
        expect(await attestationOf(SOURCE_ID)).toMatchObject({ result: 'pending' });
        expect(await attestationOf(ARCHIVE_ID)).toMatchObject({ result: 'pending' });
        expect(await contentOf(ARCHIVE_ID)).toMatchObject({ result: 'pending' });
        expect(await macosRows()).toEqual([]);
      });
    }
  });

  it('I12 同じ配布物の結果を 2 つ含む要求は 400 で拒否し、どの行も書かない', async () => {
    await register();
    const response = await post([
      { assetId: ARCHIVE_ID, attestation: { result: 'failed', reason: 'verification_failed' } },
      { assetId: ARCHIVE_ID, attestation: signer, content: passedWindows },
    ]);
    expect(response.status).toBe(400);
    expect(await attestationOf(ARCHIVE_ID)).toMatchObject({ result: 'pending' });
    expect(await contentOf(ARCHIVE_ID)).toMatchObject({ result: 'pending' });
  });

  it('I08 の対照: macOS の LV2 のバンドルだけの結果では、macOS の判定の行を作らない', async () => {
    await register();
    const lv2 = { path: 'Fixture.lv2', format: 'lv2', os: ['macos'], arches: ['arm64'] };
    const content = { ...passedMac, bundles: [lv2], formats: ['lv2'], arches: ['arm64'] };
    expect((await post([{ assetId: ARCHIVE_ID, content }])).status).toBe(200);
    expect(await contentOf(ARCHIVE_ID)).toMatchObject({ result: 'passed', os: '["macos"]' });
    expect(await macosRows()).toEqual([]);
  });

  it('I08 中身の検査の結果の os に macos を含めば、macOS の判定の行を pending で作る', async () => {
    await register();
    expect((await post([{ assetId: ARCHIVE_ID, content: passedMac }])).status).toBe(200);
    expect(await contentOf(ARCHIVE_ID)).toMatchObject({ result: 'passed', os: '["macos"]', attempts: 1 });
    expect(await macosRows()).toEqual([{ github_asset_id: ARCHIVE_ID, result: 'pending' }]);
  });

  it('I08 の対照: Windows だけの結果では、macOS の判定の行を作らない', async () => {
    await register();
    expect((await post([{ assetId: ARCHIVE_ID, content: passedWindows }])).status).toBe(200);
    expect(await contentOf(ARCHIVE_ID)).toMatchObject({ result: 'passed', os: '["windows"]' });
    expect(await macosRows()).toEqual([]);
  });

  describe('C14 宣言ファイルの照合は、宣言の取得と中身の検査の両方を終えてから行う', () => {
    const declaration = {
      name: 'Fixture Pitch Shift',
      category: 'effect',
      assets: [{ pattern: '*-windows-x64.zip', os: 'windows', arch: ['x86_64'], formats: ['vst3', 'clap'] }],
    };
    const serveDeclaration = () =>
      network.use(
        http.get(`https://api.github.com/repos/${OWNER}/${REPO}/contents/.audio-soko-kun/config.json`, () =>
          HttpResponse.text(JSON.stringify(declaration)),
        ),
        ...releaseCheckHandlers(),
      );
    const configOf = () => env.DB.prepare('SELECT config_state, config_fetched_at FROM release_checks').first();
    const pluginOf = () => env.DB.prepare('SELECT display_name, declared_assets, category FROM plugins').first();

    it('宣言を先に取得した版は pending のまま待ち、中身の検査の結果を受けたときに mismatch にする', async () => {
      await register();
      serveDeclaration();
      await runReleaseChecks(env, new Budget());
      expect(await configOf()).toMatchObject({ config_state: 'pending', config_fetched_at: expect.any(String) });
      // 宣言は vst3 と clap、検出は vst3 だけ。
      expect((await post([{ assetId: ARCHIVE_ID, content: passedWindows }])).status).toBe(200);
      expect(await configOf()).toMatchObject({ config_state: 'mismatch' });
      expect(await pluginOf()).toMatchObject({ display_name: null, declared_assets: null });
    });

    it('中身の検査を先に終えた版は、宣言を取得したときに判定し、ok なら表示名と配布物の宣言とカテゴリを替える', async () => {
      await register();
      const both = { ...passedWindows, formats: ['clap', 'vst3'], categories: ['instrument'] };
      both.bundles = [windowsBundle, { ...windowsBundle, path: 'Fixture.clap', format: 'clap' }];
      expect((await post([{ assetId: ARCHIVE_ID, content: both }])).status).toBe(200);
      expect(await configOf()).toMatchObject({ config_state: 'pending', config_fetched_at: null });
      serveDeclaration();
      await runReleaseChecks(env, new Budget());
      expect(await configOf()).toMatchObject({ config_state: 'ok' });
      expect(await pluginOf()).toEqual({
        display_name: 'Fixture Pitch Shift',
        declared_assets: JSON.stringify(declaration.assets.map((item) => ({ ...item, formats: ['clap', 'vst3'] }))),
        // 中身の検査の手がかりを宣言の category より優先する。
        category: 'instrument',
      });
    });
  });
});

describe('通信の API の検出の結果', () => {
  async function register(): Promise<void> {
    network.use(...githubHandlers());
    const result = await submitPlugin(
      env,
      { githubUserId: 4242, githubToken: USER_TOKEN },
      `https://github.com/${OWNER}/${REPO}`,
    );
    if (!result.ok) throw new Error(result.code);
  }

  const releaseId = async () =>
    (await env.DB.prepare('SELECT github_release_id FROM release_checks').first<number>('github_release_id')) ?? 0;
  const scanOf = () =>
    env.DB.prepare('SELECT network_state, network_hits, network_attempts FROM release_checks').first<{
      network_state: string;
      network_hits: string | null;
      network_attempts: number;
    }>();

  async function releases(): Promise<Array<{ releaseId: number; repository: string; commitSha: string }>> {
    const response = await SELF.fetch(PENDING, { headers: { Authorization: `Bearer ${await sign(valid())}` } });
    expect(response.status).toBe(200);
    return ((await response.json()) as { releases: never[] }).releases;
  }

  async function post(networkScans: unknown): Promise<Response> {
    return SELF.fetch(RESULTS, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await sign(valid())}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: [], networkScans }),
    });
  }

  it('検出を待つ版を一覧に載せ、結果を保存したら一覧から外す。知らない API と形の合わない当たりは捨てる', async () => {
    await register();
    const id = await releaseId();
    expect(await releases()).toEqual([
      { releaseId: id, repository: `${OWNER}/${REPO}`, commitSha: expect.stringMatching(/^[0-9a-f]{40}$/) },
    ]);
    const response = await post([
      {
        releaseId: id,
        result: 'done',
        truncated: false,
        hits: [
          { file: 'Source/Update.cpp', line: 37, api: 'juce-network', text: 'url.readEntireTextStream();' },
          { file: 'src/evil.cpp', line: 1, api: 'made-up', text: 'x' },
          { file: 'src/bad.cpp', line: 'one', api: 'libcurl', text: 'x' },
        ],
      },
    ]);
    expect(response.status).toBe(200);
    const row = await scanOf();
    expect(row?.network_state).toBe('done');
    expect(JSON.parse(row?.network_hits ?? '{}')).toEqual({
      hits: [{ file: 'Source/Update.cpp', line: 37, api: 'juce-network', text: 'url.readEntireTextStream();' }],
      truncated: false,
    });
    expect(await releases()).toEqual([]);
  });

  it('error を 3 回受けた版は一覧から外し、確定した done は error で書き換えない', async () => {
    await register();
    const id = await releaseId();
    for (let i = 0; i < 3; i++) expect((await post([{ releaseId: id, result: 'error' }])).status).toBe(200);
    expect(await scanOf()).toMatchObject({ network_state: 'error', network_attempts: 3 });
    expect(await releases()).toEqual([]);
    await env.DB.prepare(
      `UPDATE release_checks SET network_state = 'done', network_hits = '{"hits":[],"truncated":false}'`,
    ).run();
    await post([{ releaseId: id, result: 'error' }]);
    expect(await scanOf()).toMatchObject({ network_state: 'done' });
  });

  const invalid: Array<[string, (id: number) => unknown]> = [
    [
      '同じ版が重なる',
      (id) => [
        { releaseId: id, result: 'error' },
        { releaseId: id, result: 'done', hits: [] },
      ],
    ],
    ['result の値が一覧の外', (id) => [{ releaseId: id, result: 'skipped' }]],
    ['done なのに hits が無い', (id) => [{ releaseId: id, result: 'done' }]],
    ['networkScans が配列でない', (id) => ({ releaseId: id, result: 'done', hits: [] })],
  ];
  for (const [label, body] of invalid) {
    it(`形の合わない検出の結果は 400 で拒否し、書かない: ${label}`, async () => {
      await register();
      expect((await post(body(await releaseId()))).status).toBe(400);
      expect(await scanOf()).toMatchObject({ network_state: 'pending', network_attempts: 0 });
    });
  }

  it('トークンの無い要求では、検出の結果を書き換えない', async () => {
    await register();
    const response = await SELF.fetch(RESULTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: [], networkScans: [{ releaseId: await releaseId(), result: 'done', hits: [] }] }),
    });
    expect(response.status).toBe(401);
    expect(await scanOf()).toMatchObject({ network_state: 'pending' });
  });
});
