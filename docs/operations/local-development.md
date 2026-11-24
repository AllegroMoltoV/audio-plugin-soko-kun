# ローカルでの開発

手元の PC で Worker を起動し、Web カタログ・MCP・Cron の定期処理を確かめる手順です。ローカルの D1 と KV は、`wrangler` が `.wrangler/state/` に作ります。

Workers AI だけは、ローカルでも実環境を呼びます。説明文の機械翻訳と新しい版の LLM のレビューが Workers AI を使うためです。そのため、`wrangler login` で Cloudflare にログインしておく必要があります。呼び出しの分だけ、`wrangler login` でログインしたアカウントの Workers AI を消費します。ローカルには `AI_GATEWAY_ID` が無く、呼び出しは AI Gateway を通らないため、ゲートウェイの支出の上限では止まりません。

## 前提

- Node.js 24 と npm が使えること。CI も Node.js 24 で動作させています。
- ローカル用の GitHub OAuth App を作成済みであること。Authorization callback URL には `http://localhost:8787/callback` を指定します。
- 検査の照会を確かめる場合は、MalwareBazaar の Auth-Key を取得済みであること。
- 中身の検査のスクリプトのテストを実行する場合は、Python 3 が使えること。スクリプトは標準ライブラリだけを使います。

## 依存の導入

`package-lock.json` のとおりに依存を導入します。リポジトリの直下で次を実行します。

```sh
npm ci
```

## 秘密情報の設定

秘密情報は、リポジトリの直下の `.dev.vars` に置きます。`.dev.vars` は `.gitignore` で git の追跡対象から外しています。

```sh
GITHUB_CLIENT_ID=<ローカル用の GitHub OAuth App の Client ID>
GITHUB_CLIENT_SECRET=<ローカル用の GitHub OAuth App の Client secret>
MALWAREBAZAAR_AUTH_KEY=<MalwareBazaar の Auth-Key>
CONTACT_EMAIL=<開発者の連絡先のメールアドレス>
```

`MALWAREBAZAAR_AUTH_KEY` は省略できます。鍵が無いときは照会を行いません。その場合、登録したプラグインは検査待ちのまま残ります。`CONTACT_EMAIL` を省略すると、連絡先を表示するボタンは連絡先を準備中である旨を表示します。

`GITHUB_DISPATCH_TOKEN` は、ローカルでは設定しません。`verify.yaml` と `macos-verify.yaml` は本番の Worker にだけ結果を送るため、ローカルの Worker から起動しても検証は進みません。トークンが無いとき、定期処理はどちらのワークフローも起動しません。

`ORIGIN` は、`wrangler.jsonc` の `vars` で `http://localhost:8787` に設定しています。

## データベースの作成

ローカルの D1 に、`migrations/` 配下のマイグレーションを適用します。`npm run db:migrate:local` は `wrangler d1 migrations apply DB --local` を実行します。

```sh
npm run db:migrate:local
```

マイグレーションを追加したときも、同じコマンドで未適用のものだけを適用します。

## Worker の起動

Worker を起動します。`npm run dev` は `wrangler dev` を実行します。

```sh
npx wrangler dev
```

起動後は、ブラウザーで `http://localhost:8787/` を開くと Web カタログを表示できます。MCP のエンドポイントは `http://localhost:8787/mcp` です。

ローカルでは、配布物の検証の受け口 `/internal/checks/` と `/internal/macos-checks/` を試せません。受け口は、本サービスのリポジトリの `main` で動作する `verify.yaml` と `macos-verify.yaml` の OIDC のトークンだけを受け付けるためです。受け口の処理は、自動テストで確かめます。

## Cron の手動実行

ローカルでは Cron Trigger が自動で起動しません。定期処理を確かめるには、`--test-scheduled` を付けて Worker を起動します。

```sh
npx wrangler dev --test-scheduled
```

別の端末から `/__scheduled` へ要求を送ると、定期処理が 1 回動作します。

```sh
curl "http://localhost:8787/__scheduled?cron=*/15+*+*+*+*"
```

