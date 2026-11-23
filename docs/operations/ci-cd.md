# CI と配備

GitHub Actions のワークフローの目的と権限、依存の更新、本番の配備の手順です。ワークフローは `.github/workflows/` に、Dependabot の設定は `.github/dependabot.yml` にあります。

## ワークフローの一覧

| ファイル | 目的 | 起動の条件 | 権限 |
| --- | --- | --- | --- |
| `ci.yml` | 静的検査とテスト、`.github/scripts/` のスクリプトのテスト、ワークフローの検査、依存の脆弱性の検査 | PR、`main` への push | `contents: read` |
| `codeql.yml` | CodeQL によるコードの脆弱性の検査 | PR、`main` への push、毎週月曜 04:23 UTC | ワークフローは `contents: read`。ジョブに `security-events: write` と `actions: read` を加える |
| `deploy.yml` | 本番への D1 のマイグレーションの適用と Worker の配備 | 手動実行 `workflow_dispatch` だけ | `contents: read`。environment `production` の秘密情報を使う |
| `verify.yaml` | 配布物の証明の検証とアーカイブの中身の検査、新しい版のソースからの通信の API の検出。結果を Worker へ送る | Worker の定期処理からの `workflow_dispatch`、予備の schedule (毎時 7・22・37・52 分) | ワークフローは `contents: read`。Worker と通信するジョブ `prepare` と `report` だけに `id-token: write` を加える |
| `macos-verify.yaml` | macOS 向けのバンドルの Developer ID の署名と Apple の公証の判定。結果を Worker へ送る | Worker の定期処理からの `workflow_dispatch`、予備の schedule (毎時 12・27・42・57 分) | ワークフローは `contents: read`。Worker と通信するジョブ `prepare` と `report` だけに `id-token: write` を加える |
| `macos-signing-probe.yaml` | macOS の署名と公証の判定の方法を、標本の配布物で確かめる検証用のワークフロー | 手動実行 `workflow_dispatch` だけ | `contents: read` |

### ci.yml

`ci.yml` は 4 つのジョブを持ちます。同じブランチで新しい実行が始まると、古い実行を取り消します。

| ジョブ | 内容 |
| --- | --- |
| `test` | Node.js 24 で `npm ci`・`npm run lint`・`npm run typecheck`・`npm test` を実行する |
| `inspect-archive` | `.github/scripts/` の中身の検査・macOS の判定・通信の検出のスクリプトのテストを、Python の `unittest` で実行する。標本の配布物はリポジトリに含めないため、標本の配布物との突き合わせは行わない。macOS の判定のテストは、検証 A2 と V2 の `codesign` と `spctl` の出力の抜粋をリポジトリに置いて使う |
| `actionlint` | ワークフローの記述を actionlint で検査する |
| `dependency-review` | PR だけで実行する。PR が追加する依存に重大度 high 以上の脆弱性があれば失敗する |

### codeql.yml

`codeql.yml` は、`javascript-typescript` と `python` をビルドなしで解析します。`python` は、第三者の zip を読む `.github/scripts/inspect_archive.py` と `.github/scripts/macos_judge.py` を対象にするためです。必須のチェック `analyze` の名前を保つため、2 つの言語を 1 つのジョブで解析します。結果は GitHub の Code scanning に送ります。

### deploy.yml

`deploy.yml` は、手動実行だけで起動します。実行の順序は次のとおりです。

1. `npm ci` と `npm test` を実行する。
2. `wrangler d1 migrations apply DB --remote --env production` で、本番の D1 にマイグレーションを適用する。
3. `wrangler deploy --env production` で Worker を配備する。

ジョブは environment `production` で動作します。配備は同時に 1 つだけ実行し、実行中の配備を取り消しません。

### verify.yaml

