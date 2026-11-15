// macOS の署名と公証の判定の受け口 /internal/macos-checks/ のアクセス権限と結果の受け取り
// (docs/design/testing.md の P20〜P35、I01・I04・I05・I10〜I12 と、S30〜S32)。
// main の macos-verify.yaml 以外のトークンを 401 で拒否することと、受け取った結果で掲載の条件をすり抜けられないことを確かめる。
import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { MACOS_VERIFY_WORKFLOW_REF, VERIFY_WORKFLOW_REF } from '../src/checks/oidc';
import { getPluginViewByInternalId } from '../src/domain/catalog';
import { submitPlugin } from '../src/domain/submit';
import { markListable } from './fixtures/checks';
import { githubHandlers, OWNER, REPO, USER_TOKEN } from './fixtures/github';
import { encode, installActionsJwks, sign, signHs256WithPublicKey, validClaims, workflowRef } from './fixtures/oidc';
import { network } from './setup';

const ORIGIN = 'http://localhost:8787';
const PENDING = `${ORIGIN}/internal/macos-checks/pending`;
const RESULTS = `${ORIGIN}/internal/macos-checks/results`;
const ARCHIVE_ID = 8001;

const valid = () => validClaims(MACOS_VERIFY_WORKFLOW_REF);

installActionsJwks();

describe('macOS の判定の受け口のアクセス権限', () => {
  const rejected: Array<[string, () => Promise<string>]> = [
    ['P20 トークンが無い', async () => ''],
    [
      'P21 別のリポジトリのワークフロー',
      async () =>
        sign({
          ...valid(),
          repository: 'attacker/audio-plugin-soko-kun',
          job_workflow_ref: 'attacker/audio-plugin-soko-kun/.github/workflows/macos-verify.yaml@refs/heads/main',
        }),
    ],
    [
      'P22 別のリポジトリから再利用のワークフローとして呼んだ',
      async () => sign({ ...valid(), repository: 'attacker/caller' }),
    ],
    ['P23 本サービスのリポジトリの別のワークフロー', async () => sign(validClaims(workflowRef('ci.yml')))],
    [
      'P24 main 以外のブランチで動作した macos-verify.yaml',
      async () => sign(validClaims(workflowRef('macos-verify.yaml', 'refs/heads/evil'))),
    ],
    [
      'P25 main という名前のタグで動作した macos-verify.yaml',
      async () => sign(validClaims(workflowRef('macos-verify.yaml', 'refs/tags/main'))),
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
    [
      'P32 本サービスの認可サーバーが発行した MCP のアクセストークン',
      async () => '4242:grant-fixture:secretvalue0123456789',
    ],
    ['P35 main で動作した verify.yaml', async () => sign(validClaims(VERIFY_WORKFLOW_REF))],
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

  it('P33 main の macos-verify.yaml のトークンは、一覧の取得と結果の送信を受け付ける', async () => {
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

const bundle = (path: string, format: string, os: string[]) => ({ path, format, os, arches: ['arm64'] });
const contentOf = (bundles: Array<ReturnType<typeof bundle>>) => ({
  result: 'passed',
  bundles,
  formats: [...new Set(bundles.map((item) => item.format))],
  os: [...new Set(bundles.flatMap((item) => item.os))],
  arches: ['arm64'],
  vst2Files: [],
});
const MAC_VST3 = bundle('Fixture Synth.vst3', 'vst3', ['macos']);
const MAC_LV2 = bundle('Fixture Synth.lv2', 'lv2', ['macos']);
const LINUX_MAC_LV2 = bundle('Fixture Synth.lv2', 'lv2', ['macos', 'linux']);

// 登録したリリースの条件をすべて満たしたうえで、アーカイブの中身の検査の結果だけを verify.yaml の経路で送り直す。
async function registerWithContent(bundles: Array<ReturnType<typeof bundle>>): Promise<void> {
  network.use(...githubHandlers());
  const result = await submitPlugin(
    env,
    { githubUserId: 4242, githubToken: USER_TOKEN },
    `https://github.com/${OWNER}/${REPO}`,
  );
  if (!result.ok) throw new Error(result.code);
  await markListable(env.DB);
  await env.DB.prepare("UPDATE content_checks SET result = 'pending'").run();
  const response = await SELF.fetch(`${ORIGIN}/internal/checks/results`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await sign(validClaims(VERIFY_WORKFLOW_REF))}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ results: [{ assetId: ARCHIVE_ID, content: contentOf(bundles) }] }),
  });
  expect(response.status).toBe(200);
}

async function post(results: unknown[]): Promise<Response> {
  return SELF.fetch(RESULTS, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await sign(valid())}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ results }),
  });
}