`wrangler dev` の端末には、`{"event":"cron",...}` の形の行が出力されます。この行の項目は次のとおりです。

| 項目 | 内容 |
| --- | --- |
| `scanned` | MalwareBazaar へ照会した件数 |
| `synced`・`failed` | 同期した件数と、同期に失敗した件数 |
| `releasesChecked` | 新しい版の検査を行った件数 |
| `releaseChecksSkipped` | 新しい版の検査を打ち切った理由。予算の超過は `budget`、GitHub の異常は `github_` で始まる。検査を打ち切っても後段の同期は進む |
| `downloadsRecorded`・`downloadsFailed` | ダウンロード数を記録した件数と、記録に失敗して記録しなかった件数 |
| `translated` | 説明文を翻訳した件数 |
| `previews` | 説明の画像から詳細ページ向けの軽い画像を作った件数 |
| `subrequests`・`d1Queries` | 使った外部呼び出しと D1 のクエリの件数 |
| `stoppedBy` | 処理を途中で止めた理由。GitHub の異常は `github_` で、予算の不足は `budget_` で始まる |
| `verifyDispatch`・`macosVerifyDispatch` | `verify.yaml` と `macos-verify.yaml` の起動の結果。ローカルでは `skipped_no_token` になる |
| `adminNotify` | 管理者の確認待ちと登録の通知の結果。値の意味は [管理コマンドと掲載停止](suspend.md) に記載する。`.dev.vars` に `DISCORD_WEBHOOK_URL` が無いと `skipped_no_url` になる |

`.dev.vars` に `DISCORD_WEBHOOK_URL` を置くと、ローカルの定期処理も Discord へ通知します。本番と同じ URL を置くと本番の通知と混ざるため、置かないか、試しのチャンネルの URL を置きます。テストはこの値を読みません。

## テストと静的検査

変更を提出する前に、次のコマンドを実行します。CI も同じコマンドを実行します。

```sh
npm test
npm run typecheck
npm run lint
```

`npm test` は、`wrangler.jsonc` の `test` 環境を使い、Miniflare 上でテスト用の値を与えて動作します。`.dev.vars` の秘密情報は使いません。外部の API への要求はテストの中で模擬します。`test` 環境には Workers AI の binding が無いため、テストは Workers AI を呼びません。

`.github/scripts/` の中身の検査・macOS の判定・通信の検出のスクリプトを変えたときは、そのテストも実行します。

```sh
python3 -I -B -m unittest discover -s .github/scripts -p "test_*.py" -v
```

## MCP クライアントからの接続

ローカルの Worker に MCP クライアントを接続すると、`search_plugins`・`get_plugin`・`submit_plugin`・`list_my_plugins` を会話から呼び出せます。`search_plugins` と `get_plugin` はサインインなしで使えます。`submit_plugin` と `list_my_plugins` には、GitHub でのサインインが必要です。

### Claude Code

次のコマンドで MCP サーバーを追加します。

```sh
claude mcp add --transport http audio-plugin-soko-kun http://localhost:8787/mcp
```

サインインが必要なツールを使う前に、Claude Code で `/mcp` を実行し、`audio-plugin-soko-kun` を選んでサインインします。ブラウザーで同意画面と GitHub の認可画面を経ると、サインインが終わります。

### Codex

次のコマンドで MCP サーバーを追加します。

```sh
codex mcp add audio-plugin-soko-kun --url http://localhost:8787/mcp
```

このサーバーは検索と詳細の取得をサインインなしで受け付けます。そのため、`codex mcp add` はサインインの要否を判定できず、自動ではサインインを始めません。サインインが必要なツールを使う前に、次のコマンドでサインインします。

```sh
codex mcp login audio-plugin-soko-kun
```

## 管理用スクリプトの実行

管理用スクリプトは、`--remote` を付けない場合にローカルの D1 を更新します。使い方は [管理コマンドと掲載停止](suspend.md) に記載しています。

```sh
npm run admin -- show <owner/repo>
```
