// 管理者による掲載停止と再開。管理画面は作らず、wrangler d1 execute で D1 を直接更新する。
// 使い方:
//   npm run admin -- suspend <owner/repo> "<理由>" [--remote]
//   npm run admin -- resume <owner/repo> [--remote]
//   npm run admin -- show <owner/repo> [--remote]
//   npm run admin -- set-category <owner/repo> <category> [--remote]
//   npm run admin -- hide-images <owner/repo> [--remote]
//   npm run admin -- show-images <owner/repo> [--remote]
//   npm run admin -- pending [--remote]
//   npm run admin -- approve-release <owner/repo> <tag> [--remote]
//   npm run admin -- suspend-release <owner/repo> <tag> "<告知の文>" [--remote]
//   npm run admin -- retry-checks <owner/repo> <tag> [--remote]
// --remote を付けないときはローカルの D1 を更新する。<owner/repo> は現在の名前と登録したときの名前のどちらでもよい。
// 手順と表示の意味は docs/operations/suspend.md と docs/operations/incident-response.md に記載している。
import { spawnSync } from 'node:child_process';

const ID = /^[a-z0-9-]{1,39}\/[a-z0-9._-]{1,100}$/;
const REASON = /^[^\p{Cc}]{1,200}$/u;
const TAG = /^[A-Za-z0-9._-]{1,100}$/;
const NOTE = /^[^\p{Cc}]{1,500}$/u;
const CATEGORIES = ['instrument', 'effect', 'analyzer', 'midi', 'utility'];
// 試行の上限。src/domain/status.ts の MAX_CHECK_ATTEMPTS (証明の検証・中身の検査・macOS の判定) と MAX_REVIEW_ATTEMPTS に合わせる。
const MAX_CHECK_ATTEMPTS = 3;
const MAX_REVIEW_ATTEMPTS = 2;

