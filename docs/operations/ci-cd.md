# CI と配備

GitHub Actions のワークフローの目的と権限、依存の更新、本番の配備の手順です。ワークフローは `.github/workflows/` に、Dependabot の設定は `.github/dependabot.yml` にあります。

## ワークフローの一覧

| ファイル | 目的 | 起動の条件 | 権限 |
| --- | --- | --- | --- |
| `ci.yml` | 静的検査とテスト、中身の検査のスクリプトのテスト、ワークフローの検査、依存の脆弱性の検査 | PR、`main` への push | `contents: read` |
| `codeql.yml` | CodeQL によるコードの脆弱性の検査 | PR、`main` への push、毎週月曜 04:23 UTC | ワークフローは `contents: read`。ジョブに `security-events: write` と `actions: read` を加える |
| `deploy.yml` | 本番への D1 のマイグレーションの適用と Worker の配備 | 手動実行 `workflow_dispatch` だけ | `contents: read`。environment `production` の秘密情報を使う |
| `verify.yaml` | 配布物の証明の検証とアーカイブの中身の検査。結果を Worker へ送る | Worker の定期処理からの `workflow_dispatch`、予備の schedule (毎時 7・22・37・52 分) | `contents: read` と `id-token: write` |
| `macos-signing-probe.yaml` | macOS の署名と公証の判定の方法を、標本の配布物で確かめる検証用のワークフロー | 手動実行 `workflow_dispatch` だけ | `contents: read` |

### ci.yml

`ci.yml` は 4 つのジョブを持ちます。同じブランチで新しい実行が始まると、古い実行を取り消します。

| ジョブ | 内容 |
| --- | --- |
| `test` | Node.js 24 で `npm ci`・`npm run lint`・`npm run typecheck`・`npm test` を実行する |
| `inspect-archive` | `.github/scripts/` の中身の検査のスクリプトのテストを、Python の `unittest` で実行する。標本の配布物はリポジトリに含めないため、標本との突き合わせは行わない |
| `actionlint` | ワークフローの記述を actionlint で検査する |
| `dependency-review` | PR だけで実行する。PR が追加する依存に重大度 high 以上の脆弱性があれば失敗する |

### codeql.yml

`codeql.yml` は、`javascript-typescript` をビルドなしで解析します。結果は GitHub の Code scanning に送ります。GitHub の個人アカウントの private リポジトリでは Code scanning を使えないため、リポジトリが private の間は、解析の後の結果の送信で失敗します。

### deploy.yml

`deploy.yml` は、手動実行だけで起動します。実行の順序は次のとおりです。

1. `npm ci` と `npm test` を実行する。
2. `wrangler d1 migrations apply DB --remote --env production` で、本番の D1 にマイグレーションを適用する。
3. `wrangler deploy --env production` で Worker を配備する。

ジョブは environment `production` で動作します。配備は同時に 1 つだけ実行し、実行中の配備を取り消しません。

### verify.yaml

`verify.yaml` は、検証を待つ配布物の一覧を Worker の `/internal/checks/pending` から受け取り、配布物ごとに SHA-256 の照合・証明の検証・アーカイブの中身の検査を行います。結果は `/internal/checks/results` へ送ります。どちらの要求にも、`aud` を `audio-soko-kun` にした GitHub Actions の OIDC のトークンを添えます。Worker は、このリポジトリの `main` で動作する `verify.yaml` のトークンだけを受け付けます。そのため、ジョブは `main` で起動したときだけ実行します。

送り先は、ワークフローの `env` の `SOKO_KUN_ORIGIN` にある本番の URL `https://audio-soko-kun.allegromoltov.jp` です。配布物は 1 件ずつ最大 2 GiB まで取得し、処理を終えるたびに削除します。ジョブの最初にランナーの空き容量を確かめ、3 GiB に満たなければその回の処理を行いません。ジョブの時間の上限は 20 分です。同時に 1 つだけ実行し、実行中の検証を取り消しません。検査の規則は [検査と同期](../design/scanning.md) に記載しています。

Worker の定期処理は、15 分ごとの起動の最後に、検証を待つ配布物があるときだけ `verify.yaml` を起動します。起動には、後述の `GITHUB_DISPATCH_TOKEN` を使います。

### macOS の署名と公証の判定

`macos-signing-probe.yaml` は、macOS のランナーで標本の配布物を取得し、`codesign`・`spctl`・`xcrun stapler` の出力を Actions の成果物 `macos-signing-probe` として保存します。結果を Worker へ送りません。

