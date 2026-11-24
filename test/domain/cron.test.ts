// 定期処理の危険側の境界: 停止の解除、検査結果の流用、障害時のデータ破壊、無料プランの上限超過。
import { env } from 'cloudflare:test';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { Budget } from '../../src/budget';
import {
  DISPATCH_RESERVE,
  FINAL_QUERIES,
  FINAL_RESERVE,
  MALWAREBAZAAR_PER_RUN,
  recordListings,
  runCron,
  SYNC_COST,
  SYNC_OUTAGE_FAILURES,
  SYNC_QUERIES,
} from '../../src/domain/cron';
import { RELEASE_CHECK_COST, runReleaseChecks } from '../../src/domain/release-checks';
import { MAX_SCAN_ATTEMPTS } from '../../src/domain/status';
import { submitPlugin } from '../../src/domain/submit';
import { markListable } from '../fixtures/checks';
import {
  downloadHandlers,
  githubHandlers,
  imageHandlers,
  OWNER,
  REPO,
  REPO_ID,
  releaseCheckHandlers,
  USER_TOKEN,
} from '../fixtures/github';
import { png, svg } from '../fixtures/images';
import { network } from '../setup';

const submitter = { githubUserId: 4242, githubToken: USER_TOKEN };

async function registerFixture(): Promise<void> {
  network.use(...githubHandlers());
  const result = await submitPlugin(env, submitter, `https://github.com/${OWNER}/${REPO}`);
  if (!result.ok) throw new Error(`fixture registration failed: ${result.code}`);
  network.resetHandlers();
  // 同期の対象にするため、最後の同期時刻を過去にずらす。
  await env.DB.prepare("UPDATE plugins SET last_synced_at = '2000-01-01T00:00:00Z'").run();
}

const repoById = (status = 200, extra: Record<string, unknown> = {}) =>
  http.get(`https://api.github.com/repositories/${REPO_ID}`, () =>
    status === 200
      ? HttpResponse.json({
          id: REPO_ID,
          name: REPO,
          owner: { login: OWNER },
          private: false,
          archived: false,
          license: { spdx_id: 'GPL-2.0' },
          ...extra,
        })
      : new HttpResponse(null, { status }),
  );

// 検査の対象にならない (リリースの無い) プラグインを足す。last_synced_at は同期の順番を決める。
async function insertBarePlugin(index: number, lastSyncedAt: string): Promise<void> {
  const stamp = '2000-01-01T00:00:00Z';
  await env.DB.prepare(
    `INSERT OR IGNORE INTO plugins (id, github_repo_id, owner, repo, license_spdx, submitter_github_id, created_at, updated_at, last_synced_at)
     VALUES (?, ?, ?, ?, 'MIT', 1, ?, ?, ?)`,
  )
    .bind(`allegromoltov/q${index}`, 920000 + index, OWNER, `q${index}`, stamp, stamp, lastSyncedAt)
    .run();
}

// GitHub 全体の障害。同期が続けて失敗して止まるよう、検査の対象にならないプラグインを足して SYNC_OUTAGE_FAILURES 件以上にする。
async function githubOutage() {
  for (let i = 1; i < SYNC_OUTAGE_FAILURES; i += 1) await insertBarePlugin(i, '2000-01-01T00:00:00Z');
  return http.get('https://api.github.com/repositories/:id', () => new HttpResponse(null, { status: 503 }));
}

const bareRepo = (index: number) =>
  http.get(`https://api.github.com/repositories/${920000 + index}`, () =>
    HttpResponse.json({
      id: 920000 + index,
      name: `q${index}`,
      owner: { login: OWNER },
      private: false,
      archived: false,
      license: { spdx_id: 'MIT' },
    }),
  );
const bareLatest = (index: number) =>
  http.get(
    `https://api.github.com/repos/${OWNER}/q${index}/releases/latest`,
    () => new HttpResponse(null, { status: 304 }),
  );

const scannerHandlers = (counter: { mb: number }) => [
  http.post('https://mb-api.abuse.ch/api/v1/', () => {
    counter.mb += 1;
    return HttpResponse.json({ query_status: 'hash_not_found' });
  }),
];

