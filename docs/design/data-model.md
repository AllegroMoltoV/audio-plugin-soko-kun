# データモデル

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../images/VST_Compatible_Logo_Steinberg_negative.png">
  <img src="../images/VST_Compatible_Logo_Steinberg.png" alt="VST Compatible" width="120">
</picture>

VST® is a registered trademark of Steinberg Media Technologies GmbH.

D1 のテーブルと、掲載状態の算出規則の仕様です。スキーマの正は、本サービスのリポジトリの `migrations/` 配下の SQL ファイルになる予定です。

配信プラグイン倉庫くんのテーブルを引き継ぎ、オーディオプラグインの配布物の判定に要る列と表を足しています。本サービスは新しく作るため、配信プラグイン倉庫くんの `legacy` の列のような移行のための列は持ちません。

## テーブルの一覧

| テーブル | 内容 |
| --- | --- |
| `plugins` | 登録されたプラグイン 1 件につき 1 行 |
| `releases` | プラグインの GitHub のリリース 1 件につき 1 行 |
| `assets` | リリースの配布物 1 件につき 1 行 |
| `scans` | `digest` とスキャナーの組 1 つにつき 1 行 |
| `submit_log` | `submit_plugin` の要求 1 件につき 1 行 |
| `rate_limit` | レート制限の集計の窓 1 つにつき 1 行 |
| `plugin_translations` | プラグインと翻訳先の言語の組 1 つにつき 1 行 |
| `plugin_images` | プラグインと画像の種類の組 1 つにつき 1 行 |
| `plugin_image_previews` | 説明の画像を持つプラグイン 1 つにつき 1 行 |
| `download_snapshots` | プラグインと日付の組 1 つにつき 1 行 |
| `release_checks` | 新しい版の検査とレビューの結果。リリース 1 件につき 1 行 |
| `attestation_checks` | 証明の検証の結果。アーカイブの配布物 1 件につき 1 行 |
| `content_checks` | 中身の検査の結果。アーカイブの配布物 1 件につき 1 行 |
| `macos_signing_checks` | 署名と公証の判定の結果。macOS 向けのバンドルを含む配布物 1 件につき 1 行 |
| `listing_periods` | 掲載した配布物と掲載の期間。削除しない |
| `release_suspensions` | 管理者が止めた版とマルウェアを検出した版。削除しない |
| `plugin_aliases` | プラグインの旧い URL の ID 1 つにつき 1 行 |
| `check_log` | `submit_plugin` の確認のモードの要求 1 件につき 1 行 |

OAuth のクライアント・認可・トークンの情報は D1 ではなく KV の `OAUTH_KV` に置きます。KV の形式は `@cloudflare/workers-oauth-provider` が管理します。

## plugins

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `id` | TEXT | 主キー | 内部のプラグイン ID。登録したときの `owner/repo` を小文字にした文字列で、名前の変更では変えない。URL と MCP で示す ID は、現在の `owner` と `repo` を小文字にして `/` でつないだもので、名前を変えると変わる |
| `github_repo_id` | INTEGER | NOT NULL、UNIQUE | GitHub のリポジトリ ID。重複登録の防止と、名前の変更と移管への追従に使う |
| `owner` | TEXT | NOT NULL | GitHub のリポジトリの所有者名 |
| `repo` | TEXT | NOT NULL | GitHub のリポジトリ名 |
| `summary` | TEXT | | 概要。外部データ |
| `license_spdx` | TEXT | NOT NULL | 登録のときに、最新のリリースのタグの時点で判定したライセンスの SPDX 識別子。画面と MCP に示すライセンスは、掲載対象バージョンの `release_checks` の `license_spdx` を使う |
| `category` | TEXT | NOT NULL | カテゴリ。`instrument`・`effect`・`analyzer`・`midi`・`utility` のいずれか。登録のときは `utility` を書き、宣言ファイルとの照合を終えたときに推定した値へ替える。推定の規則は [検査と同期](scanning.md) に記載する。スキーマの既定値は派生元の `other` のまま残している。`plugins` を作り直すと参照する表の行が連鎖削除されるためで、登録の処理が常に値を書く |
| `admin_suspended` | INTEGER | NOT NULL、既定値 0 | 1 のとき管理停止 |
| `suspended_reason` | TEXT | | 管理停止の理由 |
| `removed` | INTEGER | NOT NULL、既定値 0 | 1 のとき、GitHub でリポジトリが削除または非公開になった |
| `submitter_github_id` | INTEGER | NOT NULL | 登録者の GitHub のユーザー ID |
| `releases_etag` | TEXT | | リリース一覧の取得で使う ETag |
| `images_tag` | TEXT | | 最後に画像を取得したときのリリースのタグ |
| `images_hidden` | INTEGER | NOT NULL、既定値 0 | 1 のとき、管理者の判断で画像を表示も配信もしない |
| `created_at` | TEXT | NOT NULL | 登録日時 |
| `updated_at` | TEXT | NOT NULL | 行の更新日時。画面の「更新日」には使わない |
| `last_synced_at` | TEXT | NOT NULL | 最後に同期した日時。同期の順序に使う |
| `display_name` | TEXT | | 宣言ファイルの `name`。外部データ。NULL のときはリポジトリ名を表示する |
| `declared_assets` | TEXT | | 宣言ファイルの配布物の宣言を JSON で保存した値。NULL のときは宣言が無い |
| `release_workflow` | TEXT | | 初めて証明を検証できた版の、署名したワークフローのパス |
| `owner_changed_at` | TEXT | | 同期で所有者の変更を検出した日時。値がある間は、まだ掲載していない新しい版を管理者の確認待ちにする |

