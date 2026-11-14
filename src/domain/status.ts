// 掲載状態と案内する配布物の算出 (docs/design/data-model.md の「掲載状態の算出規則」)。
// 状態は保存せず、検査結果と管理操作から毎回求める。照会先は MalwareBazaar だけ。
import type { AssetKind, Os } from './metadata';

export type Scanner = 'malwarebazaar';
export type ScanResult = 'pending' | 'malicious' | 'not_found' | 'error';
export type PluginStatus = 'listed' | 'pending' | 'suspended' | 'removed';

export type AttestationResult = 'pending' | 'passed' | 'failed' | 'error';
export type ContentResult = 'pending' | 'passed' | 'no_plugin' | 'vst2_detected' | 'undetermined' | 'error';
export type MacosResult = 'pending' | 'passed' | 'failed' | 'error';
export type LicenseState = 'pending' | 'passed' | 'no_license' | 'license_unrecognized' | 'license_not_open';
export type DiffState = 'pending' | 'passed' | 'held' | 'skipped' | 'error';
export type ConfigState = 'pending' | 'ok' | 'missing' | 'invalid' | 'no_declared_assets' | 'mismatch';
export type ReviewState = 'pending' | 'done' | 'failed';

// レビューは 2 回まで試み、2 回失敗した版は管理者の判断を待つ。
export const MAX_REVIEW_ATTEMPTS = 2;
// 証明の検証・中身の検査・macOS の判定の error は 3 回まで試み、3 回目も error なら管理者が原因を確かめるまで掲載しない。
export const MAX_CHECK_ATTEMPTS = 3;

export interface ReleaseChecks {
  immutable: boolean;
  licenseState: LicenseState;
  diffState: DiffState;
  configState: ConfigState;
  reviewState: ReviewState;
  reviewAttempts: number;
  reviewSerious: number;
  adminApproved: boolean;
}

export interface CheckRow<R> {
  result: R;
  attempts: number;
}

export interface AssetForStatus {
  name: string;
  digest: string;
  kind: AssetKind;
  // 行が無い検査は、どれも結果が出ていないものとして扱う。
  attestation?: CheckRow<AttestationResult>;
  content?: CheckRow<ContentResult> & { os: Os[] };
  macos?: CheckRow<MacosResult> & { teamIds: string[]; reason: string | null };
  // 宣言ファイルの配布物の宣言から外れた配布物は false。宣言が無ければ省く。
  declared?: boolean;
}

export interface ReleaseForStatus {
  githubReleaseId: number;
  publishedAt: string;
  assets: AssetForStatus[];
  // 検査の行が無いリリースは、どの条件も確かめていないものとして掲載しない。
  checks?: ReleaseChecks;
  suspended?: boolean;
  // プラグインの所有者が変わり、管理者がまだ版を承認していない。
  ownerChanged?: boolean;
}

export interface PluginForStatus {
  adminSuspended: boolean;
  removed: boolean;
}

export type ScanLookup = (digest: string, scanner: Scanner) => ScanResult | undefined;

// 掲載を止めている理由。理由コードは docs/design/author-feedback.md の「理由コード」。
export type BlockerCode =
  | 'no_assets'
  | 'scan_pending'
  | 'release_suspended'
  | 'checks_missing'
  | 'not_immutable'
  | 'no_archive'
  | 'attestation_pending'
  | 'attestation_failed'
  | 'content_check_pending'
  | 'no_plugin_detected'
  | 'vst2_detected'
  | 'content_undetermined'
  | 'macos_check_pending'
  | 'no_guided_asset'
  | 'check_retries_exhausted'
  | 'license_pending'
  | 'no_license'
  | 'license_unrecognized'
  | 'license_not_open'
  | 'config_pending'
  | 'config_invalid'
  | 'config_no_declared_assets'
  | 'declaration_mismatch'
  | 'diff_pending'
  | 'diff_held'
  | 'owner_changed'
  | 'diff_error'
  | 'macos_team_id_mismatch'
  | 'review_pending'
  | 'review_failed'
  | 'review_serious';

// 作者が直すもの、管理者の確認を待つもの、本サービスの処理を待つもの。
export type WaitsFor = 'author' | 'admin' | 'system';