`verify.yaml` は 3 つのジョブに分かれます。第三者の配布物とソースを処理するジョブ `scan` には `id-token: write` を付けません。MCP Registry は OIDC のトークンの `repository_owner` だけで `io.github.AllegroMoltoV/*` の公開権限を与えます。そのため、`scan` で動くツール (git・gh・grep・node・jq) の脆弱性を突かれた場合に、Registry の登録を書き換えられるトークンを発行させないためです。GitHub が用意するランナーはジョブごとに別の仮想マシンで動くため、ジョブを分ければ、トークンを取る環境と第三者のデータを処理する環境を分けられます。Worker の OIDC の照合は `job_workflow_ref` などを見て、ジョブの名前を見ないため、受け口は変えません。

| ジョブ | 権限 | 内容 |
| --- | --- | --- |
| `prepare` | `contents: read`、`id-token: write` | 受け口から検証待ちの一覧を受け取り、artifact で `scan` へ渡す。検証待ちが無ければ、`scan` と `report` を実行しない |
| `scan` | `contents: read` | 最初に OIDC のトークンを要求する環境変数が無いことを確かめる。配布物の取得と SHA-256 の照合、証明の検証、中身の検査、ソースの取得と通信の API の検出、文書の照合を行い、送る結果をジョブの出力で `report` へ渡す |
| `report` | `id-token: write` | `scan` の結果を解析せずにそのまま受け口へ送る。形の検証は受け口が行う。チェックアウトしない |

この分け方では、`scan` を乗っ取られた場合の結果の改ざんは防げません。`report` は、`scan` が作った結果をそのまま本サービスのトークンを付けて送ります。

一覧は、旧い名前を配布物ごとに繰り返すため大きくなることがあります。ジョブの出力は次のジョブで環境変数になり、Linux では 1 つあたり 128 KiB までです。そのため `prepare` から `scan` へは artifact で渡します。`scan` から `report` へは、第三者のデータに由来する zip を `report` で展開しないよう、ジョブの出力で渡します。`scan` は結果を ASCII だけの JSON にして 100,000 バイトずつ最大 8 個の出力に分け、`report` がつなぎ直します。`scan` は、中身の検査・通信の検出・文書の照合の結果を `jq` の引数ではなくファイルで渡します。引数にすると、1 件で約 300 KB になる結果が引数の上限を超えるためです。

8 個の合計 800,000 バイトを超えるときは、通信の検出の結果と中身の検査の結果のうち本文が最も大きい 1 つを `error` (中身の検査は `result_too_large`) に置き換え、収まるまで繰り返します。中身の検査は 1 件で 300 KB を超えうるため、巨大な配布物は、ほかの作者の小さい結果より先に置き換わります。失敗で止めると受け口に何も届かず試行の回数も増えないため、同じ一覧で失敗を繰り返し、ほかのプラグインの証明の検証まで止まるためです。置き換えた結果は受け口が試行として数え、使い切ると既存の扱いへ進みます。`scan` が空き容量の不足で早く終わった回は本文が無く、`report` は何も送りません。

`scan` は、当たりのファイル名を受け口が受け付ける形に整えてから送ります。受け口は、改行や NUL を含むか 200 文字を超えるファイル名の当たりを捨てるためです。改行・CR・NUL は `?` に置き換え、100 文字を超える名前は末尾の 99 文字を残して先頭を `…` にします。

ジョブの内容は次のとおりです。`prepare` と `scan` を合わせると、`verify.yaml` は、検証を待つ配布物の一覧を Worker の `/internal/checks/pending` から受け取り、配布物ごとに SHA-256 の照合・証明の検証・アーカイブの中身の検査を行います。続けて、通信の検出を待つ版ごとに、版のコミットのソースを取得して通信の API を探します。結果は `/internal/checks/results` へまとめて 1 回で送ります。どちらの要求にも、`aud` を `audio-soko-kun` にした GitHub Actions の OIDC のトークンを添えます。Worker は、このリポジトリの `main` で動作する `verify.yaml` のトークンだけを受け付けます。そのため、ジョブは `main` で起動したときだけ実行します。