配信プラグイン倉庫くんの `declared_os` は、`declared_assets` に置き換えます。宣言の形は [検査と同期](scanning.md) に記載します。

## releases

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `github_release_id` | INTEGER | 主キー | GitHub のリリース ID |
| `plugin_id` | TEXT | NOT NULL、`plugins.id` を参照、親の削除で連鎖削除 | プラグイン ID |
| `tag` | TEXT | NOT NULL | タグ名 |
| `name` | TEXT | | リリース名。外部データ |
| `commit_sha` | TEXT | NOT NULL | タグを解決したコミット SHA |
| `published_at` | TEXT | NOT NULL | 公開日時。掲載対象バージョンの選択に使う |
| `html_url` | TEXT | NOT NULL | GitHub のリリースのページの URL |

索引: `releases_plugin (plugin_id, published_at)`

配信プラグイン倉庫くんの `obs_build_version` は持ちません。ビルドに使った SDK の版も記録しません。配布物から SDK の版を読み取る方法が確かめられていないためです。

## assets

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `github_asset_id` | INTEGER | 主キー | GitHub の配布物の ID |
| `release_id` | INTEGER | NOT NULL、`releases.github_release_id` を参照、親の削除で連鎖削除 | リリース ID |
| `name` | TEXT | NOT NULL | 配布物のファイル名。外部データ |
| `size` | INTEGER | NOT NULL | バイト数 |
| `digest` | TEXT | NOT NULL | GitHub が付けた `sha256:<16 進数>` の値 |
| `download_url` | TEXT | NOT NULL | GitHub の配布物のダウンロード URL |
| `kind` | TEXT | NOT NULL | `archive`・`installer`・`other` のいずれか。ファイル名の拡張子から決める。規則は [検査と同期](scanning.md) に記載する |

索引: `assets_release (release_id)`

`digest` を持たない配布物は保存しません。配布物の OS・アーキテクチャ・規格は、ファイル名から推定せず、`content_checks` に中身の検査の結果として持ちます。

## scans

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `digest` | TEXT | 主キーの一部 | 照会した `digest` |
| `scanner` | TEXT | 主キーの一部。値は `malwarebazaar` | スキャナー |
| `result` | TEXT | NOT NULL、下表の値のいずれか | 検査結果 |
| `detail` | TEXT | | スキャナーの応答の要約 |
| `attempts` | INTEGER | NOT NULL、既定値 0 | 照会した回数 |
| `scanned_at` | TEXT | | 最後に照会した日時 |

索引: `scans_pending (result, scanned_at)`

検査結果は `digest` ごとに持ちます。照会の対象は、インストーラーを含むリリースのすべての配布物です。案内しない配布物でも、既知のマルウェアが同じリリースにあれば、そのリポジトリが侵害されている兆候になるためです。

| `result` | 意味 |
| --- | --- |
| `pending` | 照会していない |
| `malicious` | MalwareBazaar が既知のマルウェアとして収録している |
| `not_found` | MalwareBazaar が `digest` を収録していない |
| `error` | 照会に失敗した |

