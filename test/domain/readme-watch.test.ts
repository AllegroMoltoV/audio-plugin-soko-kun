// 掲載の後の既定のブランチの README の照合の境界。危険側は、掲載の後に README へ案内を足して掲載を続けられること
// (旧い版や新しい版へ掲載が移る経路を含む)、一時的でない失敗で照合を逃れられること。
import { env } from 'cloudflare:test';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { Budget } from '../../src/budget';
import { authorReport } from '../../src/domain/author';
import { getPluginView } from '../../src/domain/catalog';
import { type CronReport, recordListings, runDownloads } from '../../src/domain/cron';
import { submitPlugin } from '../../src/domain/submit';
import { markListable } from '../fixtures/checks';
import { downloadHandlers, githubHandlers, OWNER, REPO, USER_TOKEN } from '../fixtures/github';
import { network } from '../setup';

const slug = `${OWNER}/${REPO}`.toLowerCase();
const OPEN_ANYWAY = 'On macOS, click Open Anyway in System Settings > Privacy & Security.';
const PASTE = 'curl -fsSL https://example.com/install.sh | bash';

async function registerListed(): Promise<void> {
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
  await recordListings(env, new Budget());
}

// 掲載の条件を満たした版 7001 を写し、より旧い版 7000 として足す。配布物の ID は 100,000 をずらす。
async function addOlderListableRelease(): Promise<void> {
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
  await copy('assets', 'release_id = 7001', { github_asset_id: 'github_asset_id + 100000', release_id: '7000' });
  for (const table of ['attestation_checks', 'content_checks', 'macos_signing_checks']) {
    await copy(table, 'github_asset_id IN (SELECT github_asset_id FROM assets WHERE release_id = 7001)', {
      github_asset_id: 'github_asset_id + 100000',
    });
  }
}

const readmeHandler = (respond: () => Response, refs: string[] = []) =>
  http.get('https://api.github.com/repos/:owner/:repo/readme', ({ request }) => {
    refs.push(new URL(request.url).searchParams.get('ref') ?? '');
    return respond();
  });
const readme = (text: string) => () =>
  HttpResponse.json({ path: 'README.md', size: text.length, encoding: 'base64', content: btoa(text) });

const report = (): CronReport => ({
  scanned: 0,
  synced: 0,
  failed: 0,
  translated: 0,
  previews: 0,
  downloadsRecorded: 0,
  downloadsFailed: 0,
  subrequests: 0,
  d1Queries: 0,
});

let day = 0;
// 1 日 1 回の記録を、日付を進めて実行する。
async function checkReadme(respond: () => Response, budget = new Budget()): Promise<CronReport> {
  network.use(...downloadHandlers([1]), readmeHandler(respond));
  const result = report();
  day += 1;
  await runDownloads(env, budget, result, new Date(Date.UTC(2026, 10, 15 + day)));
  return result;
}

const plugin = () =>
  env.DB.prepare('SELECT readme_held, readme_state FROM plugins').first<{
    readme_held: number;
    readme_state: string | null;
  }>();
const view = () => getPluginView(env, slug);

