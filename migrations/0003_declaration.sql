-- 宣言ファイル .audio-soko-kun/config.json の新しい形と、宣言と中身の検査の結果の照合 (mismatch) と、カテゴリの推定に要る列を足す。
-- 表の定義と意味は docs/design/data-model.md に、判定の規則は docs/design/scanning.md の「宣言ファイル」に記載している。

-- config_state の CHECK に mismatch を足すため、release_checks を作り直す。SQLite は CHECK を ALTER で変えられない。
-- release_checks を参照する表は無いため、作り直しで連鎖削除は起きない。
-- config_fetched_at は宣言ファイルを取得した日時、config_json は検証して正規化した宣言 (ファイルが無ければ NULL)。
-- mismatch の判定は宣言の取得と中身の検査の両方を終えてから行うため、取得の結果を版ごとに持つ。
CREATE TABLE release_checks_new (
  github_release_id INTEGER PRIMARY KEY REFERENCES releases (github_release_id) ON DELETE CASCADE,
  immutable INTEGER NOT NULL DEFAULT 0,
  base_release_id INTEGER,
  diff_state TEXT NOT NULL DEFAULT 'pending' CHECK (diff_state IN ('pending', 'passed', 'held', 'skipped', 'error')),
  diff_hits TEXT,
  config_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (config_state IN ('pending', 'ok', 'missing', 'invalid', 'no_declared_assets', 'mismatch')),
  review_state TEXT NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending', 'done', 'failed')),
  review_attempts INTEGER NOT NULL DEFAULT 0,
  review_wait_until TEXT,
  review_json TEXT,
  review_serious INTEGER NOT NULL DEFAULT 0,
  reviewed_at TEXT,
  admin_approved_at TEXT,
  license_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (license_state IN ('pending', 'passed', 'no_license', 'license_unrecognized', 'license_not_open')),
  license_spdx TEXT,
  config_fetched_at TEXT,
  config_json TEXT
);
INSERT INTO release_checks_new (github_release_id, immutable, base_release_id, diff_state, diff_hits, config_state,
  review_state, review_attempts, review_wait_until, review_json, review_serious, reviewed_at, admin_approved_at,
  license_state, license_spdx)
SELECT github_release_id, immutable, base_release_id, diff_state, diff_hits, config_state,
  review_state, review_attempts, review_wait_until, review_json, review_serious, reviewed_at, admin_approved_at,
  license_state, license_spdx
FROM release_checks;
DROP TABLE release_checks;
ALTER TABLE release_checks_new RENAME TO release_checks;

-- 派生元の宣言した OS の一覧は、配布物ごとの宣言 (pattern・os・arch・formats) の JSON に置き換える。
ALTER TABLE plugins DROP COLUMN declared_os;
ALTER TABLE plugins ADD COLUMN declared_assets TEXT;
-- カテゴリの値をオーディオプラグインの 5 つに替える。plugins を作り直すと参照する表の行が連鎖削除されるため、
-- 列の既定値 'other' は残し、登録の処理が常に値を指定する。既存の行は utility にそろえる。
UPDATE plugins SET category = 'utility' WHERE category NOT IN ('instrument', 'effect', 'analyzer', 'midi', 'utility');

-- 中身の検査で読めたカテゴリの手がかり (Audio Unit の type と VST 3 の moduleinfo.json の Sub Categories) の JSON の配列。
ALTER TABLE content_checks ADD COLUMN categories TEXT;