## submit_log

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `github_user_id` | INTEGER | NOT NULL | 要求した利用者の GitHub のユーザー ID |
| `created_at` | TEXT | NOT NULL | 要求の日時 |
| `outcome` | TEXT | NOT NULL | 結果。成功は `accepted`、失敗は理由コード |

索引: `submit_log_user (github_user_id, created_at)`

`submit_plugin` のレート制限は、この表の件数で判定します。上限は利用者ごとに直近 24 時間で 10 件です。検証で失敗した要求も数えます。レート制限で拒否した要求は記録しません。

## rate_limit

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `key` | TEXT | 主キーの一部 | `<経路>:<送信元 IP アドレス>` の SHA-256 を 16 進数で表した文字列。IP アドレスをそのまま保存しない |
| `window_start` | INTEGER | 主キーの一部 | 集計の窓の開始時刻。UNIX 時刻のミリ秒を 60,000 で割って切り捨てた値 |
| `count` | INTEGER | NOT NULL | 窓の中の要求の件数 |

集計は長さ 1 分の固定窓で行います。経路ごとの上限は次のとおりです。

| 経路 | 対象のパス | 上限 |
| --- | --- | --- |
| `oauth` | `/authorize`・`/callback`・`/oauth/token`・`/oauth/register` | IP アドレスあたり 1 分 20 回 |
| `public` | `/mcp` と Web カタログ | IP アドレスあたり 1 分 120 回 |

`/.well-known/oauth-authorization-server` と `/.well-known/oauth-protected-resource` で始まる OAuth のメタデータには、レート制限を設けません。それ以外の `/.well-known/` 配下は `public` の経路として数えます。送信元 IP アドレスは要求ヘッダー `CF-Connecting-IP` から得ます。上限を超えた要求には、429 と `Retry-After: 60` を返します。60 分より前の窓の行は、Cron の定期処理で削除します。

## release_checks

新しい版の検査とレビューの結果を保存します。規則は [検査と同期](scanning.md) に、項目は [審査の基準](review-criteria.md) に記載しています。

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `github_release_id` | INTEGER | 主キー、`releases.github_release_id` を参照、親の削除で連鎖削除 | リリース ID |
| `immutable` | INTEGER | NOT NULL、既定値 0 | 1 のとき、GitHub のリリースの API の `immutable` が true |
| `base_release_id` | INTEGER | | 差分の起点にした掲載中のリリース。初めて登録した版では NULL |
| `diff_state` | TEXT | NOT NULL、既定値 `pending` | `pending`・`passed`・`held`・`skipped`・`error` のいずれか。`skipped` は起点が無いとき |
| `diff_hits` | TEXT | | 当たった乗っ取りの兆候の ID とファイルの JSON |
| `license_state` | TEXT | NOT NULL、既定値 `pending` | 版のタグの時点のライセンスの判定。`pending`・`passed`・`no_license`・`license_unrecognized`・`license_not_open` のいずれか。規則は [検査と同期](scanning.md) の「ライセンスの判定」に記載する |
| `license_spdx` | TEXT | | 版のタグの時点で GitHub が検出したライセンスの SPDX 識別子。ライセンスが無いときは NULL |
| `config_state` | TEXT | NOT NULL、既定値 `pending` | 宣言ファイルの判定。`pending`・`ok`・`missing`・`invalid`・`no_declared_assets`・`mismatch` のいずれか。`mismatch` は、宣言と中身の検査の結果が食い違うとき |
| `config_fetched_at` | TEXT | | 版のタグの時点の宣言ファイルを取得した日時。NULL は未取得 |
| `config_json` | TEXT | | 取得して検証した宣言を正規化した JSON。ファイルが無いときと未取得のときは NULL。中身の検査を終えてから照合するために持つ |
| `review_state` | TEXT | NOT NULL、既定値 `pending` | `pending`・`done`・`failed` のいずれか |
| `review_attempts` | INTEGER | NOT NULL、既定値 0 | レビューを試みた回数。Workers AI の無料枠の不足と混雑は数えない |
| `review_wait_until` | TEXT | | Workers AI の無料枠を使い切ったとき、次にレビューを試す日時。不足を受けた 1 時間後 |
| `review_json` | TEXT | | レビューの指摘の JSON。説明と該当の箇所は外部データ |
| `review_serious` | INTEGER | NOT NULL、既定値 0 | 重大な指摘の件数 |
| `reviewed_at` | TEXT | | レビューした日時 |
| `admin_approved_at` | TEXT | | 管理者が確認待ちを承認した日時。NULL は未承認 |
| `network_state` | TEXT | NOT NULL、既定値 `pending` | 通信の API の検出の状態。`pending`・`done`・`error`・`skipped` のいずれか。`skipped` はマイグレーション 0005 の時点で既にあった版 |
| `network_hits` | TEXT | | 検出で当たった箇所の JSON (`{hits: [{file, line, api, text}], truncated}`)。行の文字列は外部データ |
| `network_attempts` | INTEGER | NOT NULL、既定値 0 | 検出の結果を受け取った回数。`error` が 3 回になったら、検出の結果なしでレビューする |
| `network_checked_at` | TEXT | | 最後に検出の結果を受け取った日時 |