macOS の署名と公証の判定を本番で行うワークフロー `macos-verify.yaml` は、まだリポジトリにありません。それまでの間、macOS 向けのバンドルを含むアーカイブは判定待ちのまま残り、そのアーカイブを含む版は掲載されません。

## fork の PR の扱い

fork から送られた PR でも安全にワークフローを実行するため、次の規則を守ります。

- PR で起動するワークフローは `pull_request` で起動します。`pull_request` では、GitHub は fork の PR に秘密情報を渡しません。
- `ci.yml` と `codeql.yml` は秘密情報を使いません。environment の秘密情報を使うのは `deploy.yml` だけです。
- `actions/checkout` には `persist-credentials: false` を指定し、ジョブの中に GitHub のトークンを残しません。
- `pull_request_target` で起動するワークフローを追加しないでください。`pull_request_target` は、fork の PR のコードを秘密情報のある環境で実行できてしまいます。

## Actions の固定と依存の更新

ワークフローが使う Actions は、タグではなくコミット SHA で指定します。SHA の後ろには、対応する版をコメントで添えます。タグが書き換えられても、検証済みの版だけが動作します。

```yaml
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

Dependabot は、毎週、次の 2 種類の更新の PR を作ります。

| 対象 | まとめ方 | 上限 |
| --- | --- | --- |
| npm | 本番の依存と開発用の依存を、それぞれ 1 つの PR にまとめる | 開いている PR は 5 件まで |
| GitHub Actions | すべての Actions を 1 つの PR にまとめる。SHA とコメントの版を更新する | 既定値 |

Dependabot の PR も CI を通してからマージします。

## Worker の設定

`deploy.yml` と管理用スクリプトの `--remote` は、`wrangler.jsonc` の `production` 環境を使います。`production` 環境には、本番の `ORIGIN`・D1 の `database_id`・KV の `id`・Workers AI の binding (`AI`)・独自ドメイン `audio-soko-kun.allegromoltov.jp` の `routes` を設定します。環境ごとの設定には既定の環境の binding が引き継がれないため、`ai` も `production` 環境に書きます。Cron の `triggers` と `observability` は、既定の環境から引き継がれます。

| 項目 | 値 |
| --- | --- |
| Worker の名前 | `audio-plugin-soko-kun` |
| D1 のデータベースの名前 | `audio-plugin-soko-kun` |
| D1 の binding | `DB` |
| KV の binding | `OAUTH_KV` |
| Cron | `*/15 * * * *` |
| 本番の `ORIGIN` | `https://audio-soko-kun.allegromoltov.jp` |

`production` 環境の `database_id` と KV の `id` は、本番のリソースを作るまで仮の値 `TO_BE_CREATED_IN_S2` です。作り方は後述の初回の配備に記載します。

Worker の秘密情報は、`wrangler secret put` で本番の Worker に設定します。

| 名前 | 必須 | 用途 |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | 必須 | GitHub OAuth App の Client ID |
| `GITHUB_CLIENT_SECRET` | 必須 | GitHub OAuth App の Client secret |
| `MALWAREBAZAAR_AUTH_KEY` | 任意 | MalwareBazaar の Auth-Key。無いと照会を行わず、登録したプラグインは検査待ちのまま残る |
| `GITHUB_DISPATCH_TOKEN` | 任意 | `verify.yaml` を起動するトークン。無いと Worker から起動せず、予備の schedule だけが残る |
| `CONTACT_EMAIL` | 任意 | 開発者の連絡先。無いと、連絡先を表示するボタンは準備中である旨を表示する |

```sh
npx wrangler secret put GITHUB_CLIENT_ID --env production
npx wrangler secret put GITHUB_CLIENT_SECRET --env production
npx wrangler secret put MALWAREBAZAAR_AUTH_KEY --env production
npx wrangler secret put GITHUB_DISPATCH_TOKEN --env production
npx wrangler secret put CONTACT_EMAIL --env production
```

本番用の GitHub OAuth App の Authorization callback URL には、`https://audio-soko-kun.allegromoltov.jp/callback` を指定します。認可の流れは [認証と認可](../design/auth.md) に記載しています。

### 証明の検証のワークフローを起動するトークン

`GITHUB_DISPATCH_TOKEN` は、Worker の定期処理が `verify.yaml` を `workflow_dispatch` で起動するためのトークンです。GitHub の Settings の Developer settings で、fine-grained personal access token を次の設定で作ります。

| 項目 | 設定 |
| --- | --- |
| Resource owner | AllegroMoltoV |
| Expiration | 1 年 |
| Repository access | Only select repositories で `AllegroMoltoV/audio-plugin-soko-kun` だけ |
| Repository permissions | Actions を Read and write。Metadata の Read は自動で付く。ほかは付けない |