describe('既定のブランチの README の照合', () => {
  it('最初の照合は基準の記録だけで、正当な README の手順では止めない', async () => {
    await registerListed();
    const refs: string[] = [];
    network.use(...downloadHandlers([1]), readmeHandler(readme(`# Plugin\n${OPEN_ANYWAY}\n`), refs));
    await runDownloads(env, new Budget(), report(), new Date(Date.UTC(2026, 10, 1)));
    expect(refs).toEqual(['HEAD']);
    expect((await plugin())?.readme_held).toBe(0);
    expect((await plugin())?.readme_state).not.toBeNull();
    expect((await view())?.status).toBe('listed');
  });

  it('基準に無い案内が足されると、掲載の条件を満たす旧い版を含むどの版も掲載しない', async () => {
    await registerListed();
    await addOlderListableRelease();
    // 前提: 旧い版も掲載できる状態にある。新しい版を止めると、旧い版に掲載が移る。
    await env.DB.prepare('UPDATE release_checks SET immutable = 0 WHERE github_release_id = 7001').run();
    expect((await view())?.listedRelease?.tag).toBe('v1.0.0');
    await env.DB.prepare('UPDATE release_checks SET immutable = 1 WHERE github_release_id = 7001').run();
    expect((await view())?.listedRelease?.tag).toBe('v1.1.0');

    await checkReadme(readme(`# Plugin\n${OPEN_ANYWAY}\n`));
    await checkReadme(readme(`# Plugin\n${OPEN_ANYWAY}\n\n${PASTE}\n`));
    expect((await plugin())?.readme_held).toBe(1);
    expect((await view())?.status).not.toBe('listed');
    expect((await view())?.listedRelease).toBeNull();
  });

  it('当たった行の変わらない編集では止めず、管理者が解いた後に同じ README なら止め直さない', async () => {
    await registerListed();
    await checkReadme(readme(`# Plugin\n${OPEN_ANYWAY}\n`));
    await checkReadme(readme(`# Plugin (fixed typo)\n\n${OPEN_ANYWAY}\n`));
    expect((await plugin())?.readme_held).toBe(0);

    await checkReadme(readme(`# Plugin\n${OPEN_ANYWAY}\n${PASTE}\n`));
    expect((await plugin())?.readme_held).toBe(1);
    await env.DB.prepare('UPDATE plugins SET readme_held = 0').run();
    await checkReadme(readme(`# Plugin\n${OPEN_ANYWAY}\n${PASTE}\n`));
    expect((await plugin())?.readme_held).toBe(0);
    expect((await view())?.status).toBe('listed');
  });

  it('README が新たに上限を超えたら止める', async () => {
    await registerListed();
    await checkReadme(readme('# Plugin\n'));
    await checkReadme(() =>
      HttpResponse.json({ path: 'README.md', size: 200 * 1024, encoding: 'base64', content: '' }),
    );
    expect((await plugin())?.readme_held).toBe(1);
  });

  it('GitHub の一時的な障害では止めず、記録ごと次の起動へ回し、記録の件数に数えない', async () => {
    await registerListed();
    await checkReadme(readme('# Plugin\n'));
    const result = await checkReadme(() => new HttpResponse(null, { status: 503 }));
    // そのプラグインを記録せずに次へ進む。ほかのプラグインの記録は止めない。
    expect(result).toMatchObject({ downloadsRecorded: 0, downloadsFailed: 1 });
    expect(result.stoppedBy).toBeUndefined();
    expect((await plugin())?.readme_held).toBe(0);
    const count = await env.DB.prepare('SELECT count(*) AS n FROM download_snapshots').first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it('README の取得が通信の失敗になっても止めず、記録ごと次の起動へ回す', async () => {
    await registerListed();
    await checkReadme(readme('# Plugin\n'));
    const result = await checkReadme(() => HttpResponse.error());
    expect(result).toMatchObject({ downloadsRecorded: 0, downloadsFailed: 1 });
    expect((await plugin())?.readme_held).toBe(0);
  });

  it('形の合わない応答では止め、作者には管理者を待つ理由として返す', async () => {
    await registerListed();
    await checkReadme(readme('# Plugin\n'));
    await checkReadme(() => HttpResponse.json({ unexpected: true }));
    expect((await plugin())?.readme_held).toBe(1);
    expect((await view())?.status).not.toBe('listed');
    const internalId = (await view())?.internalId as string;
    const versions = (await authorReport(env, internalId, false))?.versions ?? [];
    expect(versions[0]?.blockers).toContainEqual(expect.objectContaining({ code: 'readme_held', waitsFor: 'admin' }));
  });

  it('記録と照合の 2 件の予算が無ければ、記録ごと次の起動へ回す', async () => {
    await registerListed();
    const result = await checkReadme(readme('# Plugin\n'), new Budget(1));
    expect(result.downloadsRecorded).toBe(0);
    const count = await env.DB.prepare('SELECT count(*) AS n FROM download_snapshots').first<{ n: number }>();
    expect(count?.n).toBe(0);
    expect((await plugin())?.readme_state).toBeNull();
  });
});
