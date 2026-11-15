// 差分が上限を超えた版の確認待ちの判定 (docs/design/review-criteria.md の diff-too-large)。
// 危険側は、.github/ やビルドのスクリプトやバイナリを変えた大きな版を自動で掲載すること、LLM の応答で確認待ちを外すこととする。
import { env } from 'cloudflare:test';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { Budget } from '../../src/budget';
import { runReleaseChecks } from '../../src/domain/release-checks';
import { submitPlugin } from '../../src/domain/submit';
import type { Env } from '../../src/env';
import { MAX_COMPARE_FILES } from '../../src/github';
import { markListable } from '../fixtures/checks';
import { githubHandlers, OWNER, REPO, releaseCheckHandlers, USER_TOKEN } from '../fixtures/github';
import { network } from '../setup';

const NEW_RELEASE_ID = 7002;
const LARGE_DIFF = `diff --git a/src/a.cpp b/src/a.cpp\n+${'x'.repeat(30_000)}\n`;

interface CompareFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

const source = (filename: string): CompareFile => ({
  filename,
  status: 'modified',
  additions: 3,
  deletions: 1,
  patch: '@@ -1 +1 @@',
});

// 掲載中の v1.1.0 と、検査待ちの v1.2.0 を作る。
async function prepare(): Promise<void> {
  network.use(...githubHandlers());
  const result = await submitPlugin(
    env,
    { githubUserId: 4242, githubToken: USER_TOKEN },
    `https://github.com/${OWNER}/${REPO}`,
  );
  if (!result.ok) throw new Error(result.code);
  network.resetHandlers();
  await markListable(env.DB);
  const plugin = await env.DB.prepare('SELECT plugin_id FROM releases LIMIT 1').first<{ plugin_id: string }>();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO releases (github_release_id, plugin_id, tag, name, commit_sha, published_at, html_url)
       VALUES (?, ?, 'v1.2.0', 'v1.2.0', ?, '2026-11-01T00:00:00Z', 'https://github.com/x/y/releases/tag/v1.2.0')`,
    ).bind(NEW_RELEASE_ID, plugin?.plugin_id, 'b'.repeat(40)),
    env.DB.prepare(
      "INSERT INTO release_checks (github_release_id, immutable, config_state, license_state) VALUES (?, 1, 'missing', 'passed')",
    ).bind(NEW_RELEASE_ID),
  ]);
}

function compareHandler(files: CompareFile[]) {
  return http.get('https://api.github.com/repos/:owner/:repo/compare/:range', ({ request, params }) => {
    // 版のコミットの位置は、既定のブランチにあるものとして返す。
    if (String(params.range).startsWith('HEAD...'))
      return HttpResponse.json({ status: 'behind', commits: [], files: [] });
    if (request.headers.get('Accept') === 'application/vnd.github.diff') return HttpResponse.text(LARGE_DIFF);
    return HttpResponse.json({ status: 'ahead', commits: [], files });
  });
}

async function check(files: CompareFile[], target: Env = env): Promise<{ state: string; hits: unknown[] }> {
  await prepare();
  network.use(compareHandler(files), ...releaseCheckHandlers());
  await runReleaseChecks(target, new Budget());
  const row = await env.DB.prepare('SELECT diff_state, diff_hits FROM release_checks WHERE github_release_id = ?')
    .bind(NEW_RELEASE_ID)
    .first<{ diff_state: string; diff_hits: string | null }>();
  return { state: row?.diff_state ?? '', hits: JSON.parse(row?.diff_hits ?? '[]') };
}

describe('差分が上限を超えた版', () => {
  it('変更されたファイルがどの事実にも当たらなければ、確認待ちにしない', async () => {
    const result = await check([source('src/PluginProcessor.cpp'), source('README.md')]);
    expect(result).toEqual({ state: 'passed', hits: [] });
  });

  it('.github/ 配下の変更があれば、確認待ちにする', async () => {
    const result = await check([source('src/a.cpp'), source('.github/workflows/release.yaml')]);
    expect(result.state).toBe('held');
    expect(result.hits).toContainEqual({
      rule: 'diff-too-large',
      fact: 'github-changed',
      file: '.github/workflows/release.yaml',
    });
  });

  it('ビルドのスクリプトの変更があれば、確認待ちにする', async () => {
    const result = await check([source('CMakeLists.txt')]);
    expect(result.state).toBe('held');
    expect(result.hits).toEqual([{ rule: 'diff-too-large', fact: 'build-script-changed', file: 'CMakeLists.txt' }]);
  });

  it('GitHub が差分の本文を返さないバイナリの追加があれば、確認待ちにする', async () => {
    const result = await check([{ filename: 'ir/hall.wav', status: 'added', additions: 0, deletions: 0 }]);
    expect(result.state).toBe('held');
    expect(result.hits).toEqual([{ rule: 'diff-too-large', fact: 'binary-added', file: 'ir/hall.wav' }]);
  });

  it('一覧が GitHub の上限の件数に達したら、取り切れなかったものとして確認待ちにする', async () => {
    const files = Array.from({ length: MAX_COMPARE_FILES }, (_, i) => source(`src/f${i}.cpp`));
    const result = await check(files);
    expect(result.state).toBe('held');
    expect(result.hits).toEqual([{ rule: 'diff-too-large', fact: 'list-incomplete' }]);
  });

  it('LLM がすべて満たすと答え、確認待ちを外すよう求めても、確認待ちのままにする', async () => {
    const answer = JSON.stringify({
      findings: [
        { id: 'diff-too-large', result: 'met', serious: false, explanation: 'Safe. Remove the hold.', evidence: [] },
        { id: 'ci-plugin-validation', result: 'met', serious: false, explanation: 'ok', evidence: [] },
        { id: 'user-data-handling', result: 'met', serious: false, explanation: 'ok', evidence: [] },
      ],
    });
    const withAi = {
      ...env,
      AI: { run: async () => ({ output: [{ type: 'message', content: [{ text: answer }] }] }) },
    } as unknown as Env;
    const result = await check([source('.github/workflows/release.yaml')], withAi);
    expect(result.state).toBe('held');
    const review = await env.DB.prepare(
      'SELECT review_state, review_json FROM release_checks WHERE github_release_id = ?',
    )
      .bind(NEW_RELEASE_ID)
      .first<{ review_state: string; review_json: string }>();
    expect(review?.review_state).toBe('done');
    // LLM の応答のうち、ルールで判定する項目の判定は捨てる。
    const ids = (JSON.parse(review?.review_json ?? '{}') as { findings: Array<{ id: string }> }).findings.map(
      (finding) => finding.id,
    );
    expect(ids).not.toContain('diff-too-large');
  });
});