作ったトークンを `npx wrangler secret put GITHUB_DISPATCH_TOKEN --env production` で設定します。期限の 2 週間前に、同じ設定で新しいトークンを作って設定し直し、古いトークンを削除します。

定期処理は、起動のたびに `{"event":"cron",...}` の形のログを 1 行出力します。このログの `verifyDispatch` が起動の結果を示します。

| 値 | 意味 |
| --- | --- |
| `dispatched` | 起動した |
| `skipped_no_pending` | 検証を待つ配布物が無いため起動しなかった |
| `skipped_no_token` | `GITHUB_DISPATCH_TOKEN` が設定されていない |
| `failed_<状態コード>` | GitHub API が失敗を返した。期限切れや権限の不足では `failed_401` か `failed_403` になる |
| `failed_network` | GitHub API へ接続できなかった |

起動に失敗し続けると、証明の検証は予備の schedule が動作したときにしか進みません。このとき、管理コマンド `npm run admin -- pending --remote` の `attestations_waiting` が 0 より大きいまま残ります。本番のログは、次のコマンドで追えます。

```sh
npx wrangler tail --env production
```

## 初回の配備

初回の配備では、本番の D1 と KV を作り、`wrangler.jsonc` に ID を書いてから、ローカルの `wrangler` で配備します。GitHub の個人アカウントの private リポジトリでは environment の承認のルールと environment の secret を使えないため、リポジトリを public にする前の配備はこの方法で行います。`wrangler` は、`wrangler login` で得た OAuth トークンで認証します。

1. 本番の D1 と KV を作ります。

   ```sh
   npx wrangler d1 create audio-plugin-soko-kun
   npx wrangler kv namespace create OAUTH_KV
   ```

2. 出力の D1 の `database_id` と KV の `id` を、`wrangler.jsonc` の `production` 環境の `TO_BE_CREATED_IN_S2` と置き換え、`main` に反映します。
3. 前述の秘密情報を設定します。
4. マイグレーションを適用し、Worker を配備します。

   ```sh
   npx wrangler d1 migrations apply DB --remote --env production
   npx wrangler deploy --env production
   ```

5. `https://audio-soko-kun.allegromoltov.jp/` と `https://audio-soko-kun.allegromoltov.jp/mcp` が応答することを確認します。

## public にした後に設定する項目

次の項目は、リポジトリと Cloudflare の設定です。CI からは設定しません。リポジトリを public にしたら、2 回目以降の配備の前に、すべて設定します。

### リポジトリの設定

| 項目 | 設定 |
| --- | --- |
| ブランチ保護 | ruleset で `main` を保護する。ブランチの削除と force push を禁じる。PR を必須にし、マージには `test`・`inspect-archive`・`actionlint`・`dependency-review`・`analyze` の成功を求める |
| Secret scanning | 有効にする |
| Push protection | 有効にする。秘密情報を含む push を拒否する |
| Dependabot alerts と Dependabot security updates | 有効にする。security updates は、脆弱性のある依存を直す PR を、毎週の更新とは別に作る |
| Private vulnerability reporting | 有効にする。`/report` で案内する非公開の通報の受付先である |
| environment `production` | 承認を必須にする保護ルールを設定する。配備できるブランチを `main` に限る |

### environment production の秘密情報と変数

| 名前 | 種類 | 内容 |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | environment の secret | Cloudflare の API トークン。権限は、アカウントの Workers Scripts の編集と D1 の編集、ゾーン allegromoltov.jp の Workers Routes の編集に限る。Workers Routes の編集は、独自ドメイン (`routes` の `custom_domain`) を含む配備に必要である |
| `CLOUDFLARE_ACCOUNT_ID` | environment の変数 | Cloudflare のアカウント ID |

`deploy.yml` は、`CLOUDFLARE_API_TOKEN` を `secrets` から、`CLOUDFLARE_ACCOUNT_ID` を `vars` から読みます。

## 2 回目以降の配備

2 回目以降の配備は、`deploy.yml` で行います。承認のルールにより、配備の前に内容を確かめる機会を設けます。

1. GitHub の Actions の画面で `Deploy` を選び、`main` を指定して実行します。
2. environment `production` の承認を求められたら、内容を確認して承認します。
3. ジョブの成功を確認します。
4. `https://audio-soko-kun.allegromoltov.jp/` と `https://audio-soko-kun.allegromoltov.jp/mcp` が応答することを確認します。