通信の API の検出は、掲載の可否を直接は決めません。検出の結果は `user-data-handling` のレビューの事実として使います。レビューは検出の結果を待ちますが、待つのは版の公開から 6 時間までです。

宣言ファイルは任意です。`missing` は掲載を止めません。規格・OS・アーキテクチャは中身の検査の検出を正とするためです。

## attestation_checks

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `github_asset_id` | INTEGER | 主キー、`assets.github_asset_id` を参照、親の削除で連鎖削除 | 配布物の ID |
| `result` | TEXT | NOT NULL、既定値 `pending` | `pending`・`passed`・`failed`・`error` のいずれか |
| `reason` | TEXT | | 失敗の理由のコード |
| `signer_workflow` | TEXT | | 検証で確かめた、署名したワークフローのパス |
| `attempts` | INTEGER | NOT NULL、既定値 0 | 検証を試みた回数 |
| `checked_at` | TEXT | | 最後に検証した日時 |

行は、`kind` にかかわらず、リリースのすべての配布物について作ります。案内しないインストーラーと `other` の配布物にも証明を求めます ([ADR 0003](../decisions/0003-listing-conditions.md))。

## content_checks

中身の検査の結果を保存します。行を作るのは `kind` が `archive` の配布物だけです。判定の規則は [検査と同期](scanning.md) に記載します。

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `github_asset_id` | INTEGER | 主キー、`assets.github_asset_id` を参照、親の削除で連鎖削除 | 配布物の ID |
| `result` | TEXT | NOT NULL、既定値 `pending` | `pending`・`passed`・`no_plugin`・`vst2_detected`・`undetermined`・`error` のいずれか |
| `bundles` | TEXT | | 検出したバンドルの JSON。バンドルごとに、アーカイブの中のパス・規格・OS・アーキテクチャの配列を持つ。パスは外部データ |
| `formats` | TEXT | | 検出した規格の JSON の配列。`vst3`・`clap`・`lv2`・`au` のいずれか |
| `os` | TEXT | | 検出した OS の JSON の配列。`windows`・`macos`・`linux` のいずれか |
| `arches` | TEXT | | 検出したアーキテクチャの JSON の配列。`x86_64`・`x86`・`arm64` のいずれか。fat binary はスライスごとの値をすべて含める |
| `vst2_files` | TEXT | | VST 2 のエントリーポイントを検出したバイナリのパスの JSON の配列。外部データ |
| `categories` | TEXT | | 検出したバンドルから読んだカテゴリの手がかりの JSON の配列。`instrument`・`effect`・`analyzer`・`midi` のいずれか |
| `reason` | TEXT | | `error` の理由のコード |
| `attempts` | INTEGER | NOT NULL、既定値 0 | 検査を試みた回数 |
| `checked_at` | TEXT | | 最後に検査した日時 |

| `result` | 意味 |
| --- | --- |
| `pending` | 検査していない |
| `passed` | 規格のバンドルを 1 つ以上検出し、VST 2 のエントリーポイントを検出しなかった |
| `no_plugin` | 規格のバンドルを検出しなかった。ソースコードや文書だけのアーカイブが当たる |
| `vst2_detected` | `.vst` のバンドルか、VST 2 のエントリーポイントをエクスポートするバイナリを検出した |
| `undetermined` | アーカイブの中のインストーラーや入れ子のアーカイブのように、中を調べられないものを含む。VST 2 を含まないことを確かめられない |
| `error` | 取得・展開・解析に失敗した。展開の上限を超えた場合を含む |

