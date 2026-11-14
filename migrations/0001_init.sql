-- 派生元 plugin-soko-kun の 5da291e の migrations/0001〜0009 をすべて適用した結果のスキーマを 1 本にまとめたもの。
-- 表の定義と意味は docs/design/data-model.md に記載している。以後のスキーマの変更は 0002 以降の新しいファイルで足す。
-- 掲載状態は列に保存せず、scans と admin_suspended と removed から問い合わせのたびに算出する。
-- 同期と管理操作が競合しても、停止したプラグインが再公開されないようにするため。

CREATE TABLE plugins (
  id TEXT PRIMARY KEY,                     -- owner/repo を小文字化した slug
  github_repo_id INTEGER NOT NULL UNIQUE,  -- 重複登録の防止とリネームへの追従に使う
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  summary TEXT,                            -- GitHub 由来の外部データ
  license_spdx TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  admin_suspended INTEGER NOT NULL DEFAULT 0,
  suspended_reason TEXT,
  removed INTEGER NOT NULL DEFAULT 0,      -- GitHub で 404 または非公開になった
  submitter_github_id INTEGER NOT NULL,
  releases_etag TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_synced_at TEXT NOT NULL,
  -- 作者がリポジトリの .soko-kun/ に置いた画像の取得の状態
  images_tag TEXT,
  images_hidden INTEGER NOT NULL DEFAULT 0,
  -- .soko-kun/config.json の宣言と、初めて証明を検証できた版の署名したワークフロー
  display_name TEXT,
  declared_os TEXT,
  release_workflow TEXT,
  -- 同期で所有者の変更を検出した日時。値がある間は、まだ掲載していない新しい版を管理者の確認待ちにする
  owner_changed_at TEXT
);

CREATE TABLE releases (
  github_release_id INTEGER PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES plugins (id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  name TEXT,                               -- GitHub 由来の外部データ
  commit_sha TEXT NOT NULL,
  published_at TEXT NOT NULL,
  html_url TEXT NOT NULL,
  -- リリースのタグの時点の buildspec.json に書かれた、ビルドに使う OBS Studio の版。NULL は未取得、空文字列は値が無いことを表す
  obs_build_version TEXT
);
CREATE INDEX releases_plugin ON releases (plugin_id, published_at);

CREATE TABLE assets (
  github_asset_id INTEGER PRIMARY KEY,
  release_id INTEGER NOT NULL REFERENCES releases (github_release_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  digest TEXT NOT NULL,                    -- sha256:<hex>。GitHub が付けた値
  download_url TEXT NOT NULL,
  os TEXT                                  -- windows / macos / linux。ソース系は NULL
);
CREATE INDEX assets_release ON assets (release_id);

-- digest ごとに結果を持ち、新しいリリースや digest の変化に過去の結果を流用しない。
CREATE TABLE scans (
  digest TEXT NOT NULL,
  scanner TEXT NOT NULL CHECK (scanner IN ('virustotal', 'malwarebazaar')),
  result TEXT NOT NULL CHECK (result IN ('pending', 'clean', 'suspicious', 'malicious', 'not_found', 'error')),
  detail TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  scanned_at TEXT,
  PRIMARY KEY (digest, scanner)
);
CREATE INDEX scans_pending ON scans (result, scanned_at);

CREATE TABLE submit_log (
  github_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  outcome TEXT NOT NULL
);
CREATE INDEX submit_log_user ON submit_log (github_user_id, created_at);

CREATE TABLE rate_limit (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);

-- プラグインの概要の機械翻訳。概要が変わると source_hash が一致しなくなり、翻訳し直す。
CREATE TABLE plugin_translations (
  plugin_id TEXT NOT NULL REFERENCES plugins (id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  text TEXT NOT NULL,
  translated_at TEXT NOT NULL,
  PRIMARY KEY (plugin_id, lang)
);

-- プラグインのロゴと説明の画像。作者がリポジトリの .soko-kun/ に置いたファイルを、同期のときに取得して保存する。
CREATE TABLE plugin_images (
  plugin_id TEXT NOT NULL REFERENCES plugins (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('logo', 'image')),
  blob_sha TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/gif', 'image/webp')),
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes BLOB NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (plugin_id, kind)
);

-- GitHub でのダウンロード数の日ごとの記録。週間の数は、最新の記録と 7 日以上前の記録の差で求める。
CREATE TABLE download_snapshots (
  plugin_id TEXT NOT NULL REFERENCES plugins (id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  total INTEGER NOT NULL,
  PRIMARY KEY (plugin_id, day)
);

-- 説明の画像から作った表示用の WebP の画像。詳細ページを軽く表示するため、定期処理が作って保存する。
CREATE TABLE plugin_image_previews (
  plugin_id TEXT PRIMARY KEY REFERENCES plugins (id) ON DELETE CASCADE,
  source_sha TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes BLOB NOT NULL,
  made_at TEXT NOT NULL
);

-- 新しい版の掲載の条件 (派生元の ADR 0013)。
CREATE TABLE release_checks (
  github_release_id INTEGER PRIMARY KEY REFERENCES releases (github_release_id) ON DELETE CASCADE,
  legacy INTEGER NOT NULL DEFAULT 0,
  immutable INTEGER NOT NULL DEFAULT 0,
  base_release_id INTEGER,
  diff_state TEXT NOT NULL DEFAULT 'pending' CHECK (diff_state IN ('pending', 'passed', 'held', 'skipped', 'error')),
  diff_hits TEXT,
  config_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (config_state IN ('pending', 'ok', 'missing', 'invalid', 'no_declared_assets')),
  review_state TEXT NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending', 'done', 'failed')),
  review_attempts INTEGER NOT NULL DEFAULT 0,
  -- Workers AI の無料枠を使い切ったとき、次に LLM のレビューを試す時刻 (1 時間後)。それまでレビューを待たせる。
  review_wait_until TEXT,
  review_json TEXT,
  review_serious INTEGER NOT NULL DEFAULT 0,
  reviewed_at TEXT,
  admin_approved_at TEXT
);

CREATE TABLE attestation_checks (
  github_asset_id INTEGER PRIMARY KEY REFERENCES assets (github_asset_id) ON DELETE CASCADE,
  result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'passed', 'failed', 'error')),
  reason TEXT,
  signer_workflow TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT
);
CREATE INDEX attestation_checks_pending ON attestation_checks (result, checked_at);

-- 掲載した配布物と期間。プラグインやリリースの削除と連鎖させず、行を削除しない。
CREATE TABLE listing_periods (
  plugin_id TEXT NOT NULL,
  github_release_id INTEGER NOT NULL,
  digest TEXT NOT NULL,
  tag TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  PRIMARY KEY (github_release_id, digest)
);
CREATE INDEX listing_periods_plugin ON listing_periods (plugin_id, started_at);

-- 止めた版。告知ページと警告に使う。プラグインやリリースの削除と連鎖させず、行を削除しない。
CREATE TABLE release_suspensions (
  id INTEGER PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  github_release_id INTEGER NOT NULL UNIQUE,
  tag TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('admin', 'malicious')),
  note TEXT,
  suspended_at TEXT NOT NULL
);
CREATE INDEX release_suspensions_plugin ON release_suspensions (plugin_id);

-- リポジトリの名前の変更と移管の扱い (派生元の ADR 0015)。
CREATE TABLE plugin_aliases (
  alias TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES plugins (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  -- 旧い owner/repo を、大文字と小文字を保ったまま記録する。名前を変える前に作られた証明は、この名前でしか検証に通らない
  name TEXT
);

CREATE TABLE check_log (
  github_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX check_log_user ON check_log (github_user_id, created_at);
