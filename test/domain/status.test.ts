// 掲載状態の算出 (docs/design/testing.md の S01〜S29)。条件を満たさない版と配布物を案内しない境界だけを確かめる。
import { describe, expect, it } from 'vitest';
import {
  type AssetForStatus,
  computeStatus,
  guidedAssets,
  notGuidedReason,
  type ReleaseChecks,
  type ReleaseForStatus,
  type ScanLookup,
  type ScanResult,
} from '../../src/domain/status';

const active = { adminSuspended: false, removed: false };
// 新しい版の条件をすべて満たした検査の行。
const passing: ReleaseChecks = {
  immutable: true,
  licenseState: 'passed',
  diffState: 'passed',
  configState: 'ok',
  reviewState: 'done',
  reviewAttempts: 1,
  reviewSerious: 0,
  adminApproved: false,
};
const passed = { result: 'passed', attempts: 1 } as const;

function archive(name: string, changes: Partial<AssetForStatus> = {}): AssetForStatus {
  return {
    name,
    digest: `sha256:${name}`,
    kind: 'archive',
    attestation: passed,
    content: { ...passed, os: ['windows'] },
    ...changes,
  };
}

function macArchive(name: string, macos: AssetForStatus['macos'], changes: Partial<AssetForStatus> = {}) {
  return archive(name, { content: { ...passed, os: ['macos'] }, macos, ...changes });
}

const signed = (teamId = 'TEAM000001') => ({ ...passed, teamIds: [teamId], reason: null });

function installer(name: string, changes: Partial<AssetForStatus> = {}): AssetForStatus {
  return { name, digest: `sha256:${name}`, kind: 'installer', attestation: passed, ...changes };
}

function release(
  assets: AssetForStatus[],
  changes: Partial<ReleaseChecks> = {},
  extra: Partial<ReleaseForStatus> = {},
): ReleaseForStatus {
  return {
    githubReleaseId: 2,
    publishedAt: '2026-11-01T00:00:00Z',
    assets,
    checks: { ...passing, ...changes },
    ...extra,
  };
}

// 表に無い digest は MalwareBazaar の未収録 (確定) とする。
function lookupFrom(table: Record<string, ScanResult | undefined> = {}): ScanLookup {
  return (digest) => (digest in table ? table[digest] : 'not_found');
}

const listed = (target: ReleaseForStatus, lookup = lookupFrom()) =>
  computeStatus(active, [target], lookup).status === 'listed';
const guidedNames = (target: ReleaseForStatus) => guidedAssets(target.assets).map((asset) => asset.name);

const windows = archive('win.zip');

describe('掲載状態の算出: 中身の検査', () => {
  it('S01: アーカイブの中身の検査が pending か error なら版を掲載しない', () => {
    expect(listed(release([archive('a.zip', { content: { result: 'pending', attempts: 0, os: [] } })]))).toBe(false);
    expect(listed(release([archive('a.zip', { content: { result: 'error', attempts: 1, os: [] } })]))).toBe(false);
  });

  it('S02: 一方のアーカイブが vst2_detected なら、管理者の承認があっても版を掲載しない', () => {
    const vst2 = archive('vst2.zip', { content: { result: 'vst2_detected', attempts: 1, os: ['windows'] } });
    expect(listed(release([vst2, windows]))).toBe(false);
    expect(listed(release([vst2, windows], { adminApproved: true }))).toBe(false);
  });

  it('S03: no_plugin のアーカイブは案内せず、ほかの条件を満たすアーカイブで版を掲載する', () => {
    const source = archive('source.zip', { content: { result: 'no_plugin', attempts: 1, os: [] } });
    const target = release([source, windows]);
    expect(listed(target)).toBe(true);
    expect(guidedNames(target)).toEqual(['win.zip']);
  });

  it('S04: すべてのアーカイブが no_plugin なら版を掲載しない', () => {
    const source = archive('source.zip', { content: { result: 'no_plugin', attempts: 1, os: [] } });
    expect(listed(release([source]))).toBe(false);
  });

  it('S25: 一方のアーカイブが undetermined なら、管理者の承認があっても版を掲載しない', () => {
    const nested = archive('nested.zip', { content: { result: 'undetermined', attempts: 1, os: ['windows'] } });
    expect(listed(release([nested, windows]))).toBe(false);
    expect(listed(release([nested, windows], { adminApproved: true }))).toBe(false);
  });
});