## macos_signing_checks

署名と公証の判定の結果を保存します。行を作るのは、`content_checks` の `os` に `macos` を含む配布物だけです。判定の規則は [検査と同期](scanning.md) に記載します。

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `github_asset_id` | INTEGER | 主キー、`assets.github_asset_id` を参照、親の削除で連鎖削除 | 配布物の ID |
| `result` | TEXT | NOT NULL、既定値 `pending` | `pending`・`passed`・`failed`・`error` のいずれか。`passed` は、macOS 向けのすべてのバンドルに Developer ID の署名と Apple の公証があるとき |
| `team_id` | TEXT | | 署名の Team ID。複数のバンドルで食い違う場合は、すべての値を JSON の配列で記録する |
| `reason` | TEXT | | `failed` と `error` の理由のコード。`not_signed`・`adhoc`・`not_developer_id`・`not_notarized`・`check_error` のいずれか |
| `attempts` | INTEGER | NOT NULL、既定値 0 | 判定を試みた回数 |
| `checked_at` | TEXT | | 最後に判定した日時 |

## listing_periods

掲載した配布物と、その期間を記録します。侵害が起きたときに、影響を受けた版と期間を示すために使います。他の表の削除と連鎖せず、行を削除しません。

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `plugin_id` | TEXT | NOT NULL | 内部のプラグイン ID |
| `github_release_id` | INTEGER | 主キーの一部 | リリース ID |
| `digest` | TEXT | 主キーの一部 | 配布物の `digest` |
| `tag` | TEXT | NOT NULL | タグ名 |
| `asset_name` | TEXT | NOT NULL | 配布物のファイル名。外部データ |
| `started_at` | TEXT | NOT NULL | 掲載を始めた日時 |
| `ended_at` | TEXT | | 掲載を終えた日時。掲載中は NULL |

記録するのは、案内する配布物だけです。同期は、掲載対象のリリースが変わったときに、新しい案内する配布物の行を足し、それまでの行の `ended_at` を埋めます。

## release_suspensions

管理者が止めた版と、マルウェアを検出した版を記録します。告知ページと警告の表示に使います。他の表の削除と連鎖せず、行を削除しません。

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `id` | INTEGER | 主キー | 連番 |
| `plugin_id` | TEXT | NOT NULL | 内部のプラグイン ID |
| `github_release_id` | INTEGER | NOT NULL、UNIQUE | リリース ID。同じ版を止め直すと、告知の文を書き換える |
| `tag` | TEXT | NOT NULL | タグ名 |
| `reason` | TEXT | NOT NULL | `admin`・`malicious` のいずれか |
| `note` | TEXT | | 管理者が書く告知の文 |
| `suspended_at` | TEXT | NOT NULL | 止めた日時 |

## plugin_aliases

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `alias` | TEXT | 主キー | 旧い URL の ID。`owner/repo` を小文字にした文字列 |
| `name` | TEXT | | 旧い `owner/repo` を、大文字と小文字を保ったまま記録した文字列。名前を変える前に作られた証明の検証に使う |
| `plugin_id` | TEXT | NOT NULL、`plugins.id` を参照、親の削除で連鎖削除 | 内部のプラグイン ID |
| `created_at` | TEXT | NOT NULL | 記録した日時 |

同期で `owner` か `repo` が変わったとき、変わる前の ID を記録します。旧い ID の詳細ページは新しい ID へ 301 で転送し、`get_plugin` は旧い ID も受け付けます。旧い ID は、現在の名前の一致より優先して、記録した元のプラグインに向けます。

## check_log

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `github_user_id` | INTEGER | NOT NULL | 要求した利用者の GitHub のユーザー ID |
| `created_at` | TEXT | NOT NULL | 要求の日時 |

確認のモードの上限は、利用者ごとに直近 24 時間で 5 件です。

## 掲載状態の算出規則

掲載状態は列に保存せず、問い合わせのたびに算出します。

### 検査結果の解釈

| スキャナー | `not_found` | `pending`・`error` | `malicious` |
| --- | --- | --- | --- |
| `malwarebazaar` | 確定 | 未確定 | 検出 |

### 案内する配布物

配布物を案内するのは、次をすべて満たすときです。