async function pending(): Promise<Array<{ assetId: number; digest: string; bundles: string[] }>> {
  const response = await SELF.fetch(PENDING, { headers: { Authorization: `Bearer ${await sign(valid())}` } });
  expect(response.status).toBe(200);
  return ((await response.json()) as { assets: never[] }).assets;
}

const macosRow = () =>
  env.DB.prepare('SELECT result, reason, team_id, attempts FROM macos_signing_checks WHERE github_asset_id = ?')
    .bind(ARCHIVE_ID)
    .first<{ result: string; reason: string | null; team_id: string | null; attempts: number }>();

const view = () => getPluginViewByInternalId(env, `${OWNER}/${REPO}`);

const PASSED = { assetId: ARCHIVE_ID, result: 'passed', reason: null, teamIds: ['TEAM000001'] };

describe('macOS の判定の結果', () => {
  it('一覧に macOS 向けのバンドルのパスを返し、macOS の LV2 は判定の対象から除く', async () => {
    await registerWithContent([MAC_VST3, MAC_LV2]);
    const assets = await pending();
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({ assetId: ARCHIVE_ID, bundles: ['Fixture Synth.vst3'] });
    expect(assets[0]?.digest).toMatch(/^sha256:/);
  });

  it('macOS の LV2 だけを含むアーカイブには、macOS の判定の行を作らない', async () => {
    await registerWithContent([MAC_LV2]);
    expect(await macosRow()).toBeNull();
    expect(await pending()).toEqual([]);
  });

  it('合格・不合格・error を書き、Team ID を記録する。複数の Team ID は JSON の配列で記録する', async () => {
    await registerWithContent([MAC_VST3]);
    expect(await (await post([PASSED])).json()).toEqual({ updated: 1 });
    expect(await macosRow()).toEqual({ result: 'passed', reason: null, team_id: 'TEAM000001', attempts: 1 });
    expect(await pending()).toEqual([]);

    await env.DB.prepare("UPDATE macos_signing_checks SET result = 'pending', attempts = 0").run();
    await post([{ ...PASSED, result: 'failed', reason: 'adhoc', teamIds: ['TEAM000002', 'TEAM000001'] }]);
    expect(await macosRow()).toMatchObject({
      result: 'failed',
      reason: 'adhoc',
      team_id: '["TEAM000001","TEAM000002"]',
    });
  });

  it('I01 確定した failed は、あとから passed を送っても書き換えない', async () => {
    await registerWithContent([MAC_VST3]);
    await post([{ ...PASSED, result: 'failed', reason: 'not_developer_id' }]);
    expect(await (await post([PASSED])).json()).toEqual({ updated: 0 });
    expect(await macosRow()).toMatchObject({ result: 'failed', reason: 'not_developer_id' });
  });

  it('I05 macOS の判定の行が無い配布物と、存在しない配布物には行を作らない', async () => {
    await registerWithContent([bundle('Fixture.vst3', 'vst3', ['windows'])]);
    const response = await post([PASSED, { ...PASSED, assetId: 999_999 }]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: 0 });
    expect(await macosRow()).toBeNull();
  });

  it('I10 error は 3 回まで一覧に載せ、3 回目の後は管理者の確認を待つ。遅れて届いた結果は受け入れる', async () => {
    await registerWithContent([MAC_VST3]);
    const notNotarized = { ...PASSED, result: 'error', reason: 'not_notarized' };
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect((await pending()).map((asset) => asset.assetId)).toEqual([ARCHIVE_ID]);
      await post([notNotarized]);
    }
    expect(await macosRow()).toMatchObject({ result: 'error', reason: 'not_notarized', attempts: 3 });
    expect(await pending()).toEqual([]);
    // 試行を使い切った行にも、遅れて届いた結果は受け入れる。OIDC で本サービスのワークフローからと確かめた結果で、
    // 管理者の確認待ちが人手なしで解けるため (/internal/checks/ と配信プラグイン倉庫くんの受け口と同じ扱い)。
    expect(await (await post([PASSED])).json()).toEqual({ updated: 1 });
    expect(await macosRow()).toMatchObject({ result: 'passed' });
    // 確定した行は、遅れて届いた結果で書き換えない (共通の土台の受け口の決まり 5)。
    expect(await (await post([{ ...PASSED, result: 'failed', reason: 'adhoc' }])).json()).toEqual({ updated: 0 });
    expect(await macosRow()).toMatchObject({ result: 'passed' });
  });

  describe('I11・I12 形の合わない結果と、同じ配布物の結果を 2 つ含む要求は 400 で拒否し、どの行も書かない', () => {
    const invalid: Array<[string, unknown[]]> = [
      ['I12 同じ配布物の結果を 2 つ含む', [PASSED, { ...PASSED, result: 'failed', reason: 'adhoc' }]],
      ['I11 result の値が一覧の外', [{ ...PASSED, result: 'pending' }]],
      ['I11 Team ID の無い passed', [{ ...PASSED, teamIds: [] }]],
      ['I11 理由のある passed', [{ ...PASSED, reason: 'adhoc' }]],
      ['I11 Developer ID の公証の判定を failed にした', [{ ...PASSED, result: 'failed', reason: 'not_notarized' }]],
      ['I11 理由の無い failed', [{ ...PASSED, result: 'failed', reason: null }]],
      ['I11 決めた理由の外の error', [{ ...PASSED, result: 'error', reason: 'whatever' }]],
      ['I11 Team ID の形が違う', [{ ...PASSED, teamIds: ['team000001'] }]],
      ['I11 Team ID が重なる', [{ ...PASSED, teamIds: ['TEAM000001', 'TEAM000001'] }]],
      ['I11 配布物の ID が数でない', [{ ...PASSED, assetId: '8001' }]],
    ];
    for (const [label, results] of invalid) {
      it(label, async () => {
        await registerWithContent([MAC_VST3]);
        expect((await post(results)).status).toBe(400);
        expect(await macosRow()).toMatchObject({ result: 'pending', attempts: 0 });
      });
    }
  });
});

