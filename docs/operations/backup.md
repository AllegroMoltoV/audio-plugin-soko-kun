# バックアップと復元

本番の D1 のデータを守る手順です。プラグインの情報の正は GitHub にありますが、検査結果・管理停止・止めた版の記録・掲載の期間は D1 にしかありません。そのため、D1 を誤って更新した場合に備えて、復元の手段を用意します。D1 に保存する表の一覧は [データモデル](../design/data-model.md) に記載しています。

D1 のバックアップには、自動で記録される Time Travel と、手動で取得する `wrangler d1 export` の 2 つを使います。OAuth の状態を置く KV は、どちらの対象にもなりません。

本番の D1 のデータベースの名前は `audio-plugin-soko-kun` です。本文のコマンドは、`wrangler.jsonc` の `production` 環境に本番の D1 の `database_id` が設定されている必要があります。

## Time Travel

Time Travel は、D1 が変更の履歴を自動で記録する機能です。設定は不要です。過去の任意の時点へデータベースを戻せます。

戻せる期間は、Workers Free プランで 7 日、Workers Paid プランで 30 日です。本サービスのアカウントは Workers Paid のため、30 日です。出典は Cloudflare の公式文書 [D1 の Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) で、2026-11-14 に確認しました。

### 復元の前の確認

復元は取り消しの手段を残してから行います。

1. 戻したい時点のブックマークを取得します。`--timestamp` には UNIX 時刻または RFC 3339 の日時を指定します。

   ```sh
   npx wrangler d1 time-travel info audio-plugin-soko-kun --env production --timestamp="2026-11-14T00:00:00+00:00"
   ```

2. 現在のデータを `wrangler d1 export` で保存します。手順は後述の手動のエクスポートにしたがいます。

### 復元

復元は、データベースをその場で上書きする破壊的な操作です。実行中のクエリは取り消され、要求元はエラーを受けます。

```sh
npx wrangler d1 time-travel restore audio-plugin-soko-kun --env production --timestamp="2026-11-14T00:00:00+00:00"
```

復元の出力は、復元の直前の状態を示すブックマークを含みます。復元を取り消す場合は、このブックマークを `--bookmark` に指定して再び復元します。

### 復元の後の確認

指定した時点より後に行った操作と登録は、復元で失われます。次の順で確かめ、必要な操作をやり直します。

1. 指定した時点より後に行った管理コマンドの操作を、`npm run admin -- show <owner/repo> --remote` で確かめます。対象は、停止と再開・版の停止・版の承認・`set-category`・`hide-images` と `show-images` です。失われた操作は、やり直します。
2. 指定した時点より後に登録されたプラグインは、復元で失われます。登録者は `submit_plugin` で登録し直す必要があります。
3. リリースと配布物の情報は、Cron の同期で GitHub から取り直されます。証明の検証と中身の検査の結果は、検証を待つ配布物として `verify.yaml` が、macOS の判定の結果は `macos-verify.yaml` が改めて処理します。

## 手動のエクスポート

`wrangler d1 export` は、データベースのスキーマとデータを SQL のファイルに書き出します。大きな変更の前や、Time Travel の期間より長く残したい時点で取得します。

```sh
npx wrangler d1 export audio-plugin-soko-kun --env production --remote --output=<保存先>/2026111401-d1.sql
```

エクスポートの実行中は、データベースへのほかの要求が待たされます。利用の少ない時間帯に実行します。

書き出したファイルは、登録者の GitHub のユーザー ID と、送信元 IP アドレスのハッシュを含みます。リポジトリの外に保存し、git の追跡対象に含めないでください。

| オプション | 内容 |
| --- | --- |
| `--table=<テーブル名>` | 指定したテーブルだけを書き出す |
| `--no-schema` | `CREATE` 文を含めず、データだけを書き出す |
| `--no-data` | データを含めず、スキーマだけを書き出す |

### エクスポートからの復元

書き出したファイルは、`wrangler d1 execute` の `--file` で投入します。ファイルは `CREATE TABLE` 文を含むため、テーブルの無い空のデータベースへ投入します。

```sh
npx wrangler d1 execute audio-plugin-soko-kun --env production --remote --file=<保存先>/2026111401-d1.sql
```

出典は Cloudflare の公式文書 [D1 のインポートとエクスポート](https://developers.cloudflare.com/d1/best-practices/import-export-data/) で、2026-11-14 に確認しました。