function fail(message) {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const remote = args.includes('--remote');
const [command, rawId, reason, extra] = args.filter((a) => a !== '--remote');
const USAGE =
  'usage: admin <suspend|resume|show|set-category|hide-images|show-images> <owner/repo> [reason|category] [--remote]\n' +
  '       admin pending [--remote]\n' +
  '       admin approve-release <owner/repo> <tag> [--remote]\n' +
  '       admin suspend-release <owner/repo> <tag> "<note>" [--remote]\n' +
  '       admin retry-checks <owner/repo> <tag> [--remote]';
if (!command || (command !== 'pending' && !rawId)) fail(USAGE);

const id = (rawId ?? '').toLowerCase();
if (command !== 'pending' && !ID.test(id)) fail(`invalid plugin id: ${rawId}`);
// id と理由は検証済みの値だけを SQL に入れ、単引用符は二重にして文字列から抜け出せないようにする。
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const now = new Date().toISOString();
// 内部のプラグイン ID。名前を変えたプラグインも、現在の owner/repo で指定できるようにする。
const PID = `(SELECT id FROM plugins WHERE id = ${quote(id)} OR lower(owner || '/' || repo) = ${quote(id)} LIMIT 1)`;
const releaseOf = (tag) => `(SELECT github_release_id FROM releases WHERE plugin_id = ${PID} AND tag = ${quote(tag)})`;

let sql;
if (command === 'suspend') {
  if (!reason || !REASON.test(reason)) fail('a reason (1-200 characters, no control characters) is required');
  sql = `UPDATE plugins SET admin_suspended = 1, suspended_reason = ${quote(reason)}, updated_at = ${quote(now)} WHERE id = ${PID}; SELECT id, admin_suspended, suspended_reason FROM plugins WHERE id = ${PID};`;
} else if (command === 'resume') {
  // 再開は管理者の停止を解くだけで、掲載の可否は検査結果から改めて算出される。
  sql = `UPDATE plugins SET admin_suspended = 0, suspended_reason = NULL, updated_at = ${quote(now)} WHERE id = ${PID}; SELECT id, admin_suspended FROM plugins WHERE id = ${PID};`;
} else if (command === 'set-category') {
  // 自動の推定が誤っていたカテゴリを、管理者が直す。
  if (!CATEGORIES.includes(reason)) fail(`category must be one of: ${CATEGORIES.join(', ')}`);
  sql = `UPDATE plugins SET category = ${quote(reason)}, updated_at = ${quote(now)} WHERE id = ${PID}; SELECT id, category FROM plugins WHERE id = ${PID};`;
} else if (command === 'hide-images' || command === 'show-images') {
  // 不適切な画像の通報を受けたとき、掲載を続けたまま画像だけを止める。
  const hidden = command === 'hide-images' ? 1 : 0;
  sql = `UPDATE plugins SET images_hidden = ${hidden}, updated_at = ${quote(now)} WHERE id = ${PID}; SELECT id, images_hidden FROM plugins WHERE id = ${PID};`;
} else if (command === 'show') {
  sql = `SELECT id, owner, repo, display_name, admin_suspended, suspended_reason, removed, images_hidden, last_synced_at
           FROM plugins WHERE id = ${PID};
         SELECT tag, asset_name, digest, started_at, ended_at FROM listing_periods WHERE plugin_id = ${PID}
           ORDER BY started_at DESC;
         SELECT tag, reason, note, suspended_at FROM release_suspensions WHERE plugin_id = ${PID} ORDER BY suspended_at DESC;`;
} else if (command === 'pending') {
  // 掲載の条件を満たしていない新しい版。管理者の確認を待つ理由と、証明の検証を待っている時間を示す。
  // waiting_minutes は版の公開からの経過時間。定期処理が止まって検査が進まないことに気づけるよう示す。
  sql = `SELECT p.owner || '/' || p.repo AS plugin, r.tag, r.published_at,
           CAST((julianday('now') - julianday(r.published_at)) * 1440 AS INTEGER) AS waiting_minutes,
           c.diff_state, c.diff_hits, c.config_state,
           c.review_state, c.review_attempts, c.review_serious,
           (SELECT json_group_array(json_object('id', json_extract(f.value, '$.id'),
              'explanation', json_extract(f.value, '$.explanation'), 'evidence', json_extract(f.value, '$.evidence')))
            FROM json_each(json_extract(c.review_json, '$.findings')) f WHERE json_extract(f.value, '$.serious') = 1)
             AS serious_findings,
           (SELECT count(*) FROM attestation_checks t JOIN assets a ON a.github_asset_id = t.github_asset_id
            WHERE a.release_id = r.github_release_id
              AND (t.result = 'pending' OR (t.result = 'error' AND t.attempts < ${MAX_CHECK_ATTEMPTS})))
             AS attestations_waiting,
           (SELECT count(*) FROM assets a
              LEFT JOIN attestation_checks t ON t.github_asset_id = a.github_asset_id
              LEFT JOIN content_checks k ON k.github_asset_id = a.github_asset_id
              LEFT JOIN macos_signing_checks m ON m.github_asset_id = a.github_asset_id
            WHERE a.release_id = r.github_release_id
              AND ((t.result = 'error' AND t.attempts >= ${MAX_CHECK_ATTEMPTS})
                OR (k.result = 'error' AND k.attempts >= ${MAX_CHECK_ATTEMPTS})
                OR (m.result = 'error' AND m.attempts >= ${MAX_CHECK_ATTEMPTS}))) AS checks_exhausted,
           (SELECT count(*) FROM attestation_checks t JOIN assets a ON a.github_asset_id = t.github_asset_id
            WHERE a.release_id = r.github_release_id AND t.result = 'failed') AS attestations_failed
         FROM release_checks c JOIN releases r ON r.github_release_id = c.github_release_id JOIN plugins p ON p.id = r.plugin_id
         WHERE c.admin_approved_at IS NULL AND p.removed = 0
           AND NOT EXISTS (SELECT 1 FROM listing_periods l WHERE l.github_release_id = r.github_release_id)
           AND NOT EXISTS (SELECT 1 FROM release_suspensions s WHERE s.github_release_id = r.github_release_id)
         ORDER BY r.published_at;`;
} else if (command === 'approve-release') {
  // 乗っ取りの兆候とレビューの指摘による確認待ちだけを解く。証明・不変・配布の形の条件は解けない。
  if (!reason || !TAG.test(reason)) fail('a release tag is required');
  // 所有者の変更による確認待ちも、この承認で解く (ADR 0015)。
  sql = `UPDATE release_checks SET admin_approved_at = ${quote(now)} WHERE github_release_id = ${releaseOf(reason)};
         UPDATE plugins SET owner_changed_at = NULL WHERE id = ${PID} AND ${releaseOf(reason)} IS NOT NULL;
         SELECT r.tag, c.admin_approved_at FROM release_checks c JOIN releases r ON r.github_release_id = c.github_release_id
           WHERE c.github_release_id = ${releaseOf(reason)};`;
} else if (command === 'suspend-release') {
  // 版を止め、告知の文とともに記録する。同じ版にもう一度実行すると、告知の文を書き換える。告知の文は公開される。
  if (!reason || !TAG.test(reason)) fail('a release tag is required');
  if (!extra || !NOTE.test(extra)) fail('a note (1-500 characters, no control characters) is required');
  sql = `INSERT INTO release_suspensions (plugin_id, github_release_id, tag, reason, note, suspended_at)
           SELECT ${PID}, ${releaseOf(reason)}, ${quote(reason)}, 'admin', ${quote(extra)}, ${quote(now)}
           WHERE ${releaseOf(reason)} IS NOT NULL
           ON CONFLICT (github_release_id) DO UPDATE SET note = excluded.note;
         SELECT tag, reason, note, suspended_at FROM release_suspensions WHERE github_release_id = ${releaseOf(reason)};`;
} else if (command === 'retry-checks') {
  // 試行を使い切った検査を、待ちの状態に戻す。原因 (配布物の取得の失敗、Workers AI の障害など) を確かめてから使う。
  // 証明の検証・中身の検査・macOS の判定は、次の verify.yaml と macos-verify.yaml の起動で検査し直す。
  // 2 回失敗したレビューは、次の定期処理の新しい版の検査でやり直す。
  // 通信の検出の試行切れは戻さない。掲載を止めず、レビューは検出の結果なしで進むため。
  if (!reason || !TAG.test(reason)) fail('a release tag is required');
  const assetsOf = `(SELECT github_asset_id FROM assets WHERE release_id = ${releaseOf(reason)})`;
  const exhausted = `result = 'error' AND attempts >= ${MAX_CHECK_ATTEMPTS} AND github_asset_id IN ${assetsOf}`;
  sql = `UPDATE attestation_checks SET result = 'pending', attempts = 0 WHERE ${exhausted};
         UPDATE content_checks SET result = 'pending', attempts = 0 WHERE ${exhausted};
         UPDATE macos_signing_checks SET result = 'pending', attempts = 0 WHERE ${exhausted};
         UPDATE release_checks SET review_state = 'pending', review_attempts = 0, review_wait_until = NULL
           WHERE github_release_id = ${releaseOf(reason)} AND review_state = 'failed'
             AND review_attempts >= ${MAX_REVIEW_ATTEMPTS};
         SELECT a.name, t.result AS attestation, t.attempts AS attestation_attempts,
             k.result AS content, k.attempts AS content_attempts, m.result AS macos, m.attempts AS macos_attempts
           FROM assets a
           LEFT JOIN attestation_checks t ON t.github_asset_id = a.github_asset_id
           LEFT JOIN content_checks k ON k.github_asset_id = a.github_asset_id
           LEFT JOIN macos_signing_checks m ON m.github_asset_id = a.github_asset_id
           WHERE a.release_id = ${releaseOf(reason)};
         SELECT review_state, review_attempts FROM release_checks WHERE github_release_id = ${releaseOf(reason)};`;
} else {
  fail(`unknown command: ${command}`);
}

// シェルを介さずに wrangler を起動する。SQL の引用符がシェルに解釈されないようにするため。
const wrangler = new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url);
const result = spawnSync(
  process.execPath,
  [
    wrangler.pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    'd1',
    'execute',
    'DB',
    remote ? '--remote' : '--local',
    '--command',
    sql,
    ...(remote ? ['--env', 'production'] : []),
  ],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
