-- 派生元の OBS Studio に固有の列を外し、オーディオプラグインの掲載の条件に要る列と表を足す。
-- 表の定義と意味は docs/design/data-model.md に記載している。

-- ビルドに使った OBS Studio の版と、配布物の名前から推定した OS は持たない。OS は中身の検査の結果で持つ。
ALTER TABLE releases DROP COLUMN obs_build_version;
ALTER TABLE assets DROP COLUMN os;
-- 配布物の種類。ファイル名の拡張子から決める。既定値は案内しない other にする。
ALTER TABLE assets ADD COLUMN kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('archive', 'installer', 'other'));

-- 新しく作るサービスのため、既存のリリースを移行する legacy の列は持たない。
ALTER TABLE release_checks DROP COLUMN legacy;
-- 版のタグの時点のライセンスの判定。
ALTER TABLE release_checks ADD COLUMN license_state TEXT NOT NULL DEFAULT 'pending'
  CHECK (license_state IN ('pending', 'passed', 'no_license', 'license_unrecognized', 'license_not_open'));
ALTER TABLE release_checks ADD COLUMN license_spdx TEXT;

-- 中身の検査の結果。kind が archive の配布物だけに作る。
CREATE TABLE content_checks (
  github_asset_id INTEGER PRIMARY KEY REFERENCES assets (github_asset_id) ON DELETE CASCADE,
  result TEXT NOT NULL DEFAULT 'pending'
    CHECK (result IN ('pending', 'passed', 'no_plugin', 'vst2_detected', 'undetermined', 'error')),
  bundles TEXT,
  formats TEXT,
  os TEXT,
  arches TEXT,
  vst2_files TEXT,
  reason TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT
);
CREATE INDEX content_checks_pending ON content_checks (result, checked_at);

-- 署名と公証の判定の結果。中身の検査で macOS 向けのバンドルを検出した配布物だけに作る。
CREATE TABLE macos_signing_checks (
  github_asset_id INTEGER PRIMARY KEY REFERENCES assets (github_asset_id) ON DELETE CASCADE,
  result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'passed', 'failed', 'error')),
  team_id TEXT,
  reason TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT
);
CREATE INDEX macos_signing_checks_pending ON macos_signing_checks (result, checked_at);