送り先は、ワークフローの `env` の `SOKO_KUN_ORIGIN` にある本番の URL `https://audio-soko-kun.allegromoltov.jp` です。配布物は 1 件ずつ最大 2 GiB まで取得し、処理を終えるたびに削除します。`scan` の最初にランナーの空き容量を確かめ、3 GiB に満たなければその回の処理を行いません。`scan` の時間の上限は 40 分です。`scan` の開始から 25 分を過ぎたら、新しい配布物と通信の検出のソースを取得せず、次の回に回します。同時に 1 つだけ実行し、実行中の検証を取り消しません。検査の規則は [検査と同期](../design/scanning.md) に記載しています。

Worker の定期処理は、15 分ごとの起動の最後に、検証を待つ配布物か通信の検出を待つ版があるときだけ `verify.yaml` を起動します。起動には、後述の `GITHUB_DISPATCH_TOKEN` を使います。

### macos-verify.yaml

`macos-verify.yaml` も、`verify.yaml` と同じ理由で 3 つのジョブに分かれます。第三者の配布物を処理するジョブ `judge` には `id-token: write` を付けず、最初に OIDC のトークンを要求する環境変数が無いことを確かめます。

| ジョブ | ランナー | 権限 | 内容 |
| --- | --- | --- | --- |
| `prepare` | `ubuntu-latest` | `contents: read`、`id-token: write` | 受け口から判定待ちの一覧を受け取り、artifact で `judge` へ渡す。判定待ちが無ければ、`judge` と `report` を実行しない |
| `judge` | `macos-latest` | `contents: read` | 配布物の判定を行い、結果をジョブの出力 1 つで `report` へ渡す |
| `report` | `ubuntu-latest` | `id-token: write` | `judge` の結果を解析せずにそのまま受け口へ送る |

一覧は、配布物ごとにバンドルのパスを最大 200 件・各 1,024 字まで含むため、1 件で 100,000 バイトを超えることがあります。ジョブの出力の環境変数の上限 (128 KiB) に掛かるため、`prepare` から `judge` へは artifact で渡します。結果は 1 件あたり小さく、最大 50 件でも上限に収まるため、分けずに 1 つの出力で渡します。`judge` が空き容量の不足で早く終わった回は本文が無く、`report` は何も送りません。

`judge` は、macOS の判定を待つ配布物の一覧を `prepare` から受け取り、`macos-latest` のランナーで配布物ごとに SHA-256 の照合・zip の項目の確かめ・`ditto -x -k` による展開・バンドルごとの `codesign` と `spctl` の判定を行います。結果は `/internal/macos-checks/results` へまとめて 1 回で送ります。トークンの `aud` と、`main` で起動したときだけ実行する条件は `verify.yaml` と同じです。Worker は `macos-verify.yaml` のトークンだけを受け付け、`verify.yaml` のトークンでは macOS の結果を書けません。

配布物は 1 件ずつ最大 2 GiB まで取得し、展開したフォルダーとともに処理を終えるたびに削除します。`judge` の最初にランナーの空き容量を確かめ、7 GiB に満たなければその回の処理を行いません。`judge` の時間の上限は 40 分で、開始から 25 分を過ぎたら新しい配布物を取得しません。同時に 1 つだけ実行し、実行中の判定を取り消しません。秘密情報は使いません。配布物の中のコードは実行しません。ログに出すバンドルのパスと `spctl` の出力は外部データのため、`::stop-commands::` でワークフローのコマンドとして解釈させません。判定の規則は [検査と同期](../design/scanning.md) の「署名と公証の判定」に記載しています。

Worker の定期処理は、`verify.yaml` の起動を確かめた後に、macOS の判定を待つ配布物があるときだけ `macos-verify.yaml` を起動します。

### macos-signing-probe.yaml

