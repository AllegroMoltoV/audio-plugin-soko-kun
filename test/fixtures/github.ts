// GitHub API のモック。フィクスチャの利用者名は依頼者のハンドルを使う (software-test スキル)。
import { HttpResponse, http } from 'msw';

export const OWNER = 'allegromoltov';
export const REPO = 'audio-fixture-pitchshift';
export const REPO_ID = 900001;
export const USER_TOKEN = 'gho_fixture_user_token';

export interface RepoFixture {
  admin?: boolean;
  private?: boolean;
  archived?: boolean;
  // タグの時点で GitHub が検出したライセンスの SPDX 識別子。null はライセンスのファイルが無い (404)。
  license?: string | null;
  release?: 'none' | 'no-digest' | 'ok';
  // 不変のリリースでないリリース、exe のインストーラーを含むリリース、zip の無いリリースを作る。
  immutable?: boolean;
  installer?: boolean;
  noArchive?: boolean;
  // false はすべての配布物、文字列はその拡張子で終わる配布物について、証明を返さない。
  attestation?: boolean | string;
}

export function githubHandlers(fixture: RepoFixture = {}, calls: string[] = []) {
  const base = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const track = (label: string) => calls.push(label);
  const asset = (id: number, name: string, digest: string | null) => ({
    id,
    name,
    size: 1_436_099,
    digest,
    browser_download_url: `https://github.com/${OWNER}/${REPO}/releases/download/v1.1.0/${name}`,
  });
  const zipDigest = `sha256:${'d1'.repeat(32)}`;
  const sourceDigest = `sha256:${'e2'.repeat(32)}`;
  const installerDigest = `sha256:${'f3'.repeat(32)}`;
  const names = new Map([
    [zipDigest, 'audio-fixture-pitchshift-1.1.0-windows-x64.zip'],
    [sourceDigest, 'audio-fixture-pitchshift-1.1.0-source.tar.gz'],
    [installerDigest, 'audio-fixture-pitchshift-setup.exe'],
  ]);
  return [
    http.get(base, ({ request }) => {
      track(`repo:${request.headers.get('Authorization')?.split(' ')[0]}`);
      return HttpResponse.json({
        id: REPO_ID,
        name: REPO,
        owner: { login: OWNER },
        private: fixture.private ?? false,
        archived: fixture.archived ?? false,
        description: 'Real-time <script>alert(1)</script> pitch shift effect',
        default_branch: 'main',
        license: { spdx_id: 'GPL-2.0' },
        permissions: { admin: fixture.admin ?? true, pull: true },
      });
    }),
    http.get(`${base}/license`, ({ request }) => {
      track(`license:${new URL(request.url).searchParams.get('ref')}`);
      if (fixture.license === null) return new HttpResponse(null, { status: 404 });
      return HttpResponse.json({ license: { spdx_id: fixture.license ?? 'GPL-3.0' } });
    }),
    http.get(`${base}/releases/latest`, () => {
      track('release');
      if (fixture.release === 'none') return new HttpResponse(null, { status: 404 });
      const withDigest = fixture.release !== 'no-digest';
      return HttpResponse.json(
        {
          id: 7001,
          tag_name: 'v1.1.0',
          name: 'v1.1.0',
          draft: false,
          prerelease: false,
          published_at: '2026-10-20T00:00:00Z',
          html_url: `https://github.com/${OWNER}/${REPO}/releases/tag/v1.1.0`,
          immutable: fixture.immutable ?? true,
          assets: [
            ...(fixture.noArchive ? [] : [asset(8001, names.get(zipDigest) as string, withDigest ? zipDigest : null)]),
            asset(8002, names.get(sourceDigest) as string, withDigest ? sourceDigest : null),
            ...(fixture.installer ? [asset(8003, names.get(installerDigest) as string, installerDigest)] : []),
          ],
        },
        { headers: { ETag: '"etag-1"' } },
      );
    }),
    http.get(`${base}/commits/v1.1.0`, () => {
      track('commit');
      return HttpResponse.json({ sha: '3f2a9c1000000000000000000000000000000000' });
    }),
    http.get(`${base}/attestations/:digest`, ({ params }) => {
      track('attestation');
      const name = names.get(String(params.digest)) ?? '';
      const missing =
        fixture.attestation === false ||
        (typeof fixture.attestation === 'string' && name.endsWith(fixture.attestation));
      if (missing) return new HttpResponse(null, { status: 404 });
      return HttpResponse.json({ attestations: [{ bundle: null, bundle_url: 'https://example.invalid/bundle' }] });
    }),
    http.get(`${base}/readme`, () => {
      track('readme');
      return HttpResponse.text('# Title\n\nA pitch shift effect.\n');
    }),
  ];
}

// 新しい版の検査が読むファイル。個々のテストで上書きしなければ、ライセンスは MIT、ほかはどれも無いものとして 404 を返す。
export function releaseCheckHandlers() {
  const base = 'https://api.github.com/repos/:owner/:repo';
  const missing = () => new HttpResponse(null, { status: 404 });
  return [
    http.get(`${base}/contents/.audio-soko-kun/config.json`, missing),
    http.get(`${base}/license`, () => HttpResponse.json({ license: { spdx_id: 'MIT' } })),
    http.get(`${base}/git/trees/:ref`, () => HttpResponse.json({ tree: [], truncated: false })),
    http.get(`${base}/contents/:file`, missing),
    // 版のコミットの位置は、既定のブランチにあるものとして返す。差分の比較は 404。
    http.get(`${base}/compare/:range`, ({ params }) =>
      String(params.range).startsWith('HEAD...')
        ? HttpResponse.json({ status: 'behind', commits: [], files: [] })
        : missing(),
    ),
    http.get(`${base}/rulesets`, () => HttpResponse.json([])),
  ];
}

// リポジトリの .audio-soko-kun/ に置いた画像。files を渡さなければ、画像の無いリポジトリとして 404 を返す。
export function imageHandlers(files?: Record<string, Uint8Array>, calls: string[] = []) {
  const contents = 'https://api.github.com/repos/:owner/:repo/contents/.audio-soko-kun';
  return [
    http.get(contents, () => {
      calls.push('images:list');
      if (!files) return new HttpResponse(null, { status: 404 });
      return HttpResponse.json(
        Object.entries(files).map(([name, bytes]) => ({
          name,
          type: 'file',
          size: bytes.length,
          sha: `sha-${name}-${bytes.length}`,
        })),
      );
    }),
    http.get(`${contents}/:file`, ({ params }) => {
      calls.push(`images:get:${params.file}`);
      const bytes = files?.[String(params.file)];
      if (!bytes) return new HttpResponse(null, { status: 404 });
      return new HttpResponse(bytes, { headers: { 'Content-Length': String(bytes.length) } });
    }),
  ];
}

// リリースの一覧。ダウンロード数の記録に使う。counts は配布物ごとのダウンロード数。
export function downloadHandlers(counts: number[] = [], calls: string[] = []) {
  return [
    http.get('https://api.github.com/repos/:owner/:repo/releases', () => {
      calls.push('releases:list');
      return HttpResponse.json([
        {
          id: 1,
          tag_name: 'v1.1.0',
          draft: false,
          assets: counts.map((count, index) => ({ id: index, download_count: count })),
        },
        { id: 2, tag_name: 'v9.9.9', draft: true, assets: [{ id: 99, download_count: 1000 }] },
      ]);
    }),
  ];
}