describe('掲載状態の算出: macOS の署名と公証', () => {
  it('S05: macOS のアーカイブが failed なら、版を掲載して Windows のアーカイブだけを案内する', () => {
    const mac = macArchive('mac.zip', { result: 'failed', attempts: 1, teamIds: [], reason: 'not_developer_id' });
    const target = release([windows, mac]);
    expect(listed(target)).toBe(true);
    expect(guidedNames(target)).toEqual(['win.zip']);
  });

  it('S06: macOS のアーカイブだけを持つ版で failed なら版を掲載しない', () => {
    const mac = macArchive('mac.zip', { result: 'failed', attempts: 1, teamIds: [], reason: 'adhoc' });
    expect(listed(release([mac]))).toBe(false);
  });

  it('S07: os に macos を含み macOS の判定の行が無いアーカイブを案内しない', () => {
    const target = release([windows, macArchive('mac.zip', undefined)]);
    expect(guidedNames(target)).toEqual(['win.zip']);
    expect(listed(target)).toBe(false);
  });

  it('S09: macOS のアーカイブの判定が pending か error なら版を掲載しない', () => {
    const pending = macArchive('mac.zip', { result: 'pending', attempts: 0, teamIds: [], reason: null });
    const error = macArchive('mac.zip', { result: 'error', attempts: 1, teamIds: [], reason: 'check_error' });
    expect(listed(release([windows, pending]))).toBe(false);
    expect(listed(release([windows, error]))).toBe(false);
    // 3 回目の error は管理者の確認を待つ。管理者の承認だけでは掲載しない。
    const exhausted = macArchive('mac.zip', { result: 'error', attempts: 3, teamIds: [], reason: 'check_error' });
    expect(listed(release([windows, exhausted], { adminApproved: true }))).toBe(false);
  });

  it('Developer ID の署名があり公証済みと判定されない error は、試行中も公証の欠けとして作者に示す', () => {
    const mac = macArchive('mac.zip', {
      result: 'error',
      attempts: 1,
      teamIds: ['TEAM000001'],
      reason: 'not_notarized',
    });
    expect(notGuidedReason(mac)).toBe('macos_not_notarized');
    expect(notGuidedReason({ ...mac, macos: { ...signed(), result: 'error', reason: 'check_error' } })).toBe(
      'macos_check_error',
    );
  });

  it('案内に使う OS が残らない (macOS の LV2 だけを含む) アーカイブを案内しない', () => {
    const lv2 = archive('lv2.zip', { content: { ...passed, os: [] } });
    expect(notGuidedReason(lv2)).toBe('macos_lv2_not_guided');
    expect(listed(release([lv2]))).toBe(false);
  });

  it('S28: 2 つの macOS のアーカイブの Team ID が食い違えば、管理者の承認があるまで版を掲載しない', () => {
    const target = (approved: boolean) =>
      release([macArchive('a.zip', signed('TEAM000001')), macArchive('b.zip', signed('TEAM000002'))], {
        adminApproved: approved,
      });
    expect(listed(target(false))).toBe(false);
    expect(listed(target(true))).toBe(true);
    // 対照: Team ID がそろえば掲載する。
    expect(listed(release([macArchive('a.zip', signed()), macArchive('b.zip', signed())]))).toBe(true);
  });
});

describe('掲載状態の算出: 検査の行と証明', () => {
  it('S08: 証明か中身の検査の行が無いアーカイブを案内しない', () => {
    const noAttestation = archive('a.zip', { attestation: undefined });
    const noContent = archive('b.zip', { content: undefined });
    expect(guidedNames(release([noAttestation, noContent, windows]))).toEqual(['win.zip']);
    expect(listed(release([noAttestation, windows]))).toBe(false);
    expect(listed(release([noContent, windows]))).toBe(false);
  });

  it('S13: 2 つのアーカイブの一方の証明が failed か pending なら版を掲載しない', () => {
    for (const result of ['failed', 'pending'] as const) {
      expect(listed(release([archive('a.zip', { attestation: { result, attempts: 1 } }), windows]))).toBe(false);
    }
  });

  it('S26: インストーラーの証明が failed か pending なら、アーカイブが条件を満たしても版を掲載しない', () => {
    for (const result of ['failed', 'pending'] as const) {
      expect(listed(release([windows, installer('setup.exe', { attestation: { result, attempts: 1 } })]))).toBe(false);
    }
    expect(listed(release([windows, installer('setup.exe', { attestation: undefined })]))).toBe(false);
  });
});

describe('掲載状態の算出: インストーラーと MalwareBazaar', () => {
  it('S10: インストーラーとアーカイブを含み条件を満たす版は掲載し、インストーラーを案内しない', () => {
    const target = release([windows, installer('setup.exe'), installer('setup.pkg')]);
    expect(listed(target)).toBe(true);
    expect(guidedNames(target)).toEqual(['win.zip']);
  });

  it('S11: インストーラーの MalwareBazaar の結果が pending か error なら版を掲載しない', () => {
    const target = release([windows, installer('setup.exe')]);
    for (const result of ['pending', 'error'] as const) {
      expect(listed(target, lookupFrom({ 'sha256:setup.exe': result }))).toBe(false);
    }
  });

  it('S12: いずれかのリリースのインストーラーか other の配布物が malicious ならプラグインを停止する', () => {
    const other: AssetForStatus = { name: 'notes.txt', digest: 'sha256:notes.txt', kind: 'other', attestation: passed };
    for (const digest of ['sha256:setup.exe', 'sha256:notes.txt']) {
      const result = computeStatus(
        active,
        [release([windows, installer('setup.exe'), other])],
        lookupFrom({ [digest]: 'malicious' }),
      );
      expect(result).toMatchObject({ status: 'suspended', reason: 'malicious' });
    }
  });

  it('S21: MalwareBazaar の結果が pending か error なら版を掲載しない', () => {
    for (const result of ['pending', 'error'] as const) {
      expect(listed(release([windows]), lookupFrom({ 'sha256:win.zip': result }))).toBe(false);
    }
  });

  it('S22: MalwareBazaar の結果の行が無い配布物は確定として扱わない', () => {
    expect(listed(release([windows]), lookupFrom({ 'sha256:win.zip': undefined }))).toBe(false);
  });
});

