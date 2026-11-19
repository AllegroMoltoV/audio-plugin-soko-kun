// 推奨 pricing-declaration の判定に使う事実の行 (X10)。申告と、素材のライセンスの文書の有無を LLM に渡す。
// 危険側は、申告があるのに事実の行が申告なしになり、LLM が README との食い違いを判定できないこと。
// 渡す経路は 3 つ: 別の起動で取得した版、同じ起動で取得した版、確認のモード。
import { env } from 'cloudflare:test';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { Budget } from '../../src/budget';
import { NO_PRICING } from '../../src/domain/declaration';
import { pricingFacts, runReleaseChecks } from '../../src/domain/release-checks';
import { checkPlugin, submitPlugin } from '../../src/domain/submit';
import type { Env } from '../../src/env';
import { markListable } from '../fixtures/checks';
import { githubHandlers, OWNER, REPO, releaseCheckHandlers, USER_TOKEN } from '../fixtures/github';
import { network } from '../setup';

const submitter = { githubUserId: 4242, githubToken: USER_TOKEN };
const url = `https://github.com/${OWNER}/${REPO}`;
const DECLARED =
  'Declarations in .audio-soko-kun/config.json: paidFeatures true; paidServices OpenAI API; restrictedAssets not declared';
const CONFIG = JSON.stringify({ paidFeatures: true, paidServices: ['OpenAI API'] });

// Workers AI の代わりに、LLM に渡した入力を記録して空の指摘を返す。
function capturingAi(inputs: string[]): Env {
  return {
    ...env,
    AI: {
      run: async (_model: string, args: { input: string }) => {
        inputs.push(args.input);
        return { output: [{ type: 'message', content: [{ text: '{"findings":[]}' }] }] };
      },
    },
  } as unknown as Env;
}

const configHandler = (text: string) =>
  http.get('https://api.github.com/repos/:owner/:repo/contents/.audio-soko-kun/config.json', () =>
    HttpResponse.text(text),
  );

describe('pricingFacts', () => {
  it('宣言ファイルが無い版は、申告なしではなく宣言ファイルなしと書く', () => {
    expect(pricingFacts(null, [])).toEqual([
      'Declarations in .audio-soko-kun/config.json: no declaration file',
      'License and notice files for bundled assets: none found',
    ]);
  });

  it('項目の無い宣言は not declared、[] は none と書き分ける', () => {
    expect(pricingFacts(NO_PRICING, [])[0]).toBe(
      'Declarations in .audio-soko-kun/config.json: paidFeatures not declared; paidServices not declared; restrictedAssets not declared',
    );
    expect(pricingFacts({ ...NO_PRICING, paidFeatures: false, paidServices: [], restrictedAssets: true }, [])[0]).toBe(
      'Declarations in .audio-soko-kun/config.json: paidFeatures false; paidServices none; restrictedAssets true',
    );
  });

  it('NOTICE と THIRD_PARTY_LICENSES はファイルの一覧から有無だけを書き、ほかのファイルを数えない', () => {
    const facts = pricingFacts(NO_PRICING, [
      'NOTICE',
      'assets/THIRD_PARTY_LICENSES.txt',
      'LICENSE',
      'src/notice.cpp',
      'a/b/NOTICE',
    ]);
    expect(facts[1]).toBe('License and notice files for bundled assets: NOTICE, assets/THIRD_PARTY_LICENSES.txt');
  });
});

describe('事実の行が LLM の入力に届く 3 つの経路', () => {
  // 登録した版 7001 を、レビューだけが残った状態にする。
  async function prepare(): Promise<void> {
    network.use(...githubHandlers());
    const result = await submitPlugin(env, submitter, url);
    if (!result.ok) throw new Error(result.code);
    network.resetHandlers();
    await markListable(env.DB);
    await env.DB.prepare("UPDATE release_checks SET review_state = 'pending'").run();
  }

  it('別の起動で取得した版は、保存した config_json の申告を渡す', async () => {
    await prepare();
    await env.DB.prepare(
      "UPDATE release_checks SET config_state = 'pending', config_fetched_at = '2026-11-15T00:00:00Z', config_json = ?",
    )
      .bind(CONFIG)
      .run();
    const inputs: string[] = [];
    // 宣言ファイルは取得しない。取得すれば 404 で申告なしになる。
    network.use(...releaseCheckHandlers());
    await runReleaseChecks(capturingAi(inputs), new Budget());
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toContain(DECLARED);
  });

  it('同じ起動で取得した版は、その場で読んだ申告と NOTICE の有無を渡す', async () => {
    await prepare();
    await env.DB.prepare("UPDATE release_checks SET config_state = 'pending', config_fetched_at = NULL").run();
    const inputs: string[] = [];
    network.use(
      configHandler(CONFIG),
      http.get('https://api.github.com/repos/:owner/:repo/git/trees/:ref', () =>
        HttpResponse.json({ tree: [{ path: 'NOTICE.md', type: 'blob' }], truncated: false }),
      ),
      ...releaseCheckHandlers(),
    );
    await runReleaseChecks(capturingAi(inputs), new Budget());
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toContain(DECLARED);
    expect(inputs[0]).toContain('License and notice files for bundled assets: NOTICE.md');
  });

  it('確認のモードは、既定のブランチの宣言の申告を渡す', async () => {
    const inputs: string[] = [];
    network.use(configHandler(CONFIG), ...githubHandlers({ release: 'none' }), ...releaseCheckHandlers());
    await checkPlugin(capturingAi(inputs), submitter, url);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toContain(DECLARED);
  });
});