- `kind` が `archive` である。
- `content_checks` の結果が `passed` である。
- `attestation_checks` の結果が `passed` である。
- `content_checks` の `os` に `macos` を含む場合は、`macos_signing_checks` の結果が `passed` である。
- 宣言ファイルの配布物の宣言がある場合は、その宣言に含まれる。

`undetermined` のアーカイブは、`passed` でないため案内しません。macOS の判定に通らない配布物は、案内しないだけで、版の掲載を止めません。同じ版の Windows や Linux の配布物は、条件を満たせば案内します。macOS の配布物だけを持つ版は、案内する配布物が無くなるため掲載しません。インストーラーと案内しない配布物は、画面と MCP のダウンロード先に出しません。

### 検査済みのリリース

リリースが検査済みとなるのは、次をすべて満たすときです。

- 案内する配布物を 1 件以上持つ。
- すべての配布物について、MalwareBazaar の結果が確定である。インストーラーと案内しない配布物も含む。
- すべてのアーカイブの `content_checks` の結果が `pending` と `error` でない。また、`vst2_detected` と `undetermined` のアーカイブが無い。
- macOS 向けのバンドルを含むすべてのアーカイブの `macos_signing_checks` の結果が `pending` と `error` でない。
- すべての配布物の `attestation_checks` の結果が `passed` である。インストーラーと案内しない配布物も含む。
- `license_state` が `passed` である。
- `release_suspensions` に記録されていない。
- `immutable` が 1 である。
- `config_state` が `ok` か `missing` である。
- `diff_state` が `passed` か `skipped` である。または `admin_approved_at` がある。
- `review_state` が `done` で `review_serious` が 0 である。または `admin_approved_at` がある。
- `macos_signing_checks` の `team_id` が、版のすべてのアーカイブで 1 つの値にそろう。または `admin_approved_at` がある。

すべてのアーカイブの判定を終えてから掲載するのは、判定の途中で案内する配布物の組が変わることを避けるためです。証明の検証・中身の検査・macOS の判定の `error` は、3 回まで試行します。3 回目も `error` の配布物は自動ではやり直さず、その版は管理者が原因を確かめるまで掲載しません。`admin_approved_at` だけでは、`error` の配布物を含む版を掲載しません。

Team ID が食い違う版を確認待ちにするのは、乗っ取ったアカウントで別の証明書を使った兆候になりうるためです。

証明の無い配布物、あるいは証明の検証に失敗した配布物を 1 件でも含む版は、ほかのアーカイブが条件を満たしても掲載しません。案内しないインストーラーと `other` の配布物も同じです。乗っ取ったアカウントで手作業でビルドして上げた配布物が、同じ版に紛れている兆候になるためです。

VST 2 のエントリーポイントを 1 件でも検出した版は、ほかのアーカイブが条件を満たしても掲載しません。VST 2 は、2018 年 10 月より前に Steinberg と契約した開発者でなければ新たに配布できず、同じ版で VST 2 を配るリリースへ案内することになるためです ([ADR 0004](../decisions/0004-vst-trademark.md))。`undetermined` のアーカイブを含む版も、VST 2 を含まないことを確かめられないため掲載しません。

### 掲載対象バージョン

掲載対象バージョンは、検査済みのリリースのうち `published_at` が最も新しいものです。それより新しく検査済みでないリリースは、作者向けの `list_my_plugins` にだけ示し、エンドユーザー向けの画面と MCP のツールには示しません。

### プラグインの掲載状態

上から順に評価し、最初に当てはまった状態を採ります。

| 順序 | 条件 | 状態 | 理由 |
| --- | --- | --- | --- |
| 1 | `admin_suspended` が 1 | 停止 | 管理停止 |
| 2 | `removed` が 1 | 掲載終了 | GitHub での削除または非公開化 |
| 3 | いずれかのリリースのいずれかの配布物で、MalwareBazaar の結果が `malicious` | 停止 | マルウェアの検出 |
| 4 | 掲載対象バージョンがある | 掲載中 | |
| 5 | 上のいずれにも当てはまらない | 検査待ち | |

### 状態ごとの公開範囲