export const BLOCKER_WAITS_FOR: Record<BlockerCode, WaitsFor> = {
  no_assets: 'author',
  scan_pending: 'system',
  release_suspended: 'admin',
  checks_missing: 'system',
  not_immutable: 'author',
  no_archive: 'author',
  attestation_pending: 'system',
  attestation_failed: 'author',
  content_check_pending: 'system',
  no_plugin_detected: 'author',
  vst2_detected: 'author',
  content_undetermined: 'author',
  macos_check_pending: 'system',
  no_guided_asset: 'author',
  check_retries_exhausted: 'admin',
  license_pending: 'system',
  no_license: 'author',
  license_unrecognized: 'author',
  license_not_open: 'author',
  config_pending: 'system',
  config_invalid: 'author',
  config_no_declared_assets: 'author',
  declaration_mismatch: 'author',
  diff_pending: 'system',
  diff_held: 'admin',
  owner_changed: 'admin',
  diff_error: 'admin',
  macos_team_id_mismatch: 'admin',
  review_pending: 'system',
  review_failed: 'admin',
  review_serious: 'admin',
};

// 配布物を案内しない理由。インストーラーと案内しない種類の配布物も含む。
export type NotGuidedCode =
  | 'installer_not_guided'
  | 'not_archive'
  | 'attestation_not_passed'
  | 'content_not_passed'
  | 'no_plugin_in_archive'
  | 'macos_check_pending'
  | 'macos_not_signed'
  | 'macos_adhoc'
  | 'macos_not_developer_id'
  | 'macos_not_notarized'
  | 'macos_check_failed'
  | 'macos_check_error'
  | 'not_declared';

export interface StatusResult {
  status: PluginStatus;
  reason?: 'admin' | 'removed' | 'malicious';
  // 検査を通った最新のリリース。掲載中のときだけ値を持つ。
  listedReleaseId?: number;
  // 掲載対象より新しく、条件を満たしていないリリース。作者向けの表示にだけ使う。
  pendingReleaseIds: number[];
}

const includesMacos = (asset: AssetForStatus) => asset.content?.os.includes('macos') === true;

// 配布物を案内しない理由。null なら案内する。行が無い検査を passed と扱わない。
export function notGuidedReason(asset: AssetForStatus): NotGuidedCode | null {
  if (asset.kind === 'installer') return 'installer_not_guided';
  if (asset.kind !== 'archive') return 'not_archive';
  if (asset.content?.result === 'no_plugin') return 'no_plugin_in_archive';
  if (asset.content?.result !== 'passed') return 'content_not_passed';
  if (asset.attestation?.result !== 'passed') return 'attestation_not_passed';
  if (includesMacos(asset) && asset.macos?.result !== 'passed') {
    if (asset.macos?.result === 'failed') {
      const reason = asset.macos.reason;
      if (
        reason === 'not_signed' ||
        reason === 'adhoc' ||
        reason === 'not_developer_id' ||
        reason === 'not_notarized'
      ) {
        return `macos_${reason}`;
      }
      return 'macos_check_failed';
    }
    return asset.macos?.result === 'error' ? 'macos_check_error' : 'macos_check_pending';
  }
  if (asset.declared === false) return 'not_declared';
  return null;
}

export function guidedAssets<T extends AssetForStatus>(assets: T[]): T[] {
  return assets.filter((asset) => notGuidedReason(asset) === null);
}

// error が試行の上限に達した検査。自動ではやり直さないため、管理者が確かめるまで掲載しない。
function exhausted(row: CheckRow<string> | undefined): boolean {
  return row?.result === 'error' && row.attempts >= MAX_CHECK_ATTEMPTS;
}

// 結果が出ていない検査。行が無いものと、試行の上限に達していない error を含む。
function unsettled(row: CheckRow<string> | undefined): boolean {
  return !row || row.result === 'pending' || (row.result === 'error' && row.attempts < MAX_CHECK_ATTEMPTS);
}

const LICENSE_BLOCKER: Record<LicenseState, BlockerCode | null> = {
  pending: 'license_pending',
  passed: null,
  no_license: 'no_license',
  license_unrecognized: 'license_unrecognized',
  license_not_open: 'license_not_open',
};

// 案内する配布物が無い理由を、ほかの理由で既に示しているか。
const EXPLAINS_NO_GUIDED: ReadonlySet<BlockerCode> = new Set<BlockerCode>([
  'no_assets',
  'no_archive',
  'attestation_pending',
  'attestation_failed',
  'content_check_pending',
  'no_plugin_detected',
  'vst2_detected',
  'content_undetermined',
  'macos_check_pending',
  'check_retries_exhausted',
  'config_no_declared_assets',
]);

function teamIdsOf(asset: AssetForStatus): string[] {
  return includesMacos(asset) ? (asset.macos?.teamIds ?? []) : [];
}