`macos-signing-probe.yaml` は、検証 A2 と V2 で使った検証用のワークフローです。macOS のランナーで標本の配布物を取得し、`codesign`・`spctl`・`xcrun stapler` の出力を Actions の成果物 `macos-signing-probe` として保存します。結果を Worker へ送りません。

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

`deploy.yml` と管理用スクリプトの `--remote` は、`wrangler.jsonc` の `production` 環境を使います。`production` 環境には、本番の `ORIGIN`・Workers AI の呼び出しを通す AI Gateway の `AI_GATEWAY_ID`・D1 の `database_id`・KV の `id`・Workers AI の binding (`AI`)・独自ドメイン `audio-soko-kun.allegromoltov.jp` の `routes` を設定します。環境ごとの設定には既定の環境の binding が引き継がれないため、`ai` も `production` 環境に書きます。Cron の `triggers` と `observability` は、既定の環境から引き継がれます。

| 項目 | 値 |
| --- | --- |
| Worker の名前 | `audio-plugin-soko-kun` |
| D1 のデータベースの名前 | `audio-plugin-soko-kun` |
| D1 の binding | `DB` |
| KV の binding | `OAUTH_KV` |
| Cron | `*/15 * * * *` |
| 本番の `ORIGIN` | `https://audio-soko-kun.allegromoltov.jp` |
| 本番の `AI_GATEWAY_ID` | `soko-kun-ai`。配信プラグイン倉庫くんと共有するゲートウェイで、その支出の上限で 2 つのサービスの Workers AI の費用を止める ([アーキテクチャ](../design/architecture.md)) |

`production` 環境の `database_id` と KV の `id` には、2026-11-14 に作った本番のリソースの ID を書いています。Worker は `production` 環境の名前を付けた `audio-plugin-soko-kun-production` として配備されます。

Worker の秘密情報は、`wrangler secret put` で本番の Worker に設定します。

| 名前 | 必須 | 用途 |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | 必須 | GitHub OAuth App の Client ID |
| `GITHUB_CLIENT_SECRET` | 必須 | GitHub OAuth App の Client secret |
| `MALWAREBAZAAR_AUTH_KEY` | 任意 | MalwareBazaar の Auth-Key。無いと照会を行わず、登録したプラグインは検査待ちのまま残る |
| `GITHUB_DISPATCH_TOKEN` | 任意 | `verify.yaml` と `macos-verify.yaml` を起動するトークン。無いと Worker から起動せず、予備の schedule だけが残る |
| `CONTACT_EMAIL` | 任意 | 開発者の連絡先。無いと、連絡先を表示するボタンは準備中である旨を表示する |
| `DISCORD_WEBHOOK_URL` | 任意 | 管理者の確認待ちを知らせる Discord の webhook の URL。無いと通知しない |

```sh
npx wrangler secret put GITHUB_CLIENT_ID --env production
npx wrangler secret put GITHUB_CLIENT_SECRET --env production
npx wrangler secret put MALWAREBAZAAR_AUTH_KEY --env production
npx wrangler secret put GITHUB_DISPATCH_TOKEN --env production
npx wrangler secret put CONTACT_EMAIL --env production
npx wrangler secret put DISCORD_WEBHOOK_URL --env production
```

`DISCORD_WEBHOOK_URL` は、依頼者が Discord で管理者だけが見られるチャンネルを作り、そのチャンネルの連携サービスの設定で作った webhook の URL です。URL はチャットやファイルに残さず、依頼者が直接設定します。

本番用の GitHub OAuth App の Authorization callback URL には、`https://audio-soko-kun.allegromoltov.jp/callback` を指定します。認可の流れは [認証と認可](../design/auth.md) に記載しています。

### 検証のワークフローを起動するトークン

`GITHUB_DISPATCH_TOKEN` は、Worker の定期処理が `verify.yaml` と `macos-verify.yaml` を `workflow_dispatch` で起動するためのトークンです。2 つのワークフローは同じリポジトリにあるため、1 つのトークンで起動できます。GitHub の Settings の Developer settings で、fine-grained personal access token を次の設定で作ります。