describe('掲載状態の算出: 宣言ファイル', () => {
  it('S14: 宣言に一致しないアーカイブは、条件を満たしても案内しない', () => {
    const target = release([windows, archive('linux.zip', { content: { ...passed, os: ['linux'] }, declared: false })]);
    expect(guidedNames(target)).toEqual(['win.zip']);
    expect(listed(release([archive('linux.zip', { declared: false })]))).toBe(false);
  });

  it('S15: config_state が mismatch・invalid・no_declared_assets なら版を掲載しない', () => {
    for (const configState of ['mismatch', 'invalid', 'no_declared_assets'] as const) {
      expect(listed(release([windows], { configState }))).toBe(false);
    }
  });

  it('S29: config_state が missing でほかの条件を満たせば版を掲載する', () => {
    expect(listed(release([windows], { configState: 'missing' }))).toBe(true);
  });
});

describe('掲載状態の算出: 管理者の承認', () => {
  it('S16: 管理者の承認では、不変・証明・中身の検査・macOS の判定・宣言ファイル・ライセンスの条件を解かない', () => {
    const approved = { adminApproved: true };
    const unmet: ReleaseForStatus[] = [
      release([windows], { ...approved, immutable: false }),
      release([archive('a.zip', { attestation: { result: 'failed', attempts: 1 } })], approved),
      release([archive('a.zip', { attestation: { result: 'error', attempts: 3 } })], approved),
      release([archive('a.zip', { content: { result: 'error', attempts: 3, os: [] } })], approved),
      release([macArchive('mac.zip', { result: 'pending', attempts: 0, teamIds: [], reason: null })], approved),
      release([windows], { ...approved, configState: 'invalid' }),
      release([windows], { ...approved, licenseState: 'no_license' }),
    ];
    for (const target of unmet) expect(listed(target)).toBe(false);
  });

  it('S17: 乗っ取りの兆候・差分の取得の失敗・重大な指摘・2 回のレビューの失敗は、管理者の承認があるまで掲載しない', () => {
    const holds: Array<Partial<ReleaseChecks>> = [
      { diffState: 'held' },
      { diffState: 'error' },
      { reviewSerious: 1 },
      { reviewState: 'failed', reviewAttempts: 2 },
    ];
    for (const changes of holds) {
      expect(listed(release([windows], changes))).toBe(false);
      expect(listed(release([windows], { ...changes, adminApproved: true }))).toBe(true);
    }
  });

  it('S18: 所有者の変更のあとの新しい版は、管理者の承認があるまで掲載しない', () => {
    expect(listed(release([windows], {}, { ownerChanged: true }))).toBe(false);
    expect(listed(release([windows], { adminApproved: true }, { ownerChanged: true }))).toBe(true);
  });
});

describe('掲載状態の算出: ライセンス', () => {
  it('S27: license_state が passed でなければ、管理者の承認があっても版を掲載しない', () => {
    for (const licenseState of ['pending', 'no_license', 'license_unrecognized', 'license_not_open'] as const) {
      expect(listed(release([windows], { licenseState }))).toBe(false);
      expect(listed(release([windows], { licenseState, adminApproved: true }))).toBe(false);
    }
  });
});

describe('掲載状態の算出: 掲載対象バージョンとプラグインの状態', () => {
  const older = { ...release([archive('old.zip')]), githubReleaseId: 1, publishedAt: '2026-10-01T00:00:00Z' };

  it('S19: 新しい版が検査中なら、検査済みの前の版を掲載対象にする', () => {
    const newer = release([archive('new.zip', { content: { result: 'pending', attempts: 0, os: [] } })]);
    expect(computeStatus(active, [older, newer], lookupFrom())).toEqual({
      status: 'listed',
      listedReleaseId: 1,
      pendingReleaseIds: [2],
    });
  });

  it('S20: 止めた版を掲載対象にせず、前の検査済みの版に戻す', () => {
    const suspended = release([archive('new.zip')], {}, { suspended: true });
    expect(computeStatus(active, [older, suspended], lookupFrom())).toMatchObject({
      status: 'listed',
      listedReleaseId: 1,
    });
  });

  it('S23: 管理停止のプラグインは、すべての条件を満たしても停止', () => {
    const result = computeStatus({ adminSuspended: true, removed: false }, [release([windows])], lookupFrom());
    expect(result).toMatchObject({ status: 'suspended', reason: 'admin' });
  });

  it('S24: 古いリリースの配布物だけが malicious でも、掲載対象の版が条件を満たしていても停止', () => {
    const result = computeStatus(active, [older, release([windows])], lookupFrom({ 'sha256:old.zip': 'malicious' }));
    expect(result).toMatchObject({ status: 'suspended', reason: 'malicious' });
  });
});