// リリースの掲載を止めている理由を、すべて挙げる。空なら掲載できる。
// 管理者の承認で解けるのは、乗っ取りの兆候・差分の取得の失敗・レビュー・所有者の変更・Team ID の食い違いだけ。
export function releaseBlockers(release: ReleaseForStatus, lookup: ScanLookup): BlockerCode[] {
  const blockers: BlockerCode[] = [];
  const assets = release.assets;
  if (assets.length === 0) blockers.push('no_assets');
  // MalwareBazaar は既知のマルウェアだけを収録するため、未登録は既知のマルウェアに該当しないことを意味する。
  // インストーラーと案内しない配布物も含め、すべての配布物の結果が確定するまで掲載しない。
  if (!assets.every((asset) => lookup(asset.digest, 'malwarebazaar') === 'not_found')) {
    blockers.push('scan_pending');
  }
  if (release.suspended) blockers.push('release_suspended');
  const checks = release.checks;
  if (!checks) {
    blockers.push('checks_missing');
    return blockers;
  }

  if (!checks.immutable) blockers.push('not_immutable');

  // 証明はインストーラーと案内しない配布物にも求める (ADR 0003)。
  const attestations = assets.map((asset) => asset.attestation);
  if (attestations.some((row) => row?.result === 'failed')) blockers.push('attestation_failed');
  else if (attestations.some(unsettled)) blockers.push('attestation_pending');

  const archives = assets.filter((asset) => asset.kind === 'archive');
  if (assets.length > 0 && archives.length === 0) blockers.push('no_archive');
  const contents = archives.map((asset) => asset.content);
  if (contents.some(unsettled)) blockers.push('content_check_pending');
  if (contents.some((row) => row?.result === 'vst2_detected')) blockers.push('vst2_detected');
  if (contents.some((row) => row?.result === 'undetermined')) blockers.push('content_undetermined');
  if (archives.length > 0 && contents.every((row) => row?.result === 'no_plugin')) blockers.push('no_plugin_detected');
  const macosArchives = archives.filter(includesMacos);
  if (macosArchives.some((asset) => unsettled(asset.macos))) blockers.push('macos_check_pending');
  if (
    attestations.some(exhausted) ||
    contents.some(exhausted) ||
    macosArchives.some((asset) => exhausted(asset.macos))
  ) {
    blockers.push('check_retries_exhausted');
  }

  const license = LICENSE_BLOCKER[checks.licenseState];
  if (license) blockers.push(license);

  if (checks.configState === 'pending') blockers.push('config_pending');
  if (checks.configState === 'invalid') blockers.push('config_invalid');
  if (checks.configState === 'no_declared_assets') blockers.push('config_no_declared_assets');
  if (checks.configState === 'mismatch') blockers.push('declaration_mismatch');

  if (guidedAssets(assets).length === 0 && !blockers.some((code) => EXPLAINS_NO_GUIDED.has(code))) {
    blockers.push('no_guided_asset');
  }

  if (!checks.adminApproved) {
    if (checks.diffState === 'pending') blockers.push('diff_pending');
    if (checks.diffState === 'held') blockers.push('diff_held');
    if (release.ownerChanged) blockers.push('owner_changed');
    if (checks.diffState === 'error') blockers.push('diff_error');
    if (new Set(macosArchives.flatMap(teamIdsOf)).size > 1) blockers.push('macos_team_id_mismatch');
    if (checks.reviewState === 'pending') blockers.push('review_pending');
    if (checks.reviewState === 'failed') {
      blockers.push(checks.reviewAttempts >= MAX_REVIEW_ATTEMPTS ? 'review_failed' : 'review_pending');
    }
    if (checks.reviewState === 'done' && checks.reviewSerious > 0) blockers.push('review_serious');
  }
  return blockers;
}

export function computeStatus(plugin: PluginForStatus, releases: ReleaseForStatus[], lookup: ScanLookup): StatusResult {
  if (plugin.adminSuspended) return { status: 'suspended', reason: 'admin', pendingReleaseIds: [] };
  if (plugin.removed) return { status: 'removed', reason: 'removed', pendingReleaseIds: [] };

  // インストーラーと案内しない配布物を含め、どのリリースのどの配布物でもマルウェアを検出したら止める。
  const hasMalicious = releases.some((release) =>
    release.assets.some((asset) => lookup(asset.digest, 'malwarebazaar') === 'malicious'),
  );
  if (hasMalicious) return { status: 'suspended', reason: 'malicious', pendingReleaseIds: [] };

  const newestFirst = [...releases].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const pendingReleaseIds: number[] = [];
  for (const release of newestFirst) {
    if (releaseBlockers(release, lookup).length === 0) {
      return { status: 'listed', listedReleaseId: release.githubReleaseId, pendingReleaseIds };
    }
    pendingReleaseIds.push(release.githubReleaseId);
  }
  return { status: 'pending', pendingReleaseIds };
}