| 項目 | 設定 |
| --- | --- |
| Resource owner | AllegroMoltoV |
| Expiration | 1 年 |
| Repository access | Only select repositories で `AllegroMoltoV/audio-plugin-soko-kun` だけ |
| Repository permissions | Actions を Read and write。Metadata の Read は自動で付く。ほかは付けない |

作ったトークンを `npx wrangler secret put GITHUB_DISPATCH_TOKEN --env production` で設定します。期限の 2 週間前に、同じ設定で新しいトークンを作って設定し直し、古いトークンを削除します。

定期処理は、起動のたびに `{"event":"cron",...}` の形のログを 1 行出力します。このログの `verifyDispatch` が `verify.yaml` の、`macosVerifyDispatch` が `macos-verify.yaml` の起動の結果を示します。

| 値 | 意味 |
| --- | --- |
| `dispatched` | 起動した |
| `skipped_no_pending` | 検証を待つ配布物が無いため起動しなかった。`macosVerifyDispatch` では、macOS の判定を待つ配布物が無い |
| `skipped_no_token` | `GITHUB_DISPATCH_TOKEN` が設定されていない |
| `failed_<状態コード>` | GitHub API が失敗を返した。期限切れや権限の不足では `failed_401` か `failed_403` になる |
| `failed_network` | GitHub API へ接続できなかった |

起動に失敗し続けると、証明の検証は予備の schedule が動作したときにしか進みません。このとき、管理コマンド `npm run admin -- pending --remote` の `attestations_waiting`・`contents_waiting`・`macos_waiting` が 0 より大きいまま残ります。本番のログは、次のコマンドで追えます。

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

2. 出力の D1 の `database_id` と KV の `id` を、`wrangler.jsonc` の `production` 環境に書き、`main` に反映します。
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
| ブランチ保護 | ruleset `main` で既定のブランチを保護する。ブランチの削除と force push を禁じる。PR を必須にし、マージには 1 名以上の承認と、`test`・`inspect-archive`・`actionlint`・`dependency-review`・`analyze` の成功を求める。依頼者の承認を得て `main` へ直接 push するときに限り、`gh` で ruleset を一時的に無効にし、push の後に有効へ戻す。手順は「main への直接の push」に記載する |
| タグの保護 | ruleset `release-tags` で、すべてのタグの作成・更新・削除を管理者に限る |
| Secret scanning | 有効にする |
| Push protection | 有効にする。秘密情報を含む push を拒否する |
| Dependabot alerts と Dependabot security updates | 有効にする。security updates は、脆弱性のある依存を直す PR を、毎週の更新とは別に作る |
| Private vulnerability reporting | 有効にする。`/report` で案内する非公開の通報の受付先である |
| environment `production` | 承認を必須にする保護ルールを設定する。配備できるブランチを `main` に限る |

### main への直接の push

`main` へは、PR を通して反映します。依頼者が承認した場合に限り、ruleset `main` を一時的に無効にして直接 push します。タグの ruleset `release-tags` は変えません。

1. ruleset `main` の ID と現在の設定を確かめ、設定を保存します。

   ```sh
   gh api repos/AllegroMoltoV/audio-plugin-soko-kun/rulesets --jq '.[] | {id, name, enforcement}'
   gh api repos/AllegroMoltoV/audio-plugin-soko-kun/rulesets/<id>
   ```

2. ruleset を無効にします。

   ```sh
   gh api -X PUT repos/AllegroMoltoV/audio-plugin-soko-kun/rulesets/<id> -f enforcement=disabled --jq .enforcement
   ```

3. `main` へ push します。
4. 直後に ruleset を有効へ戻し、出力が `active` であることを確かめます。push が失敗したときも戻します。

   ```sh
   gh api -X PUT repos/AllegroMoltoV/audio-plugin-soko-kun/rulesets/<id> -f enforcement=active --jq .enforcement
   ```

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