describe('runCron', () => {
  it('管理者が停止したプラグインは、同期と検査の後も停止のまま', async () => {
    await registerFixture();
    await env.DB.prepare('UPDATE plugins SET admin_suspended = 1').run();
    network.use(
      repoById(),
      ...githubHandlers(),
      ...imageHandlers(),
      ...downloadHandlers(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    await runCron(env);
    const row = await env.DB.prepare('SELECT admin_suspended FROM plugins').first<{ admin_suspended: number }>();
    expect(row?.admin_suspended).toBe(1);
  });

  it('GitHub でリポジトリが消えたら掲載終了にする', async () => {
    await registerFixture();
    // 新しい版の検査は同期より先に走る。消えたリポジトリでも検査の呼び出しが先に起きる。
    network.use(repoById(404), ...scannerHandlers({ mb: 0 }), ...releaseCheckHandlers());
    await runCron(env);
    const row = await env.DB.prepare('SELECT removed FROM plugins').first<{ removed: number }>();
    expect(row?.removed).toBe(1);
  });

  it('GitHub の障害では、同期の時刻のほかに既存の情報を変えない', async () => {
    await registerFixture();
    const select = `SELECT * FROM plugins WHERE id = (SELECT plugin_id FROM releases LIMIT 1)`;
    const { last_synced_at: _before, ...before } = (await env.DB.prepare(select).first()) ?? {};
    network.use(
      await githubOutage(),
      http.get('https://api.github.com/repos/:owner/:repo/releases', () => new HttpResponse(null, { status: 503 })),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    const report = await runCron(env);
    expect(report).toMatchObject({ stoppedBy: 'github_unavailable', synced: 0, failed: SYNC_OUTAGE_FAILURES });
    const { last_synced_at: after, ...rest } = (await env.DB.prepare(select).first()) ?? {};
    expect(rest).toEqual(before);
    expect(after).not.toBe('2000-01-01T00:00:00Z');
    // 障害で同期が止まった起動でもダウンロード数の記録を試み、失敗したプラグインは記録しない。
    expect(report).toMatchObject({ downloadsRecorded: 0, downloadsFailed: SYNC_OUTAGE_FAILURES });
  });

  it('新しく現れた配布物は、同じ digest の過去の結果があっても照会し直し、証明と中身を検査し直す', async () => {
    await registerFixture();
    await env.DB.prepare(
      "UPDATE scans SET result = 'not_found', attempts = 1, scanned_at = '2026-11-01T00:00:00Z'",
    ).run();
    await markListable(env.DB);
    // 同じ内容のファイルを別のアセット ID で上げ直した新しいリリース
    network.use(
      ...imageHandlers(),
      ...downloadHandlers(),
      repoById(),
      http.get(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, () =>
        HttpResponse.json({
          id: 7002,
          tag_name: 'v1.2.0',
          name: 'v1.2.0',
          draft: false,
          prerelease: false,
          published_at: '2026-11-08T00:00:00Z',
          html_url: `https://github.com/${OWNER}/${REPO}/releases/tag/v1.2.0`,
          assets: [
            {
              id: 8101,
              name: 'x-windows-x64.zip',
              size: 1,
              digest: `sha256:${'d1'.repeat(32)}`,
              browser_download_url: `https://github.com/${OWNER}/${REPO}/releases/download/v1.2.0/x.zip`,
            },
          ],
        }),
      ),
      http.get(`https://api.github.com/repos/${OWNER}/${REPO}/commits/refs/tags/v1.2.0`, () =>
        HttpResponse.json({ sha: 'abc' }),
      ),
      ...releaseCheckHandlers(),
    );
    await runCron(env, undefined);
    const scan = await env.DB.prepare(`SELECT result FROM scans WHERE digest = ? AND scanner = 'malwarebazaar'`)
      .bind(`sha256:${'d1'.repeat(32)}`)
      .first<{ result: string }>();
    expect(scan?.result).toBe('pending');
    const checks = await env.DB.prepare(
      `SELECT t.result AS attestation, c.result AS content FROM attestation_checks t
       LEFT JOIN content_checks c ON c.github_asset_id = t.github_asset_id WHERE t.github_asset_id = 8101`,
    ).first();
    expect(checks).toEqual({ attestation: 'pending', content: 'pending' });
  });

  it('多数のプラグインがあっても 1 回の外部呼び出しと D1 クエリが予算に収まる', async () => {
    await registerFixture();
    const stamp = '2000-01-01T00:00:00Z';
    for (let i = 0; i < 30; i += 1) {
      await env.DB.prepare(
        `INSERT INTO plugins (id, github_repo_id, owner, repo, license_spdx, submitter_github_id, created_at, updated_at, last_synced_at)
         VALUES (?, ?, ?, ?, 'MIT', 1, ?, ?, ?)`,
      )
        .bind(`allegromoltov/p${i}`, 910000 + i, OWNER, `p${i}`, stamp, stamp, stamp)
        .run();
      for (const scanner of ['malwarebazaar']) {
        await env.DB.prepare("INSERT INTO scans (digest, scanner, result) VALUES (?, ?, 'pending')")
          .bind(`sha256:${i.toString(16).padStart(64, '0')}`, scanner)
          .run();
      }
    }
    const counter = { mb: 0 };
    network.use(
      ...imageHandlers(),
      ...downloadHandlers(),
      ...scannerHandlers(counter),
      http.get('https://api.github.com/repositories/:id', ({ params }) =>
        HttpResponse.json({
          id: Number(params.id),
          name: 'p',
          owner: { login: OWNER },
          private: false,
          archived: false,
          license: { spdx_id: 'MIT' },
        }),
      ),
      http.get(
        'https://api.github.com/repos/:owner/:repo/releases/latest',
        () => new HttpResponse(null, { status: 304 }),
      ),
      ...releaseCheckHandlers(),
    );
    const report = await runCron(env);
    expect(report.subrequests).toBeLessThanOrEqual(45);
    expect(report.d1Queries).toBeLessThanOrEqual(45);
    expect(counter.mb).toBeLessThanOrEqual(10);
  });
});

// 定期処理の生存: 予算を超えないことだけでなく、新しい版の検査と同期が止まらずに進むこと。
// 3 件とも、検査を同期の後に置いていた順序では失敗する。
describe('runCron の新しい版の検査と同期の優先', () => {
  const checkState = () =>
    env.DB.prepare(
      'SELECT config_fetched_at, license_state, diff_state, review_state, review_attempts FROM release_checks',
    ).first<{
      config_fetched_at: string | null;
      license_state: string;
      diff_state: string;
      review_state: string;
      review_attempts: number;
    }>();

  // 登録済みのプラグイン 1 件 (検査を待つ版がある) と、同期を待つほかのプラグイン 20 件。
  async function seedPlugins(): Promise<void> {
    await registerFixture();
    const stamp = '2000-01-01T00:00:00Z';
    for (let i = 0; i < 20; i += 1) {
      await env.DB.prepare(
        `INSERT INTO plugins (id, github_repo_id, owner, repo, license_spdx, submitter_github_id, created_at, updated_at, last_synced_at)
         VALUES (?, ?, ?, ?, 'MIT', 1, ?, ?, ?)`,
      )
        .bind(`allegromoltov/p${i}`, 920000 + i, OWNER, `p${i}`, stamp, stamp, stamp)
        .run();
    }
  }

  const syncHandlers = () => [
    ...imageHandlers(),
    ...downloadHandlers(),
    ...scannerHandlers({ mb: 0 }),
    // 登録済みのプラグインには登録した名前を返す。別の名前を返すと名前の変更として扱われる。
    http.get('https://api.github.com/repositories/:id', ({ params }) => {
      const id = Number(params.id);
      return HttpResponse.json({
        id,
        name: id === REPO_ID ? REPO : `p${id - 920000}`,
        owner: { login: OWNER },
        private: false,
        archived: false,
        license: { spdx_id: id === REPO_ID ? 'GPL-2.0' : 'MIT' },
      });
    }),
    http.get(
      'https://api.github.com/repos/:owner/:repo/releases/latest',
      () => new HttpResponse(null, { status: 304 }),
    ),
  ];

  // 検査の前に予算を使うのは照会だけ。照会が上限まで使っても、同期 1 件と起動の分を残したうえで検査 1 件が収まること。
  // 1 件の処理の外部呼び出しの件数を変えたら、この不等式が崩れないことと docs/design/scanning.md の表を確かめる。
  it('照会を上限まで行っても、同期 1 件の分を残して新しい版の検査 1 件の予算が残る', () => {
    const budget = new Budget();
    expect(budget.maxSubrequests - (FINAL_RESERVE + SYNC_COST) - MALWAREBAZAAR_PER_RUN).toBeGreaterThanOrEqual(
      RELEASE_CHECK_COST,
    );
    // 照会は D1 のクエリを 2 件使う。検査は開始の時点で 6 件を求める (runReleaseChecks)。
    expect(budget.maxD1Queries - (FINAL_QUERIES + SYNC_QUERIES) - 2).toBeGreaterThanOrEqual(6);
  });

  // 同期 1 件は外部呼び出しを 2 件使う。同期を先に行うと、21 件の同期で検査 1 件の分 (RELEASE_CHECK_COST) が残らない。
  it('同期を待つプラグインが多くても、1 回の起動で新しい版の検査が D1 の状態を進める', async () => {
    await seedPlugins();
    network.use(...syncHandlers(), ...releaseCheckHandlers());
    const report = await runCron(env);
    const state = await checkState();
    expect(state?.config_fetched_at).not.toBeNull();
    expect(state?.license_state).not.toBe('pending');
    expect(state?.diff_state).not.toBe('pending');
    expect(report.synced).toBeGreaterThanOrEqual(1);
    expect(report.subrequests).toBeLessThanOrEqual(45);
    expect(report.d1Queries).toBeLessThanOrEqual(45);
  });

  // 名前を変えたリポジトリなどで検査の呼び出しがリダイレクトで膨らんでも、同期が名前を直せるよう後段を走らせる。
  it('検査の途中で予算を使い切っても、検査だけを打ち切り、同じ起動で同期を進める', async () => {
    await seedPlugins();
    const base = 'https://api.github.com/repos/:owner/:repo';
    // すべての取得を 2 回リダイレクトさせ、1 回の取得で外部呼び出しを 3 件使わせる。
    const redirected =
      (serve: () => Response): Parameters<typeof http.get>[1] =>
      ({ request }) => {
        const url = new URL(request.url);
        const hop = Number(url.searchParams.get('hop') ?? '0');
        if (hop < 2) {
          url.searchParams.set('hop', String(hop + 1));
          return new HttpResponse(null, { status: 302, headers: { Location: url.toString() } });
        }
        return serve();
      };
    // レビューが読むファイルは README の API 1、ワークフロー 6、ルートのビルド系のファイル 5、CONTRIBUTING 1、PR テンプレート 1 の 14 件。
    // 検査の取得は、宣言ファイル・ライセンス・版のコミットの位置・ファイルの一覧・14 件・ruleset の一覧の 19 回で、
    // 3 倍の 57 件になる。検査に使える残り (45 − 取り分け 9 − 照会) を、ファイルの取得の途中で超える。
    const paths = [
      ...Array.from({ length: 6 }, (_, i) => `.github/workflows/w${i}.yaml`),
      'CMakeLists.txt',
      'Cargo.toml',
      'vcpkg.json',
      '.gitmodules',
      'meson.build',
      'CONTRIBUTING.md',
      '.github/PULL_REQUEST_TEMPLATE.md',
    ];
    network.use(
      http.get(
        `${base}/git/trees/:ref`,
        redirected(() => HttpResponse.json({ tree: paths.map((path) => ({ path, type: 'blob' })), truncated: false })),
      ),
      http.get(
        `${base}/contents/*`,
        redirected(() => new HttpResponse(null, { status: 404 })),
      ),
      http.get(
        `${base}/readme`,
        redirected(() => new HttpResponse(null, { status: 404 })),
      ),
      http.get(
        `${base}/license`,
        redirected(() => HttpResponse.json({ license: { spdx_id: 'MIT' } })),
      ),
      http.get(
        `${base}/compare/:range`,
        redirected(() => HttpResponse.json({ status: 'behind', commits: [], files: [] })),
      ),
      http.get(
        `${base}/rulesets`,
        redirected(() => HttpResponse.json([])),
      ),
      ...syncHandlers(),
    );
    const report = await runCron(env);
    expect(report.releaseChecksSkipped).toBe('budget');
    expect(report.synced).toBeGreaterThanOrEqual(1);
    expect(report.stoppedBy).toBeUndefined();
    expect(report.subrequests).toBeLessThanOrEqual(45);
    // 予算の超過は差分の失敗としても、レビューの試行としても記録しない。次の起動でやり直す。
    const state = await checkState();
    expect(state?.diff_state).not.toBe('error');
    expect(state?.review_attempts).toBe(0);
  });

  // そのリポジトリだけの恒常的な失敗で、同じ版が検査の先頭を占め続けないようにする。
  it('検査で GitHub が 500 を返し続けると試行を数えて上限で止まり、その間も同期を進める', async () => {
    await seedPlugins();
    const fail = () => new HttpResponse(null, { status: 500 });
    const base = 'https://api.github.com/repos/:owner/:repo';
    // 検査が読むもの (宣言ファイル・ライセンス・差分・ファイルの一覧・ruleset) だけを失敗させる。
    // 同期の画像の一覧 (.audio-soko-kun) は失敗させない。宣言ファイルの経路が画像の経路より先に当たるよう、先頭に置く。
    const failing = () => [
      http.get(`${base}/contents/.audio-soko-kun/config.json`, fail),
      http.get(`${base}/license`, fail),
      http.get(`${base}/compare/:range`, fail),
      http.get(`${base}/git/trees/:ref`, fail),
      http.get(`${base}/rulesets`, fail),
    ];
    const reports = [];
    for (let run = 0; run < 3; run += 1) {
      await env.DB.prepare("UPDATE plugins SET last_synced_at = '2000-01-01T00:00:00Z'").run();
      network.resetHandlers();
      network.use(...failing(), ...syncHandlers());
      reports.push(await runCron(env));
    }
    // 試行の上限 (MAX_REVIEW_ATTEMPTS = 2) に達した版は、3 回目の起動で選ばれない。
    expect((await checkState())?.review_attempts).toBe(2);
    expect(reports[2]?.releasesChecked).toBe(0);
    for (const report of reports) {
      expect(report.synced).toBeGreaterThanOrEqual(1);
      expect(report.stoppedBy).toBeUndefined();
    }
  });
});

describe('runCron の同期の失敗', () => {
  it('1 件のプラグインで 403 が続いても、ほかのプラグインの同期を止めない', async () => {
    const stamp = '2000-01-01T00:00:00Z';
    for (const [i, id] of [
      [1, 920001],
      [2, 920002],
    ] as const) {
      await env.DB.prepare(
        `INSERT INTO plugins (id, github_repo_id, owner, repo, license_spdx, submitter_github_id, created_at, updated_at, last_synced_at)
         VALUES (?, ?, ?, ?, 'MIT', 1, ?, ?, ?)`,
      )
        .bind(`allegromoltov/q${i}`, id, OWNER, `q${i}`, stamp, stamp, `2000-01-0${i}T00:00:00Z`)
        .run();
    }
    network.use(
      ...imageHandlers(),
      ...downloadHandlers(),
      http.get('https://api.github.com/repositories/920001', () => new HttpResponse(null, { status: 403 })),
      http.get('https://api.github.com/repositories/920002', () =>
        HttpResponse.json({
          id: 920002,
          name: 'q2',
          owner: { login: OWNER },
          private: false,
          archived: false,
          license: { spdx_id: 'MIT' },
        }),
      ),
      http.get(
        `https://api.github.com/repos/${OWNER}/q2/releases/latest`,
        () => new HttpResponse(null, { status: 304 }),
      ),
      ...releaseCheckHandlers(),
    );
    const report = await runCron(env);
    expect(report).toMatchObject({ synced: 1, failed: 1 });
  });

  // そのリポジトリだけが 5xx や形の合わない応答を返し続けても、ほかのプラグインを巻き込まない (派生元の ADR 0019 の原則 2)。
  it.each([
    ['503', () => new HttpResponse(null, { status: 503 })],
    ['422', () => new HttpResponse(null, { status: 422 })],
    ['通信の失敗', () => HttpResponse.error()],
    ['JSON でない 200 の応答', () => new HttpResponse('<html>maintenance</html>', { status: 200 })],
  ])(
    '先頭のプラグインで %s が続いても、時刻を進めてほかのプラグインを同期し、定期処理を最後まで進める',
    async (_name, failure) => {
      for (const i of [1, 2, 3]) await insertBarePlugin(i, `2000-01-0${i}T00:00:00Z`);
      network.use(
        ...imageHandlers(),
        ...downloadHandlers(),
        http.get('https://api.github.com/repositories/920001', failure),
        bareRepo(2),
        bareRepo(3),
        bareLatest(2),
        bareLatest(3),
        ...releaseCheckHandlers(),
      );
      const report = await runCron(env);
      expect(report).toMatchObject({ synced: 2, failed: 1 });
      expect(report.stoppedBy).toBeUndefined();
      expect(report.adminNotify).toBeDefined();
      const head = await env.DB.prepare("SELECT last_synced_at FROM plugins WHERE id = 'allegromoltov/q1'").first<{
        last_synced_at: string;
      }>();
      // 時刻を進めるため、次の起動では失敗したプラグインが先頭で止め続けない。
      expect(head?.last_synced_at).not.toBe('2000-01-01T00:00:00Z');
    },
  );

  it('成功を挟まずに続けて失敗したら、GitHub 全体の障害として同期を止める', async () => {
    for (const i of [1, 2, 3, 4]) await insertBarePlugin(i, `2000-01-0${i}T00:00:00Z`);
    const calls: string[] = [];
    network.use(
      http.get('https://api.github.com/repositories/:id', ({ params }) => {
        calls.push(String(params.id));
        return new HttpResponse(null, { status: 503 });
      }),
      ...releaseCheckHandlers(),
    );
    const report = await runCron(env);
    expect(report).toMatchObject({ stoppedBy: 'github_unavailable', synced: 0, failed: SYNC_OUTAGE_FAILURES });
    expect(calls).toHaveLength(SYNC_OUTAGE_FAILURES);
  });

  it('通信の失敗は続けて起きても GitHub の障害の数に入れず、同期を止めない', async () => {
    for (const i of [1, 2, 3, 4]) await insertBarePlugin(i, `2000-01-0${i}T00:00:00Z`);
    network.use(
      ...[1, 2, 3].map((i) =>
        http.get(`https://api.github.com/repositories/${920000 + i}`, () => HttpResponse.error()),
      ),
      bareRepo(4),
      bareLatest(4),
      ...downloadHandlers(),
      ...releaseCheckHandlers(),
    );
    const report = await runCron(env);
    expect(report).toMatchObject({ synced: 1, failed: 3 });
    expect(report.stoppedBy).toBeUndefined();
  });

  it('成功か、GitHub の障害の証拠にならない失敗を挟めば、同期を止めない', async () => {
    for (const i of [1, 2, 3, 4, 5, 6]) await insertBarePlugin(i, `2000-01-0${i}T00:00:00Z`);
    const unavailable = () => new HttpResponse(null, { status: 503 });
    network.use(
      http.get('https://api.github.com/repositories/920001', unavailable),
      bareRepo(2),
      bareLatest(2),
      http.get('https://api.github.com/repositories/920003', unavailable),
      http.get('https://api.github.com/repositories/920004', () => new HttpResponse(null, { status: 403 })),
      http.get('https://api.github.com/repositories/920005', unavailable),
      bareRepo(6),
      bareLatest(6),
      ...downloadHandlers(),
      ...releaseCheckHandlers(),
    );
    const report = await runCron(env);
    expect(report).toMatchObject({ synced: 2, failed: 4 });
    expect(report.stoppedBy).toBeUndefined();
  });

  it('ダウンロード数の記録で先頭の 3 件が失敗し続けても、ほかのプラグインを記録する', async () => {
    await registerFixture();
    const fixture = await env.DB.prepare('SELECT id FROM plugins').first<{ id: string }>();
    // 記録の済んだ日が古いものより、記録の無いものが先に選ばれる。失敗するプラグインを先頭に置く。
    await env.DB.prepare("INSERT INTO download_snapshots (plugin_id, day, total) VALUES (?, '2000-01-01', 0)")
      .bind(fixture?.id)
      .run();
    for (const i of [1, 2, 3]) await insertBarePlugin(i, `2000-01-0${i}T00:00:00Z`);
    network.use(
      repoById(),
      ...githubHandlers(),
      ...imageHandlers(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
      ...[1, 2, 3].flatMap((i) => [
        bareRepo(i),
        bareLatest(i),
        http.get(`https://api.github.com/repos/${OWNER}/q${i}/releases`, () => new HttpResponse(null, { status: 503 })),
      ]),
      ...downloadHandlers([5]),
    );
    const report = await runCron(env);
    expect(report.failed).toBe(0);
    expect(report).toMatchObject({ downloadsRecorded: 1, downloadsFailed: 3 });
    const { results } = await env.DB.prepare('SELECT plugin_id FROM download_snapshots WHERE total = 5').all();
    expect(results).toEqual([{ plugin_id: fixture?.id }]);
  });

  it('掲載終了のリポジトリが公開に戻れば、掲載終了を解く', async () => {
    await registerFixture();
    await env.DB.prepare('UPDATE plugins SET removed = 1').run();
    network.use(
      ...imageHandlers(),
      ...downloadHandlers(),
      repoById(),
      http.get(
        `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`,
        () => new HttpResponse(null, { status: 304 }),
      ),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    await runCron(env);
    const row = await env.DB.prepare('SELECT removed FROM plugins').first<{ removed: number }>();
    expect(row?.removed).toBe(0);
  });
});

describe('runCron の画像の取得', () => {
  it('条件に合う画像だけを保存し、タグが変わらなければ取得し直さない', async () => {
    await registerFixture();
    const calls: string[] = [];
    network.use(
      repoById(),
      ...githubHandlers(),
      ...imageHandlers({ 'logo.png': png(64, 64), 'image.png': svg }, calls),
      ...downloadHandlers(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    expect(await runCron(env)).toMatchObject({ synced: 1, failed: 0 });
    const { results } = await env.DB.prepare('SELECT kind, content_type, width FROM plugin_images').all();
    expect(results).toEqual([{ kind: 'logo', content_type: 'image/png', width: 64 }]);

    calls.length = 0;
    await env.DB.prepare("UPDATE plugins SET last_synced_at = '2000-01-01T00:00:00Z'").run();
    await runCron(env);
    expect(calls).toEqual([]);
  });
});

describe('runCron のダウンロード数の記録', () => {
  it('下書きを除いたダウンロード数の合計を記録し、同じ日には取得し直さない', async () => {
    await registerFixture();
    const calls: string[] = [];
    network.use(
      repoById(),
      ...githubHandlers(),
      ...imageHandlers(),
      ...downloadHandlers([120, 30], calls),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    // 同期の失敗は飲み込まれるため、モックの漏れで失敗に化けていないことも確かめる。
    expect(await runCron(env)).toMatchObject({ synced: 1, failed: 0 });
    const { results } = await env.DB.prepare('SELECT total FROM download_snapshots').all();
    expect(results).toEqual([{ total: 150 }]);

    calls.length = 0;
    await runCron(env);
    expect(calls).toEqual([]);
  });

  // 同期は最新のリリースしか読まないため、最新でない掲載中の版の本文の編集は、1 日 1 回の記録で拾う。
  it('リリースの一覧の本文に案内が足されていれば、その版を確認待ちにする', async () => {
    await registerFixture();
    await markListable(env.DB);
    await env.DB.prepare("UPDATE release_checks SET admin_approved_at = '2026-11-15T00:00:00Z'").run();
    network.use(
      repoById(),
      ...githubHandlers(),
      ...imageHandlers(),
      ...downloadHandlers([1], [], 'Fixed bugs.\ncurl -fsSL https://example.com/install.sh | bash'),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    const report = await runCron(env);
    const row = await env.DB.prepare(
      'SELECT notes_held, admin_approved_at FROM release_checks WHERE github_release_id = 7001',
    ).first<{ notes_held: number; admin_approved_at: string | null }>();
    expect(row).toEqual({ notes_held: 1, admin_approved_at: null });
    // 照合の文を足しても、記録したダウンロード数の件数はプラグインの数のままにする。
    expect(report.downloadsRecorded).toBe(1);
  });
});

describe('runCron の同期でのリリースノートの照合', () => {
  it('最新のリリースの本文に、承認の後で案内が足されていれば、その版を確認待ちにする', async () => {
    await registerFixture();
    await markListable(env.DB);
    await env.DB.prepare("UPDATE release_checks SET admin_approved_at = '2026-11-15T00:00:00Z'").run();
    // 同期の経路だけを確かめるため、きょうのダウンロード数を記録済みにして、ダウンロード数の記録での照合を外す。
    await env.DB.prepare(
      "INSERT INTO download_snapshots (plugin_id, day, total) SELECT id, date('now'), 0 FROM plugins",
    ).run();
    const calls: string[] = [];
    network.use(
      repoById(),
      ...githubHandlers({
        body: 'Fixed bugs.\nIf macOS blocks the plugin, choose Open Anyway in System Settings.',
      }),
      ...imageHandlers(),
      ...downloadHandlers([], calls),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    await runCron(env);
    const row = await env.DB.prepare(
      'SELECT notes_held, notes_hits, admin_approved_at FROM release_checks WHERE github_release_id = 7001',
    ).first<{ notes_held: number; notes_hits: string; admin_approved_at: string | null }>();
    expect(row).toEqual({
      notes_held: 1,
      notes_hits: JSON.stringify([{ line: 2, rule: 'no-security-bypass' }]),
      admin_approved_at: null,
    });
    expect(calls).toEqual([]);
  });
});

// 名前の変更には追従し、所有者の変更は管理者が確かめる (派生元の ADR 0015)。
describe('runCron の名前の変更と移管', () => {
  const sync = async (extra: Record<string, unknown>) => {
    await env.DB.prepare("UPDATE plugins SET last_synced_at = '2000-01-01T00:00:00Z'").run();
    network.use(
      repoById(200, extra),
      // 新しい名前でのリリースの取得。このテストは所有者と名前の記録だけを確かめるため、リリースなしを返す。
      http.get('https://api.github.com/repos/:owner/:repo/releases/latest', ({ params }) =>
        params.owner === OWNER && params.repo === REPO ? undefined : new HttpResponse(null, { status: 404 }),
      ),
      ...githubHandlers(),
      ...imageHandlers(),
      ...downloadHandlers(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    await runCron(env);
    network.resetHandlers();
  };
  const plugin = () =>
    env.DB.prepare('SELECT owner, repo, owner_changed_at FROM plugins').first<{
      owner: string;
      repo: string;
      owner_changed_at: string | null;
    }>();

  it('所有者が変わったら日時を記録し、旧い名前を大文字と小文字を保って残す', async () => {
    await registerFixture();
    await sync({ owner: { login: 'NewOwner' } });
    const row = await plugin();
    expect(row?.owner).toBe('NewOwner');
    expect(row?.owner_changed_at).not.toBeNull();
    const alias = await env.DB.prepare('SELECT alias, name FROM plugin_aliases').first<{
      alias: string;
      name: string;
    }>();
    expect(alias).toEqual({ alias: `${OWNER}/${REPO}`.toLowerCase(), name: `${OWNER}/${REPO}` });
  });

  it('名前を変えたら、保存済みの古い版のリリースとダウンロードの URL を新しい名前にする', async () => {
    await registerFixture();
    await sync({ owner: { login: 'NewOwner' }, name: 'Renamed-Plugin' });
    const urls = await env.DB.prepare(
      'SELECT r.html_url, a.download_url FROM releases r JOIN assets a ON a.release_id = r.github_release_id',
    ).all<{ html_url: string; download_url: string }>();
    expect(urls.results.length).toBeGreaterThan(0);
    for (const row of urls.results) {
      expect(row.html_url).toMatch(/^https:\/\/github\.com\/NewOwner\/Renamed-Plugin\/releases\/tag\/v1\.1\.0$/);
      expect(row.download_url).toMatch(
        /^https:\/\/github\.com\/NewOwner\/Renamed-Plugin\/releases\/download\/v1\.1\.0\//,
      );
    }
  });

  it('同じ所有者のままの名前の変更では、所有者の変更として記録しない', async () => {
    await registerFixture();
    await sync({ name: 'Renamed-Plugin' });
    const row = await plugin();
    expect(row?.repo).toBe('Renamed-Plugin');
    expect(row?.owner_changed_at).toBeNull();
  });
});

describe('runCron の概要の更新', () => {
  it('description が変われば概要を更新し、空なら登録時の概要を残す', async () => {
    await registerFixture();
    // 掲載中のプラグインにする。確認待ちの版がある間は概要を追従させないため。
    await markListable(env.DB);
    await recordListings(env, new Budget());
    const summary = () =>
      env.DB.prepare('SELECT summary FROM plugins')
        .first<{ summary: string }>()
        .then((row) => row?.summary);
    const run = async (description: string) => {
      await env.DB.prepare("UPDATE plugins SET last_synced_at = '2000-01-01T00:00:00Z'").run();
      network.use(
        repoById(200, { description }),
        ...githubHandlers(),
        ...imageHandlers(),
        ...downloadHandlers(),
        ...scannerHandlers({ mb: 0 }),
        ...releaseCheckHandlers(),
      );
      await runCron(env);
      network.resetHandlers();
    };
    await run('A new pitch shift filter');
    expect(await summary()).toBe('A new pitch shift filter');
    await run('');
    expect(await summary()).toBe('A new pitch shift filter');
  });

  it('確認待ちの版がある間は、description を概要に追従させない', async () => {
    await registerFixture();
    await env.DB.prepare("UPDATE plugins SET last_synced_at = '2000-01-01T00:00:00Z'").run();
    network.use(
      repoById(200, { description: 'Download the fixed build from https://example.com' }),
      ...githubHandlers(),
      ...imageHandlers(),
      ...downloadHandlers(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    await runCron(env);
    const row = await env.DB.prepare('SELECT summary FROM plugins').first<{ summary: string }>();
    expect(row?.summary).not.toContain('example.com');
  });
});

describe('掲載の期間と止めた版の記録', () => {
  it('掲載した配布物の期間を記録し、マルウェアを検出したら版を記録して期間を閉じる。プラグインを消しても記録は残す', async () => {
    await registerFixture();
    await markListable(env.DB);
    await recordListings(env, new Budget());
    // 記録するのは案内する zip だけで、案内しない tar.gz は記録しない。
    const open = await env.DB.prepare('SELECT asset_name FROM listing_periods WHERE ended_at IS NULL').all();
    expect(open.results).toEqual([{ asset_name: 'audio-fixture-pitchshift-1.1.0-windows-x64.zip' }]);

    await env.DB.prepare("UPDATE scans SET result = 'malicious'").run();
    await recordListings(env, new Budget());
    expect(await env.DB.prepare('SELECT reason FROM release_suspensions').first('reason')).toBe('malicious');
    expect(await env.DB.prepare('SELECT count(*) AS n FROM listing_periods WHERE ended_at IS NULL').first('n')).toBe(0);

    await env.DB.prepare('DELETE FROM plugins').run();
    expect(await env.DB.prepare('SELECT count(*) AS n FROM listing_periods').first('n')).toBe(1);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM release_suspensions').first('n')).toBe(1);
  });
});

describe('新しい版の検査の無料枠の待ち', () => {
  it('無料枠が戻る時刻までは、レビューだけが残った版を選ばず、試行の回数も進めない', async () => {
    await registerFixture();
    await env.DB.prepare(
      "UPDATE release_checks SET config_state = 'missing', diff_state = 'skipped', review_wait_until = '2999-01-01T00:00:00Z'",
    ).run();
    expect(await runReleaseChecks(env, new Budget())).toBe(0);
    expect(await env.DB.prepare('SELECT review_attempts FROM release_checks').first('review_attempts')).toBe(0);
  });
});

describe('新しい版の検査の通信の検出の待ち', () => {
  const attempts = () => env.DB.prepare('SELECT review_attempts FROM release_checks').first('review_attempts');
  const onlyReviewLeft = () =>
    env.DB.prepare(
      "UPDATE release_checks SET config_state = 'missing', diff_state = 'skipped', license_state = 'passed'",
    ).run();

  it('通信の検出の結果が届くまでは、レビューだけが残った版を選ばない', async () => {
    await registerFixture();
    await onlyReviewLeft();
    await env.DB.prepare(`UPDATE releases SET published_at = '${new Date().toISOString()}'`).run();
    expect(await runReleaseChecks(env, new Budget())).toBe(0);
    expect(await attempts()).toBe(0);
  });

  // verify.yaml が起動しなくても、新しい版のレビューが止まり続けないことを確かめる。
  it('版の公開から 6 時間を過ぎたら、検出の結果なしでレビューする', async () => {
    await registerFixture();
    await onlyReviewLeft();
    const old = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(`UPDATE releases SET published_at = '${old}'`).run();
    network.use(...releaseCheckHandlers());
    await runReleaseChecks(env, new Budget());
    // テストの環境には Workers AI が無いため、レビューは失敗として 1 回に数える。レビューに進んだことの確認に使う。
    expect(await attempts()).toBe(1);
  });

  it('検出の結果が届いた版は、公開の直後でもレビューする', async () => {
    await registerFixture();
    await onlyReviewLeft();
    await env.DB.prepare(
      `UPDATE release_checks SET network_state = 'done', network_hits = '{"hits":[],"truncated":false}'`,
    ).run();
    await env.DB.prepare(`UPDATE releases SET published_at = '${new Date().toISOString()}'`).run();
    network.use(...releaseCheckHandlers());
    expect(await runReleaseChecks(env, new Budget())).toBe(1);
    expect(await attempts()).toBe(1);
  });
});

describe('新しい版の検査の版のコミットの位置', () => {
  const check = () =>
    env.DB.prepare('SELECT diff_state, diff_hits FROM release_checks').first<{
      diff_state: string;
      diff_hits: string | null;
    }>();
  const compare = (respond: () => Response, urls: string[]) =>
    http.get('https://api.github.com/repos/:owner/:repo/compare/:range', ({ request }) => {
      urls.push(request.url);
      return respond();
    });

  async function runFirstVersionCheck(handler: ReturnType<typeof http.get>): Promise<void> {
    await registerFixture();
    await env.DB.prepare("UPDATE release_checks SET config_state = 'missing', license_state = 'passed'").run();
    await env.DB.prepare(`UPDATE releases SET published_at = '${new Date().toISOString()}'`).run();
    network.use(handler, ...releaseCheckHandlers());
    await runReleaseChecks(env, new Budget());
  }

  // 書き込みの権限で既定のブランチ以外のコミットに付けたタグは、掲載中の版が無くても管理者の確認に回す。
  it('版のコミットが既定のブランチに無ければ、掲載中の版が無くても held にし、タグの名前ではなくコミットで比べる', async () => {
    const urls: string[] = [];
    await runFirstVersionCheck(compare(() => HttpResponse.json({ status: 'ahead', commits: [], files: [] }), urls));
    const row = await check();
    expect(row?.diff_state).toBe('held');
    expect(JSON.parse(row?.diff_hits ?? '[]')).toEqual([{ rule: 'tag-not-on-default-branch' }]);
    const sha = await env.DB.prepare('SELECT commit_sha FROM releases').first<string>('commit_sha');
    expect(urls).toEqual([expect.stringContaining(`/compare/HEAD...${sha}`)]);
  });

  it('比較の応答が上限を超えたら、既定のブランチに無いものとして held にする', async () => {
    const large = JSON.stringify({ status: 'behind', files: [{ patch: 'x'.repeat(70 * 1024) }] });
    await runFirstVersionCheck(
      compare(() => new HttpResponse(large, { headers: { 'Content-Type': 'application/json' } }), []),
    );
    expect((await check())?.diff_state).toBe('held');
  });

  it('版のコミットが既定のブランチにあれば、掲載中の版が無い版は skipped にする', async () => {
    await runFirstVersionCheck(compare(() => HttpResponse.json({ status: 'behind', commits: [], files: [] }), []));
    expect(await check()).toEqual({ diff_state: 'skipped', diff_hits: '[]' });
  });

  it('比較を取得できなければ error にし、確認待ちとして扱う', async () => {
    await runFirstVersionCheck(compare(() => new HttpResponse(null, { status: 404 }), []));
    expect((await check())?.diff_state).toBe('error');
  });
});

describe('検証のワークフローの起動', () => {
  const DISPATCH_URL =
    'https://api.github.com/repos/AllegroMoltoV/audio-plugin-soko-kun/actions/workflows/verify.yaml/dispatches';
  const MACOS_DISPATCH_URL =
    'https://api.github.com/repos/AllegroMoltoV/audio-plugin-soko-kun/actions/workflows/macos-verify.yaml/dispatches';
  const withToken = { ...env, GITHUB_DISPATCH_TOKEN: 'test-dispatch-token' };

  it('検証待ちの配布物があれば、同期が止まっても main を指定して起動する', async () => {
    await registerFixture();
    const bodies: unknown[] = [];
    network.use(
      await githubOutage(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
      http.post(DISPATCH_URL, async ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer test-dispatch-token');
        bodies.push(await request.json());
        return HttpResponse.json({ workflow_run_id: 1 });
      }),
    );
    const report = await runCron(withToken);
    expect(report.stoppedBy).toBe('github_unavailable');
    expect(report.verifyDispatch).toBe('dispatched');
    expect(bodies).toEqual([{ ref: 'main' }]);
  });

  it('ほかの処理が外部呼び出しの予算を使い切っても、取り分けた 2 件で 2 つのワークフローを起動する', async () => {
    await registerFixture();
    // 中身の検査で macOS 向けのバンドルを検出した配布物があり、macOS の判定も待っている
    await env.DB.prepare("INSERT INTO macos_signing_checks (github_asset_id, result) VALUES (8001, 'pending')").run();
    const dispatched: string[] = [];
    network.use(
      repoById(),
      ...githubHandlers(),
      ...scannerHandlers({ mb: 0 }),
      http.post(DISPATCH_URL, () => {
        dispatched.push('verify.yaml');
        return HttpResponse.json({ workflow_run_id: 1 });
      }),
      http.post(MACOS_DISPATCH_URL, async ({ request }) => {
        expect(await request.json()).toEqual({ ref: 'main' });
        dispatched.push('macos-verify.yaml');
        return HttpResponse.json({ workflow_run_id: 2 });
      }),
    );
    const budget = new Budget();
    for (let i = 0; i < 45 - DISPATCH_RESERVE; i += 1) budget.takeSubrequest();
    const report = await runCron(withToken, budget);
    expect(report.verifyDispatch).toBe('dispatched');
    expect(report.macosVerifyDispatch).toBe('dispatched');
    expect(dispatched).toEqual(['verify.yaml', 'macos-verify.yaml']);
    expect(report.subrequests).toBe(45);
  });

  it('macOS の判定を待つ配布物が無ければ macos-verify.yaml を起動せず、試行を使い切った error も待ちに数えない', async () => {
    await registerFixture();
    await env.DB.prepare(
      "INSERT INTO macos_signing_checks (github_asset_id, result, attempts) VALUES (8001, 'error', 3)",
    ).run();
    network.use(
      await githubOutage(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
      http.post(DISPATCH_URL, () => HttpResponse.json({ workflow_run_id: 1 })),
    );
    const report = await runCron(withToken);
    expect(report.macosVerifyDispatch).toBe('skipped_no_pending');
  });

  it('検証待ちが無ければ起動しない', async () => {
    await registerFixture();
    await env.DB.prepare("UPDATE attestation_checks SET result = 'passed'").run();
    // 中身の検査を待つアーカイブも検証待ちに数える
    await env.DB.prepare("UPDATE content_checks SET result = 'passed'").run();
    await env.DB.prepare("UPDATE release_checks SET network_state = 'done'").run();
    network.use(await githubOutage(), ...scannerHandlers({ mb: 0 }), ...releaseCheckHandlers());
    const report = await runCron(withToken);
    expect(report.verifyDispatch).toBe('skipped_no_pending');
  });

  it('配布物の検証が済んでも、通信の検出を待つ版があれば起動する', async () => {
    await registerFixture();
    await env.DB.prepare("UPDATE attestation_checks SET result = 'passed'").run();
    await env.DB.prepare("UPDATE content_checks SET result = 'passed'").run();
    network.use(
      await githubOutage(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
      http.post(DISPATCH_URL, () => HttpResponse.json({ workflow_run_id: 1 })),
    );
    const report = await runCron(withToken);
    expect(report.verifyDispatch).toBe('dispatched');
  });

  it('トークンが拒否されても定期処理は最後まで進み、失敗を返す', async () => {
    await registerFixture();
    network.use(
      await githubOutage(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
      http.post(DISPATCH_URL, () => new HttpResponse(null, { status: 401 })),
    );
    const report = await runCron(withToken);
    expect(report.verifyDispatch).toBe('failed_401');
  });
});

// 同期で受けたリリースの応答の扱い (docs/design/testing.md の C03・C09・C11)。
describe('runCron の同期で保存するリリース', () => {
  const NEW_ZIP_DIGEST = `sha256:${'a7'.repeat(32)}`;
  const asset = (id: number, name: string, digest: string | null) => ({
    id,
    name,
    size: 1,
    digest,
    browser_download_url: `https://github.com/${OWNER}/${REPO}/releases/download/x/${name}`,
  });
  // 登録済みの版より新しい最新のリリースを返す。extra でタグ・配布物・immutable を差し替える。
  const latest = (extra: Record<string, unknown>) => [
    http.get(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, () =>
      HttpResponse.json(
        {
          id: 7002,
          tag_name: 'v1.2.0',
          name: 'v1.2.0',
          draft: false,
          prerelease: false,
          published_at: '2026-11-08T00:00:00Z',
          html_url: `https://github.com/${OWNER}/${REPO}/releases/tag/v1.2.0`,
          immutable: true,
          assets: [asset(8101, 'x-windows-x64.zip', NEW_ZIP_DIGEST)],
          ...extra,
        },
        { headers: { ETag: '"etag-2"' } },
      ),
    ),
    // 保存しないはずのリリースでも、守りが外れたときに未定義の呼び出しで落ちず、保存の有無で判定できるようにする。
    http.get(`https://api.github.com/repos/${OWNER}/${REPO}/commits/refs/tags/*`, () =>
      HttpResponse.json({ sha: 'b'.repeat(40) }),
    ),
  ];
  const sync = async (extra: Record<string, unknown>) => {
    await registerFixture();
    network.use(
      repoById(),
      ...latest(extra),
      ...imageHandlers(),
      ...downloadHandlers(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    const report = await runCron(env);
    expect(report.synced).toBe(1);
  };
  const release7002 = () =>
    env.DB.prepare('SELECT tag FROM releases WHERE github_release_id = 7002').first<{ tag: string }>();

  it('C03 GitHub でリポジトリが非公開になったら掲載終了にする', async () => {
    await registerFixture();
    network.use(
      repoById(200, { private: true }),
      ...githubHandlers(),
      ...imageHandlers(),
      ...downloadHandlers(),
      ...scannerHandlers({ mb: 0 }),
      ...releaseCheckHandlers(),
    );
    await runCron(env);
    const row = await env.DB.prepare('SELECT removed FROM plugins').first<{ removed: number }>();
    expect(row?.removed).toBe(1);
  });

  it('C09 タグ名が規則に合わないリリースは、配布物ごと保存しない', async () => {
    await sync({ tag_name: 'release/1.2.0' });
    expect(await release7002()).toBeNull();
    expect(await env.DB.prepare('SELECT count(*) AS n FROM assets WHERE github_asset_id = 8101').first('n')).toBe(0);
  });

  it('C09 digest の無い配布物は保存せず、同じリリースの digest のある配布物だけを保存する', async () => {
    await sync({
      assets: [
        asset(8101, 'x-windows-x64.zip', NEW_ZIP_DIGEST),
        asset(8102, 'x-macos.zip', null),
        asset(8103, 'x-linux-x64.zip', `md5:${'0'.repeat(32)}`),
      ],
    });
    expect(await release7002()).toEqual({ tag: 'v1.2.0' });
    const { results } = await env.DB.prepare(
      'SELECT github_asset_id FROM assets WHERE release_id = 7002 ORDER BY github_asset_id',
    ).all();
    expect(results).toEqual([{ github_asset_id: 8101 }]);
    // 保存しない配布物には、照会の行も作らない。
    expect(await env.DB.prepare('SELECT count(*) AS n FROM scans WHERE digest LIKE ?').bind('md5:%').first('n')).toBe(
      0,
    );
  });

  it('C09 どの配布物にも digest が無いリリースは保存しない', async () => {
    await sync({ assets: [asset(8102, 'x-macos.zip', null)] });
    expect(await release7002()).toBeNull();
  });

  it('C11 リリースの応答に immutable が無ければ、immutable を 0 にする', async () => {
    await sync({ immutable: undefined });
    const row = await env.DB.prepare('SELECT immutable FROM release_checks WHERE github_release_id = 7002').first<{
      immutable: number;
    }>();
    expect(row).toEqual({ immutable: 0 });
  });
});

// MalwareBazaar への照会 (docs/design/testing.md の C08・C10)。
describe('runCron の MalwareBazaar への照会', () => {
  const ZIP_HEX = 'd1'.repeat(32);
  const DAY_MS = 86_400_000;
  const NOW = new Date('2026-11-18T00:00:00.000Z');

  // 照会した SHA-256 を記録する。status が null なら query_status の無い応答を返す。
  const lookups = (hashes: string[], status: string | null = 'hash_not_found') =>
    http.post('https://mb-api.abuse.ch/api/v1/', async ({ request }) => {
      hashes.push(new URLSearchParams(await request.text()).get('hash') ?? '');
      return HttpResponse.json(status === null ? {} : { query_status: status });
    });

  // 掲載中の zip の not_found の照会を、NOW から ageMs だけ前に済ませた状態で、NOW に定期処理を 1 回走らせる。
  async function runWithLastLookup(ageMs: number): Promise<string[]> {
    await registerFixture();
    await markListable(env.DB);
    await recordListings(env, new Budget());
    await env.DB.prepare("UPDATE scans SET result = 'not_found', attempts = 1, scanned_at = ?")
      .bind(new Date(NOW.getTime() - ageMs).toISOString())
      .run();
    const hashes: string[] = [];
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    try {
      network.use(await githubOutage(), lookups(hashes), ...releaseCheckHandlers());
      await runCron(env);
    } finally {
      vi.useRealTimers();
    }
    return hashes;
  }

  // 掲載していない tar.gz は、照会から 7 日を過ぎても照会し直さない。
  it('C08 掲載中の配布物の not_found の照会から 7 日を過ぎたら、照会の対象に選ぶ', async () => {
    expect(await runWithLastLookup(7 * DAY_MS + 1)).toEqual([ZIP_HEX]);
  });

  // 7 日ちょうどは「過ぎた」に当たらないため選ばない。
  it.each([7 * DAY_MS - 1, 7 * DAY_MS])('C08 の対照: not_found の照会から %d ms では、照会し直さない', async (age) => {
    expect(await runWithLastLookup(age)).toEqual([]);
  });

  it('C10 ok と hash_not_found 以外の query_status は error にし、not_found にしない', async () => {
    await registerFixture();
    for (const status of ['illegal_hash', 'unknown_auth_key', 'no_results', null]) {
      await env.DB.prepare("UPDATE scans SET result = 'pending', detail = NULL, attempts = 0, scanned_at = NULL").run();
      network.resetHandlers();
      network.use(await githubOutage(), lookups([], status), ...releaseCheckHandlers());
      await runCron(env);
      const { results } = await env.DB.prepare(
        "SELECT DISTINCT result FROM scans WHERE scanner = 'malwarebazaar'",
      ).all<{
        result: string;
      }>();
      expect(results, String(status)).toEqual([{ result: 'error' }]);
    }
  });

  // 掲載中の配布物の照会を、指定の状態にして NOW に定期処理を 1 回走らせる。
  async function runListedWith(
    state: { result: string; attempts: number },
    handler: ReturnType<typeof http.post>,
    budget = new Budget(),
  ) {
    await env.DB.prepare('UPDATE scans SET result = ?, attempts = ?, scanned_at = ? WHERE digest = ?')
      .bind(state.result, state.attempts, new Date(NOW.getTime() - 8 * DAY_MS).toISOString(), `sha256:${ZIP_HEX}`)
      .run();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    try {
      network.use(await githubOutage(), handler, ...releaseCheckHandlers());
      return await runCron(env, budget);
    } finally {
      vi.useRealTimers();
    }
  }

  const scanRow = () =>
    env.DB.prepare("SELECT result, detail, attempts FROM scans WHERE digest = ? AND scanner = 'malwarebazaar'")
      .bind(`sha256:${ZIP_HEX}`)
      .all<{
        result: string;
        detail: string | null;
        attempts: number;
      }>();
  const answer = (status: string) =>
    http.post('https://mb-api.abuse.ch/api/v1/', () => HttpResponse.json({ query_status: status }));

  it('C17 attempts は続けて失敗した回数。照会し直しの not_found で 0 に戻り、error のあとも次の起動で照会される', async () => {
    await registerFixture();
    await markListable(env.DB);
    await recordListings(env, new Budget());
    // 旧い数え方で積み上がった attempts (照会し直しのたびに 1 ずつ増えていた)。
    await runListedWith({ result: 'not_found', attempts: 7 }, answer('hash_not_found'));
    expect((await scanRow()).results).toEqual([{ result: 'not_found', detail: expect.any(String), attempts: 0 }]);
    // 照会し直しで 1 回 error になっても、次の起動で選ばれて照会される。
    // 直前が not_found なら、旧い数え方で残った attempts (配備の前の行) を引き継がず 1 から数える。
    await runListedWith({ result: 'not_found', attempts: 2 }, answer('unknown_auth_key'));
    expect((await scanRow()).results).toMatchObject([{ result: 'error', attempts: 1 }]);
    const hashes: string[] = [];
    network.resetHandlers();
    network.use(await githubOutage(), lookups(hashes), ...releaseCheckHandlers());
    await runCron(env);
    expect(hashes).toEqual([ZIP_HEX]);
    expect((await scanRow()).results).toMatchObject([{ result: 'not_found', attempts: 0 }]);
  });

  it('C17 の対照: error が続けて上限に達した配布物は、照会の対象に選ばない', async () => {
    await registerFixture();
    await markListable(env.DB);
    const hashes: string[] = [];
    await runListedWith({ result: 'error', attempts: MAX_SCAN_ATTEMPTS }, lookups(hashes));
    expect(hashes).toEqual([]);
    await runListedWith({ result: 'error', attempts: MAX_SCAN_ATTEMPTS - 1 }, lookups(hashes));
    expect(hashes).toEqual([ZIP_HEX]);
  });

  it.each([
    ['fetch の例外', () => HttpResponse.error()],
    ['JSON でない 200 の応答', () => new HttpResponse('<html>maintenance</html>', { status: 200 })],
  ])(
    'C18 照会が %s になっても、その配布物を error・attempts +1 で記録し、ほかの配布物の照会と後段を続ける',
    async (_name, failure) => {
      await registerFixture();
      const other = `sha256:${'f7'.repeat(32)}`;
      await env.DB.prepare("INSERT INTO scans (digest, scanner, result) VALUES (?, 'malwarebazaar', 'pending')")
        .bind(other)
        .run();
      const handler = http.post('https://mb-api.abuse.ch/api/v1/', async ({ request }) => {
        const hash = new URLSearchParams(await request.text()).get('hash');
        return hash === ZIP_HEX ? failure() : HttpResponse.json({ query_status: 'hash_not_found' });
      });
      const report = await runListedWith({ result: 'pending', attempts: 0 }, handler);
      const { results } = await env.DB.prepare(
        "SELECT digest, result, detail, attempts FROM scans WHERE scanner = 'malwarebazaar'",
      ).all<{ digest: string; result: string; detail: string; attempts: number }>();
      const byDigest = new Map(results.map((row) => [row.digest, row]));
      expect(byDigest.get(`sha256:${ZIP_HEX}`)).toMatchObject({ result: 'error', attempts: 1 });
      expect(byDigest.get(`sha256:${ZIP_HEX}`)?.detail.length).toBeLessThanOrEqual(260);
      expect(byDigest.get(other)).toMatchObject({ result: 'not_found', attempts: 0 });
      // 新しい版の検査と同期が走っている (同期は GitHub の障害で止まる)。
      expect(report.releasesChecked).toBeDefined();
      expect(report.stoppedBy).toBe('github_unavailable');
    },
  );

  it('C18 の対照: 429 は試行に数えずに止め、予算の超過は投げ直す', async () => {
    await registerFixture();
    await runListedWith(
      { result: 'pending', attempts: 0 },
      http.post('https://mb-api.abuse.ch/api/v1/', () => new HttpResponse(null, { status: 429 })),
    );
    expect((await scanRow()).results).toMatchObject([{ result: 'pending', attempts: 0 }]);
    // 同じホストへのリダイレクトを続けて、照会の途中で予算を使い切る。
    const redirect = http.post(
      'https://mb-api.abuse.ch/api/v1/',
      () => new HttpResponse(null, { status: 302, headers: { Location: 'https://mb-api.abuse.ch/api/v1/' } }),
    );
    const report = await runListedWith({ result: 'pending', attempts: 0 }, redirect, new Budget(FINAL_RESERVE + 2, 45));
    expect(report.stoppedBy).toBe('budget_subrequest');
    expect((await scanRow()).results).toMatchObject([{ result: 'pending', attempts: 0 }]);
  });
});

// Workers AI の例外とレビューの状態 (docs/design/testing.md の A07)。例外の分類は test/review/quota.test.ts で確かめる。
describe('新しい版の検査の Workers AI の例外', () => {
  it('A07 Workers AI がどの例外を投げても、review_state を done にしない', async () => {
    await registerFixture();
    const thrown: unknown[] = [
      new Error('AiError: 4006: you have used up your daily free allocation of 10,000 neurons'),
      new Error('AiGatewayError: 2045: Spend limit exceeded'),
      new Error('AiError: 3040: Capacity temporarily exceeded'),
      new Error('AiError: 3046: Request timeout'),
      new TypeError('network error'),
      'a thrown string',
      null,
    ];
    for (const error of thrown) {
      await env.DB.prepare(
        `UPDATE release_checks SET config_state = 'missing', diff_state = 'skipped', license_state = 'passed',
           network_state = 'done', network_hits = '{"hits":[],"truncated":false}', review_state = 'pending',
           review_attempts = 0, review_wait_until = NULL`,
      ).run();
      network.resetHandlers();
      network.use(...releaseCheckHandlers());
      const withAi = {
        ...env,
        AI: {
          run: async () => {
            throw error;
          },
        },
      } as unknown as typeof env;
      expect(await runReleaseChecks(withAi, new Budget())).toBe(1);
      const state = await env.DB.prepare('SELECT review_state FROM release_checks').first<string>('review_state');
      expect(state, String(error)).not.toBe('done');
    }
  });
});