describe('macOS の判定と掲載状態', () => {
  it('S30 macOS のアーカイブは、判定が passed になってから案内する', async () => {
    await registerWithContent([MAC_VST3]);
    expect((await view())?.status).toBe('pending');
    await post([{ ...PASSED, result: 'error', reason: 'not_notarized' }]);
    expect((await view())?.status).toBe('pending');
    await post([PASSED]);
    const listed = await view();
    expect(listed?.status).toBe('listed');
    expect(listed?.listedRelease?.assets.map((asset) => asset.os)).toEqual([['macos']]);
    expect(listed?.macosNotGuided).toBe(false);
  });

  it('S31 macOS の LV2 だけのアーカイブは案内せず、版を掲載しない', async () => {
    await registerWithContent([MAC_LV2]);
    expect((await view())?.status).toBe('pending');
  });

  it('S31 の対照: Linux も持つ LV2 は、macOS を除いて Linux として案内する', async () => {
    await registerWithContent([LINUX_MAC_LV2]);
    const linux = await view();
    expect(linux?.status).toBe('listed');
    expect(linux?.listedRelease?.assets.map((asset) => [asset.os, asset.formats])).toEqual([[['linux'], ['lv2']]]);
    expect(linux?.macosNotGuided).toBe(true);
  });

  it('S32 1 つのアーカイブの Team ID が食い違えば、管理者の承認があるまで掲載しない', async () => {
    await registerWithContent([MAC_VST3, bundle('Fixture Synth.clap', 'clap', ['macos'])]);
    await post([{ ...PASSED, teamIds: ['TEAM000001', 'TEAM000002'] }]);
    expect((await view())?.status).toBe('pending');
    await env.DB.prepare("UPDATE release_checks SET admin_approved_at = '2026-11-15T00:00:00Z'").run();
    expect((await view())?.status).toBe('listed');
  });
});
