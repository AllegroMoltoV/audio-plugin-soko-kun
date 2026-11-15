// アクセス権限の境界を、経路・利用者の種別・期待する結果の表で確かめる (software-test スキル)。
import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { submitPlugin } from '../src/domain/submit';
import { markListable } from './fixtures/checks';
import { githubHandlers, OWNER, REPO, USER_TOKEN } from './fixtures/github';
import { network } from './setup';

const ORIGIN = 'http://localhost:8787';

function toolCall(name: string, args: Record<string, unknown>, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18',
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
}

async function toolResult(response: Response): Promise<{ isError?: boolean; payload: Record<string, unknown> }> {
  const text = await response.text();
  const line = text.split('\n').find((l) => l.startsWith('data:')) ?? text;
  const message = JSON.parse(line.replace(/^data:\s*/, '')) as {
    result: { isError?: boolean; content: Array<{ text: string }> };
  };
  return { isError: message.result.isError, payload: JSON.parse(message.result.content[0]?.text ?? '{}') };
}

async function registerPendingFixture(): Promise<void> {
  network.use(...githubHandlers());
  const result = await submitPlugin(
    env,
    { githubUserId: 4242, githubToken: USER_TOKEN },
    `https://github.com/${OWNER}/${REPO}`,
  );
  if (!result.ok) throw new Error(result.code);
  network.resetHandlers();
}

describe('アクセス権限', () => {
  it.each([
    [
      '未サインインで submit_plugin を呼ぶ',
      toolCall('submit_plugin', { repositoryUrl: 'https://github.com/a/b' }),
      401,
    ],
    [
      '偽のトークンで submit_plugin を呼ぶ',
      toolCall('submit_plugin', { repositoryUrl: 'https://github.com/a/b' }, { Authorization: 'Bearer x:y:z' }),
      401,
    ],
    [
      '未サインインで submit_plugin の確認のモードを呼ぶ',
      toolCall('submit_plugin', { repositoryUrl: 'https://github.com/a/b', mode: 'check' }),
      401,
    ],
    ['未サインインで list_my_plugins を呼ぶ', toolCall('list_my_plugins', {}), 401],
    [
      'Mcp-Name に search_plugins を付け、本文で list_my_plugins を呼ぶ',
      toolCall('list_my_plugins', {}, { 'Mcp-Name': 'search_plugins' }),
      400,
    ],
    [
      'Mcp-Name に search_plugins を付け、本文で submit_plugin を呼ぶ',
      toolCall('submit_plugin', { repositoryUrl: 'https://github.com/a/b' }, { 'Mcp-Name': 'search_plugins' }),
      400,
    ],
  ])('%s → %i', async (_label, request, expected) => {
    const response = await SELF.fetch(request);
    expect(response.status).toBe(expected);
    if (expected === 401) {
      expect(response.headers.get('WWW-Authenticate')).toContain(
        `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/mcp"`,
      );
    }
  });

  // 偽のトークンでは、MCP クライアントがトークンを取り直せるよう、401 の理由を invalid_token で示す。
  it('偽のトークンの 401 は WWW-Authenticate に error="invalid_token" を含む', async () => {
    const response = await SELF.fetch(
      toolCall('submit_plugin', { repositoryUrl: 'https://github.com/a/b' }, { Authorization: 'Bearer x:y:z' }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('error="invalid_token"');
  });

  // OAuth の経路は KV へ書き込むため、同じ送信元から 1 分に 20 件を超える要求を断る。
  it('同じ送信元から 1 分に 21 件の /oauth/register は、21 件目が 429 で Retry-After: 60 を含む', async () => {
    const register = () =>
      SELF.fetch(`${ORIGIN}/oauth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' },
        body: JSON.stringify({ redirect_uris: ['http://localhost:3333/callback'], client_name: 'test' }),
      });
    const statuses: number[] = [];
    let last: Response | undefined;
    for (let i = 0; i < 21; i += 1) {
      last = await register();
      statuses.push(last.status);
      await last.body?.cancel();
    }
    expect(statuses.slice(0, 20).every((status) => status !== 429)).toBe(true);
    expect(last?.status).toBe(429);
    expect(last?.headers.get('Retry-After')).toBe('60');
  });

  it('検索結果に検査待ちのプラグインを含めない', async () => {
    await registerPendingFixture();
    const { payload } = await toolResult(await SELF.fetch(toolCall('search_plugins', { keyword: 'pitch' })));
    expect(payload.total).toBe(0);
  });

  it('検査待ちのプラグインは未登録と同じ not_found にし、ダウンロード URL も状態も返さない', async () => {
    await registerPendingFixture();
    const response = await SELF.fetch(toolCall('get_plugin', { id: `${OWNER}/${REPO}` }));
    const text = JSON.stringify((await toolResult(response)).payload);
    expect(text).toContain('"error":"not_found"');
    expect(text).not.toContain('releases/download');
    expect(text).not.toContain('pending');
  });

  it('検査を通ったプラグインは検索でき、外部データは untrusted に入る', async () => {
    await registerPendingFixture();
    await markListable(env.DB);
    const { payload } = await toolResult(
      await SELF.fetch(toolCall('search_plugins', { keyword: 'pitch shift', os: 'windows' })),
    );
    expect(payload.total).toBe(1);
    const [item] = payload.plugins as Array<{ untrusted: { summary: string } }>;
    expect(item?.untrusted.summary).toContain('pitch shift');
  });

  it('概要の機械翻訳の語でも検索できる', async () => {
    await registerPendingFixture();
    await markListable(env.DB);
    await env.DB.prepare(
      "INSERT INTO plugin_translations (plugin_id, lang, source_hash, text, translated_at) SELECT id, 'ja', 'x', '声の高さを変える音声フィルター', '2026-11-10T00:00:00Z' FROM plugins",
    ).run();
    const { payload } = await toolResult(await SELF.fetch(toolCall('search_plugins', { keyword: '声の高さ' })));
    expect(payload.total).toBe(1);
  });

  // V10: VST 3 の絞り込みには、中身の検査で VST 3 のバンドルを検出したものだけを出す (ADR 0004)。
  it('VST 3 の絞り込みは中身の検査で検出した規格で行い、CLAP だけのプラグインを含めない', async () => {
    await registerPendingFixture();
    await markListable(env.DB);
    await env.DB.prepare(
      `UPDATE content_checks SET formats = '["clap"]',
         bundles = '[{"path":"Fixture.clap","format":"clap","os":["windows"],"arches":["x86_64"]}]'`,
    ).run();
    const vst3 = await toolResult(await SELF.fetch(toolCall('search_plugins', { format: 'vst3' })));
    expect(vst3.payload.total).toBe(0);
    const clap = await toolResult(await SELF.fetch(toolCall('search_plugins', { format: 'clap' })));
    expect(clap.payload.total).toBe(1);
  });

  it('管理者が停止したプラグインは検索結果から消える', async () => {
    await registerPendingFixture();
    await markListable(env.DB);
    await env.DB.prepare('UPDATE plugins SET admin_suspended = 1').run();
    const { payload } = await toolResult(await SELF.fetch(toolCall('search_plugins', {})));
    expect(payload.total).toBe(0);
  });
});