| 状態 | Web の一覧・`search_plugins`・サイトマップ | `get_plugin` | Web の詳細ページ |
| --- | --- | --- | --- |
| 掲載中 | 含める | 掲載対象バージョンの項目と、案内する配布物のダウンロード URL を返す | 掲載対象バージョンとダウンロードボタンを表示する |
| 検査待ち | 含めない | 未登録と同じ `not_found` を返す | 404 を返す |
| 停止 | 含めない | 状態・理由・止めた版の警告を返し、ダウンロード URL を返さない | 掲載停止の警告を表示する。noindex にする |
| 掲載終了 | 含めない | 状態と理由だけを返し、ダウンロード URL を返さない | [画面構成](ui.md) の掲載中以外の要素だけを表示する。noindex にする |

掲載中のプラグインでも、`release_suspensions` に記録された版があれば、詳細ページと `get_plugin` に止めた版の警告を示します。詳細ページの noindex は、応答ヘッダー `X-Robots-Tag: noindex` で示します。

## plugin_translations

プラグインの概要の機械翻訳を保存します。

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `plugin_id` | TEXT | 主キーの一部、`plugins.id` を参照、親の削除で連鎖削除 | プラグイン ID |
| `lang` | TEXT | 主キーの一部 | 翻訳先の言語。[多言語対応](i18n.md) の言語タグのいずれか |
| `source_hash` | TEXT | NOT NULL | 翻訳に使ったモデルの名前・翻訳の指示・概要を合わせた文字列の SHA-256。どれかが変わると翻訳し直す |
| `text` | TEXT | NOT NULL | 翻訳した概要。外部データとして扱う。訳を採用しなかった場合は空の文字列で、画面は原文を表示する |
| `translated_at` | TEXT | NOT NULL | 翻訳した日時 |

## plugin_images

プラグインのロゴと説明の画像を保存します。取得の規則は [検査と同期](scanning.md) に記載しています。

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `plugin_id` | TEXT | 主キーの一部、`plugins.id` を参照、親の削除で連鎖削除 | プラグイン ID |
| `kind` | TEXT | 主キーの一部、`logo`・`image` のいずれか | 画像の種類 |
| `blob_sha` | TEXT | NOT NULL | GitHub の blob の SHA。変わったときだけダウンロードし直す |
| `content_type` | TEXT | NOT NULL | `image/png`・`image/jpeg`・`image/gif`・`image/webp` のいずれか。先頭のバイト列から判定した値 |
| `width` | INTEGER | NOT NULL | 幅の px 数 |
| `height` | INTEGER | NOT NULL | 高さの px 数 |
| `bytes` | BLOB | NOT NULL | 画像の本体。外部データ |
| `fetched_at` | TEXT | NOT NULL | 取得した日時 |

画像は `/plugins/<owner>/<repo>/logo` と `/plugins/<owner>/<repo>/image` で配信します。URL のクエリに blob の SHA を付け、画像が変わったときに閲覧者のキャッシュを使わせないようにします。配信するのは掲載中のプラグインで、`images_hidden` が 0 のときだけです。応答には、ほかの画面と同じ `Content-Security-Policy` と `X-Content-Type-Options: nosniff` を付けます。

## plugin_image_previews

説明の画像から定期処理が作った、表示用の WebP の画像を保存します。

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `plugin_id` | TEXT | 主キー、`plugins.id` を参照、親の削除で連鎖削除 | プラグイン ID |
| `source_sha` | TEXT | NOT NULL | 元にした説明の画像の blob の SHA。`plugin_images` の値と違えば作り直す |
| `width` | INTEGER | NOT NULL | 幅の px 数 |
| `height` | INTEGER | NOT NULL | 高さの px 数 |
| `bytes` | BLOB | NOT NULL | WebP の画像の本体 |
| `made_at` | TEXT | NOT NULL | 作った日時 |

表示用の画像は `/plugins/<owner>/<repo>/preview` で配信します。配信の条件と応答ヘッダーは、説明の画像と同じです。

## download_snapshots

プラグインの GitHub でのダウンロード数を、1 日 1 回記録します。

| 列 | 型 | 制約 | 内容 |
| --- | --- | --- | --- |
| `plugin_id` | TEXT | 主キーの一部、`plugins.id` を参照、親の削除で連鎖削除 | プラグイン ID |
| `day` | TEXT | 主キーの一部 | 記録した日 (UTC)。`YYYY-MM-DD` の形 |
| `total` | INTEGER | NOT NULL | 新しい順に最大 100 件のリリースのうち、下書きを除くものの配布物の `download_count` の合計 |

