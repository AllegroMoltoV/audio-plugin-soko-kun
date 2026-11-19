// submit の危険側の境界: 他人のリポジトリの登録、不正な入力、重複、乱用、無料プランの上限。
import { env } from 'cloudflare:test';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { NOTICE_TEXT } from '../../src/domain/author';
import { checkPlugin, parseRepositoryUrl, SUBMITS_PER_DAY, submitPlugin } from '../../src/domain/submit';
import type { Env } from '../../src/env';
import { githubHandlers, OWNER, REPO, REPO_ID, releaseCheckHandlers, USER_TOKEN } from '../fixtures/github';
import { network } from '../setup';

const submitter = { githubUserId: 4242, githubToken: USER_TOKEN };
const url = `https://github.com/${OWNER}/${REPO}`;

// D1 の batch の回数と、batch の外で実行した文を記録する。batch には包む前の文を渡す。
function recordingDb(db: D1Database, batches: number[], direct: string[]): D1Database {
  const originals = new WeakMap<object, D1PreparedStatement>();
  const wrap = (statement: D1PreparedStatement, sql: string): D1PreparedStatement => {
    const proxy = new Proxy(statement, {
      get(target, prop) {
        if (prop === 'bind') return (...values: unknown[]) => wrap(target.bind(...values), sql);
        if (prop === 'run' || prop === 'first' || prop === 'all' || prop === 'raw') {
          return (...args: unknown[]) => {
            direct.push(sql);
            return (target[prop] as (...a: unknown[]) => unknown).apply(target, args);
          };
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    originals.set(proxy, statement);
    return proxy;
  };
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'prepare') return (sql: string) => wrap(target.prepare(sql), sql);
      if (prop === 'batch') {
        return (statements: D1PreparedStatement[]) => {
          batches.push(statements.length);
          return target.batch(statements.map((statement) => originals.get(statement) ?? statement));
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

describe('parseRepositoryUrl', () => {
  it.each([
    'http://github.com/allegromoltov/repo',
    'https://github.com.evil.example/allegromoltov/repo',
    'https://evil.example/allegromoltov/repo',
    'https://user:pass@github.com/allegromoltov/repo',
    'https://github.com/allegromoltov/repo/releases',
    'https://github.com/allegromoltov/..',
    'https://github.com/allegromoltov/repo?x=1',
    'https://github.com/-bad/repo',
    'https://github.com/allegromoltov/repo#frag',
  ])('github.com のリポジトリ以外を拒否する: %s', (input) => {
    expect(parseRepositoryUrl(input)).toBeNull();
  });
});

describe('submitPlugin', () => {
  it('管理権限の無い利用者のリポジトリは登録しない', async () => {
    network.use(...githubHandlers({ admin: false }));
    const result = await submitPlugin(env, submitter, url);
    expect(result).toMatchObject({ ok: false, code: 'not_admin' });
    const row = await env.DB.prepare('SELECT count(*) AS n FROM plugins').first<{ n: number }>();
    expect(row?.n).toBe(0);
  });

  it('管理権限の確認には利用者のトークンを使い、それ以外は OAuth App の認証で呼ぶ', async () => {
    const calls: string[] = [];
    network.use(...githubHandlers({}, calls));
    const result = await submitPlugin(env, submitter, url);
    expect(result.ok).toBe(true);
    expect(calls[0]).toBe('repo:Bearer');
    // 無料プランの外部呼び出しの上限 (50 件) に対し、submit は 5 件に配布物ごとの証明の確認を足した件数で済む。
    expect(calls.length).toBeLessThanOrEqual(5 + 2);
  });

  it('不変でないリリース、zip の無いリリース、証明の無い配布物は登録しない', async () => {
    network.use(...githubHandlers({ immutable: false }));
    expect(await submitPlugin(env, submitter, url)).toMatchObject({ ok: false, code: 'not_immutable' });
    network.resetHandlers();
    network.use(...githubHandlers({ noArchive: true }));
    expect(await submitPlugin(env, submitter, url)).toMatchObject({ ok: false, code: 'no_archive' });
    network.resetHandlers();
    network.use(...githubHandlers({ attestation: false }));
    expect(await submitPlugin(env, submitter, url)).toMatchObject({ ok: false, code: 'no_attestation' });
    expect(await env.DB.prepare('SELECT count(*) AS n FROM plugins').first('n')).toBe(0);
  });

  // インストーラーは案内しないが、証明は求める (ADR 0003)。
  it('インストーラーを含むリリースは受け付け、インストーラーにも証明を求める', async () => {
    network.use(...githubHandlers({ installer: true, attestation: '.exe' }));
    expect(await submitPlugin(env, submitter, url)).toMatchObject({ ok: false, code: 'no_attestation' });
    expect(await env.DB.prepare('SELECT count(*) AS n FROM plugins').first('n')).toBe(0);
    network.resetHandlers();
    network.use(...githubHandlers({ installer: true }));
    expect(await submitPlugin(env, submitter, url)).toMatchObject({ ok: true, assetsToScan: 3 });
    const { results } = await env.DB.prepare(
      `SELECT a.kind, t.result AS attestation, c.result AS content FROM assets a
       LEFT JOIN attestation_checks t ON t.github_asset_id = a.github_asset_id
       LEFT JOIN content_checks c ON c.github_asset_id = a.github_asset_id ORDER BY a.github_asset_id`,
    ).all();
    expect(results).toEqual([
      { kind: 'archive', attestation: 'pending', content: 'pending' },
      { kind: 'other', attestation: 'pending', content: null },
      { kind: 'installer', attestation: 'pending', content: null },
    ]);
  });

  // ライセンスは最新のリリースのタグの時点で判定する (docs/design/scanning.md の「ライセンスの判定」)。
  it('タグの時点のライセンスが無い・識別できない・オープンソースでないリポジトリは登録しない', async () => {
    const cases = [
      [null, 'no_license'],
      ['NOASSERTION', 'license_unrecognized'],
      ['CC-BY-NC-4.0', 'license_not_open'],
    ] as const;
    for (const [license, code] of cases) {
      network.resetHandlers();
      network.use(...githubHandlers({ license }));
      expect(await submitPlugin(env, submitter, url)).toMatchObject({ ok: false, code });
    }
    expect(await env.DB.prepare('SELECT count(*) AS n FROM plugins').first('n')).toBe(0);
  });

  it('SPDX で非推奨の識別子でも、合格の集合に入れば登録し、タグが指すコミットの時点のライセンスを記録する', async () => {
    const calls: string[] = [];
    network.use(...githubHandlers({ license: 'GPL-3.0' }, calls));
    expect((await submitPlugin(env, submitter, url)).ok).toBe(true);
    // タグの短い名前は同じ名前のブランチに解決されうるため、タグの完全な参照で解決したコミットで取得する。
    expect(calls).toContain('license:3f2a9c1000000000000000000000000000000000');
    expect(calls).not.toContain('license:v1.1.0');
    const row = await env.DB.prepare(
      'SELECT p.license_spdx AS plugin, c.license_state, c.license_spdx FROM plugins p, release_checks c',
    ).first();
    expect(row).toEqual({ plugin: 'GPL-3.0', license_state: 'passed', license_spdx: 'GPL-3.0' });
  });

  it('同じリポジトリの二重登録を拒否する', async () => {
    network.use(...githubHandlers());
    expect((await submitPlugin(env, submitter, url)).ok).toBe(true);
    const second = await submitPlugin(env, { ...submitter, githubUserId: 5151 }, url);
    expect(second).toMatchObject({ ok: false, code: 'duplicate' });
  });

  // 名前を変えたプラグインの旧い名前を、別のリポジトリに使わせない (派生元の ADR 0015)。
  it('名前を変えたほかのプラグインの旧い名前と同じ名前のリポジトリは登録しない', async () => {
    await env.DB.prepare(
      `INSERT INTO plugins (id, github_repo_id, owner, repo, license_spdx, submitter_github_id, created_at, updated_at, last_synced_at)
       VALUES ('someone/renamed', 999, 'someone', 'renamed', 'MIT', 1, '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')`,
    ).run();
    await env.DB.prepare(
      "INSERT INTO plugin_aliases (alias, plugin_id, created_at, name) VALUES (?, 'someone/renamed', '2026-11-02T00:00:00Z', ?)",
    )
      .bind(`${OWNER}/${REPO}`.toLowerCase(), `${OWNER}/${REPO}`)
      .run();
    network.use(...githubHandlers());
    expect(await submitPlugin(env, submitter, url)).toMatchObject({ ok: false, code: 'name_reserved' });
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM plugins').first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it('digest の無い配布物しかないリリースは登録しない', async () => {
    network.use(...githubHandlers({ release: 'no-digest' }));
    expect(await submitPlugin(env, submitter, url)).toMatchObject({ ok: false, code: 'no_verifiable_asset' });
  });

  it('1 日の登録回数を超えたら、失敗した要求も含めて拒否する', async () => {
    const stamp = new Date().toISOString();
    for (let i = 0; i < SUBMITS_PER_DAY; i += 1) {
      await env.DB.prepare('INSERT INTO submit_log VALUES (?, ?, ?)')
        .bind(submitter.githubUserId, stamp, 'invalid_url')
        .run();
    }
    const result = await submitPlugin(env, submitter, url);
    expect(result).toMatchObject({ ok: false, code: 'rate_limited' });
  });

  it('GitHub の障害では登録せず、トークンを応答に含めない', async () => {
    network.use(
      http.get(`https://api.github.com/repos/${OWNER}/${REPO}`, () => new HttpResponse(null, { status: 503 })),
    );
    const result = await submitPlugin(env, submitter, url);
    expect(result).toMatchObject({ ok: false, code: 'github_unavailable' });
    expect(JSON.stringify(result)).not.toContain(USER_TOKEN);
  });

  // D12: 利用者のトークンは管理権限の確認の 1 件にだけ使い、登録の書き込みは途中で失敗しても部分的に残らない 1 回の batch で行う。
  it('2 件目以降の GitHub の呼び出しに利用者のトークンを使わず、登録の書き込みを 1 回の batch で行う', async () => {
    const authorizations: string[] = [];
    network.use(...githubHandlers());
    // 何も返さないハンドラーは、記録だけをして次のハンドラーに渡す。
    network.use(
      http.all('https://api.github.com/*', ({ request }) => {
        authorizations.push(request.headers.get('Authorization') ?? '');
      }),
    );
    const batches: number[] = [];
    const direct: string[] = [];
    const result = await submitPlugin({ ...env, DB: recordingDb(env.DB, batches, direct) }, submitter, url);
    expect(result.ok).toBe(true);
    expect(authorizations[0]).toBe(`Bearer ${USER_TOKEN}`);
    expect(authorizations.length).toBeGreaterThan(1);
    expect(authorizations.slice(1).filter((value) => value.includes(USER_TOKEN))).toEqual([]);
    expect(batches).toHaveLength(1);
    // batch の外の書き込みは、登録の回数の記録だけ。
    expect(direct.filter((sql) => /^\s*(INSERT|UPDATE|DELETE)/i.test(sql))).toEqual([
      'INSERT INTO submit_log (github_user_id, created_at, outcome) VALUES (?, ?, ?)',
    ]);
  });

  it('登録の書き込みは 1 回の batch で行い、検査を検査待ちで作る', async () => {
    network.use(...githubHandlers());
    const result = await submitPlugin(env, submitter, url);
    expect(result).toMatchObject({ ok: true, status: 'pending', assetsToScan: 2 });
    const scans = await env.DB.prepare("SELECT count(*) AS n FROM scans WHERE result = 'pending'").first<{
      n: number;
    }>();
    expect(scans?.n).toBe(2);
    const plugin = await env.DB.prepare('SELECT github_repo_id FROM plugins').first<{ github_repo_id: number }>();
    expect(plugin?.github_repo_id).toBe(REPO_ID);
  });
});

describe('checkPlugin (確認のモード)', () => {
  // P08: 管理者でない人に、他人のリポジトリのレビューで Workers AI の枠を使わせない。
  it('管理者でない利用者には not_admin を返し、Workers AI を呼ばない', async () => {
    const runs: string[] = [];
    const withAi = {
      ...env,
      AI: {
        run: async (model: string) => {
          runs.push(model);
          return { output: [{ type: 'message', content: [{ text: '{"findings":[]}' }] }] };
        },
      },
    } as unknown as Env;
    network.use(...githubHandlers({ admin: false }), ...releaseCheckHandlers());
    const result = await checkPlugin(withAi, submitter, url);
    expect(result).toMatchObject({ mode: 'check', ok: false, conditions: [{ code: 'not_admin', result: 'failed' }] });
    expect(runs).toEqual([]);
    // 対照: 管理者なら、同じ環境で Workers AI のレビューに進む。
    network.resetHandlers();
    network.use(...githubHandlers(), ...releaseCheckHandlers());
    await checkPlugin(withAi, submitter, url);
    expect(runs.length).toBeGreaterThan(0);
  });

  it('登録せずに条件ごとの結果を返し、1 人 24 時間 5 回を超えたら断る', async () => {
    network.use(...githubHandlers({ immutable: false }), ...releaseCheckHandlers());
    const first = await checkPlugin(env, submitter, url);
    expect(first).toMatchObject({ mode: 'check', ok: false });
    expect((first as { conditions: Array<{ code: string; result: string }> }).conditions).toContainEqual(
      expect.objectContaining({ code: 'not_immutable', result: 'failed' }),
    );
    expect(await env.DB.prepare('SELECT count(*) AS n FROM plugins').first('n')).toBe(0);
    for (let i = 0; i < 4; i += 1) await checkPlugin(env, submitter, url);
    const limited = (await checkPlugin(env, submitter, url)) as { ok: boolean; code: string; resumesAt?: string };
    expect(limited).toMatchObject({ ok: false, code: 'rate_limited' });
    // 作者の AI が次に使える時刻を読めるよう、枠の中で新しい順に 5 番目の利用の 24 時間後を返す。
    const fifth = await env.DB.prepare(
      'SELECT created_at FROM check_log WHERE github_user_id = ? ORDER BY created_at DESC LIMIT 1 OFFSET 4',
    )
      .bind(submitter.githubUserId)
      .first<string>('created_at');
    expect(limited.resumesAt).toBe(new Date(Date.parse(fifth as string) + 24 * 60 * 60 * 1000).toISOString());
  });

  // 不変のリリースは公開の後に直せないため、リリースの前の確認で、残りの条件と直し方が分からないと作者が困る。
  it('リリースの前は、リリースを要る条件を未判定として直し方とともに返す', async () => {
    network.use(...githubHandlers({ release: 'none' }), ...releaseCheckHandlers());
    const result = (await checkPlugin(env, submitter, url)) as {
      conditions: Array<{ code: string; result: string; fix?: string }>;
      config: { result: string };
    };
    expect(result.conditions.find((item) => item.code === 'no_release')?.result).toBe('failed');
    const unchecked = result.conditions.filter(
      (item) => item.result === 'unchecked' && item.code !== 'plugin_content' && item.code !== 'macos_signing',
    );
    expect(unchecked.map((item) => item.code)).toEqual([
      'not_immutable',
      'no_verifiable_asset',
      'unsupported_tag',
      'no_license',
      'no_archive',
      'no_attestation',
    ]);
    expect(unchecked.every((item) => (item.fix ?? '').length > 0)).toBe(true);
    expect(unchecked[0]?.fix).toContain('immutable-releases');
    expect(result.config.result).toBe('missing');
  });

  // 宣言の誤りが不変のリリースの公開の後に分かると、その版を直せない。照合は中身の検査の後のため、形だけを返す。
  it('既定のブランチの宣言ファイルの形を、リリースの前に返す', async () => {
    const declare = (text: string) =>
      network.use(
        http.get(`https://api.github.com/repos/${OWNER}/${REPO}/contents/.audio-soko-kun/config.json`, ({ request }) =>
          new URL(request.url).searchParams.get('ref') === 'HEAD'
            ? HttpResponse.text(text)
            : new HttpResponse(null, { status: 404 }),
        ),
      );
    network.use(...githubHandlers({ release: 'none' }), ...releaseCheckHandlers());
    declare('{"category": "synth"}');
    const invalid = (await checkPlugin(env, submitter, url)) as { config: { result: string; fix?: string } };
    expect(invalid.config).toMatchObject({ result: 'invalid' });
    expect(invalid.config.fix).toContain('"name"');

    // name だけの宣言は正しい (2026-11-15 の試行で、照合の側で invalid になった形)。
    declare('{"name": "White Noise"}');
    const ok = (await checkPlugin(env, submitter, url)) as { config: { result: string } };
    expect(ok.config.result).toBe('ok');
  });

  // R11・X10: 申告の形の誤りは宣言を invalid にせず、固定の文言の notices で返す。作者の書いた URL を応答に含めない。
  it('既定のブランチの supportUrl の形の誤りは、ok と support_url_invalid の notice を返し、URL を応答に含めない', async () => {
    network.use(
      http.get(`https://api.github.com/repos/${OWNER}/${REPO}/contents/.audio-soko-kun/config.json`, () =>
        HttpResponse.text(JSON.stringify({ name: 'Fixture', supportUrl: 'https://evil.example/AUTHOR-URL-MARKER' })),
      ),
      ...githubHandlers({ release: 'none' }),
      ...releaseCheckHandlers(),
    );
    const result = await checkPlugin(env, submitter, url);
    expect((result as { config: unknown }).config).toEqual({
      result: 'ok',
      message: expect.any(String),
      notices: [{ code: 'support_url_invalid', ...NOTICE_TEXT.support_url_invalid, waitsFor: 'author' }],
    });
    expect(JSON.stringify(result)).not.toContain('AUTHOR-URL-MARKER');
  });

  // 既定のブランチの名前は / などを含みうる。名前を API のパスに使うと、確認のモードが結果を返さず内部エラーになる。
  it('既定のブランチの名前に / を含むリポジトリでも、HEAD で読んで結果を返す', async () => {
    const refs: string[] = [];
    network.use(...githubHandlers({ release: 'none', defaultBranch: 'release/1.x' }), ...releaseCheckHandlers());
    network.use(
      http.get(`https://api.github.com/repos/${OWNER}/${REPO}/contents/.audio-soko-kun/config.json`, ({ request }) => {
        refs.push(`config:${new URL(request.url).searchParams.get('ref')}`);
        return new HttpResponse(null, { status: 404 });
      }),
      http.get(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/:ref`, ({ params }) => {
        refs.push(`tree:${params.ref}`);
        return HttpResponse.json({ tree: [], truncated: false });
      }),
    );
    const result = (await checkPlugin(env, submitter, url)) as { mode?: string; config: { result: string } };
    expect(result).toMatchObject({ mode: 'check', config: { result: 'missing' } });
    expect(refs).toEqual(['config:HEAD', 'tree:HEAD']);
  });
});
