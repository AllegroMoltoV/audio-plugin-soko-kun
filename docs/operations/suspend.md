# 管理コマンドと掲載停止

管理者がプラグインや版の掲載を止める手順、止めた掲載を再開する手順、確認待ちの版を承認する手順です。管理画面はありません。管理用スクリプト `scripts/admin.mjs` が `wrangler d1 execute` で D1 を直接更新します。

プラグインを停止すると、プラグインは Web の一覧と `search_plugins` から外れます。詳細ページと `get_plugin` は、状態と理由だけを示し、ダウンロードの案内を出しません。版を停止すると、その版は掲載されなくなり、告知ページ `/notices` とそのプラグインの詳細ページと `get_plugin` に警告が出ます。

## 前提

- `npm ci` で依存を導入済みであること。
- 本番の D1 を操作する場合は、`wrangler` が Cloudflare のアカウントへ認証済みであること。
- 本番の D1 を操作する場合は、`wrangler.jsonc` の `production` 環境に本番の D1 の `database_id` が設定されていること。`--remote` は `--env production` を付けて `wrangler` を呼び出します。

## コマンド

| 操作 | コマンド |
| --- | --- |
| 停止 | `npm run admin -- suspend <owner/repo> "<理由>"` |
| 再開 | `npm run admin -- resume <owner/repo>` |
| 状態の確認 | `npm run admin -- show <owner/repo>` |
| カテゴリの変更 | `npm run admin -- set-category <owner/repo> <category>` |
| 画像の非表示 | `npm run admin -- hide-images <owner/repo>` |
| 画像の再表示 | `npm run admin -- show-images <owner/repo>` |
| 確認待ちの版の一覧 | `npm run admin -- pending` |
| 確認待ちの版の承認 | `npm run admin -- approve-release <owner/repo> <tag>` |
| 版の停止 | `npm run admin -- suspend-release <owner/repo> <tag> "<告知の文>"` |
| 試行を使い切った検査のやり直し | `npm run admin -- retry-checks <owner/repo> <tag>` |

いずれのコマンドも、`--remote` を付けると本番の D1 を更新します。付けない場合はローカルの D1 を更新します。

`<owner/repo>` はプラグイン ID です。大文字と小文字を区別しません。登録したときの名前と、名前を変えた後の現在の名前のどちらでも指定できます。

引数の形は次のとおりです。形に合わない引数を渡すと、スクリプトは D1 を更新せずに終了します。

| 引数 | 形 |
| --- | --- |
| `<理由>` | 1〜200 文字。制御文字を含めない |
| `<category>` | `instrument`・`effect`・`analyzer`・`midi`・`utility` のいずれか |
| `<tag>` | 英数字・`.`・`-`・`_` の 100 文字以内 |
| `<告知の文>` | 1〜500 文字。制御文字を含めない |

停止の理由と告知の文は公開されます。通報者の名前や非公開の調査内容を書かないでください。

### 各コマンドの内容

`show` は、プラグインの `admin_suspended`・`suspended_reason`・`removed`・`images_hidden`・`last_synced_at` と、`listing_periods` の掲載の期間、`release_suspensions` の止めた版を表示します。

`set-category` は、自動で推定したカテゴリが誤っていたときに、管理者がカテゴリを直すコマンドです。

`hide-images` は、掲載を続けたままロゴと説明の画像だけを止めます。不適切な画像の通報を受けたときに使います。`show-images` で元に戻します。

`pending` は、まだ掲載していない新しい版のうち、管理者が承認しておらず、止めてもいない版を表示します。主な列は次のとおりです。

| 列 | 内容 |
| --- | --- |
| `waiting_minutes` | 版の公開からの経過時間 (分)。同期で見つけた版の宣言ファイル・ライセンス・差分の検査は、次の起動で始まる。レビューは通信の検出の結果を版の公開から最大 6 時間待つ。これを超えても `diff_state` や `review_state` が `pending` のままなら、定期処理のログの `releasesChecked`・`releaseChecksSkipped`・`stoppedBy` を確かめる |
| `diff_state`・`diff_hits` | 差分から判定した乗っ取りの兆候と、当たった項目 |
| `config_state` | 宣言ファイルの判定の状態 |
| `review_state`・`review_attempts`・`review_serious` | LLM のレビューの状態・試行の回数・重大な指摘の件数 |
| `serious_findings` | 重大な指摘の項目・説明・該当の箇所 |
| `attestations_waiting` | 証明の検証を待っている配布物の件数。`error` で終わり、試行が 3 回に満たない配布物も数える |
| `checks_exhausted` | 証明の検証・中身の検査・macOS の判定のいずれかが `error` のまま試行を 3 回使い切った配布物の件数。作者には `check_retries_exhausted` と返る |
| `attestations_failed` | 証明の検証に失敗した配布物の件数 |

`approve-release` は、乗っ取りの兆候・LLM のレビューの指摘・レビューの失敗・macOS の署名の Team ID の食い違いによる確認待ちを解きます。あわせて、同期で所有者の変更を検出したことによる確認待ちも解きます。証明・不変・配布の形・中身の検査・ライセンス・宣言ファイルの条件は解けません。証明の検証・中身の検査・macOS の判定が 3 回 `error` で終わった配布物を含む版も、承認だけでは掲載されません。原因を確かめてから `retry-checks` で検査し直します。確認待ちの理由と算出規則は [データモデル](../design/data-model.md) と [審査の基準](../design/review-criteria.md) に記載しています。

`suspend-release` は版を止め、告知の文とともに `release_suspensions` に記録します。同じ版にもう一度実行すると、告知の文を書き換えます。指定したタグのリリースが無いときは何も記録せず、出力の行が空になります。侵害が疑われるときの手順は [侵害の対応](incident-response.md) に記載しています。

## プラグインの停止

利用者への被害のおそれがあるときや、掲載の方針に反するときに、プラグイン全体の掲載を止めます。

1. 対象のプラグインの現在の値を確認します。

   ```sh
   npm run admin -- show <owner/repo> --remote
   ```

2. 理由を添えて停止します。

   ```sh
   npm run admin -- suspend <owner/repo> "<理由>" --remote
   ```

3. 出力の `admin_suspended` が 1 であることを確認します。
4. 詳細ページ `https://audio-soko-kun.allegromoltov.jp/plugins/<owner>/<repo>` を開き、掲載停止の表示と理由を確認します。ダウンロードボタンが無いことも確認します。

停止は、Cron の同期では解除されません。同期は `admin_suspended` を変更しないためです。

## プラグインの再開

停止の理由が解消したときに、管理者の停止を解きます。

1. 管理停止を解除します。

   ```sh
   npm run admin -- resume <owner/repo> --remote
   ```

2. 出力の `admin_suspended` が 0 であることを確認します。
3. 詳細ページを開き、掲載状態を確認します。

`resume` は、管理者の停止を解いて理由を消すだけです。掲載の可否は、検査結果から改めて算出されます。再開後の状態は次のいずれかになります。

| 条件 | 再開後の状態 |
| --- | --- |
| GitHub でリポジトリが削除または非公開になっている | 掲載終了 |
| いずれかのリリースの配布物の MalwareBazaar の結果が `malicious` | 停止 |
| 掲載対象バージョンがある | 掲載中 |
| 上のいずれにも当てはまらない | 検査待ち |

## 確認待ちの版の承認

新しい版が乗っ取りの兆候やレビューの重大な指摘で確認待ちになったときに、管理者が内容を確かめて掲載を許します。

1. 確認待ちの版と理由を表示します。

   ```sh
   npm run admin -- pending --remote
   ```

2. `diff_hits` と `serious_findings` に示された箇所を、GitHub のリポジトリとリリースで確かめます。作者がこのリポジトリの Issue で変更の意図を説明している場合は、その説明も読みます。
3. 問題が無いと判断したら、版を承認します。

   ```sh
   npm run admin -- approve-release <owner/repo> <tag> --remote
   ```

4. 出力の `admin_approved_at` に日時が入っていることを確認します。

承認した版は、ほかの条件をすべて満たしていれば、次の算出から掲載されます。問題があると判断した版は、後述の版の停止で止めます。

## 版の停止

特定の版だけに問題があるときに、その版の案内を止め、利用者へ告知します。

1. 版を止めます。

   ```sh
   npm run admin -- suspend-release <owner/repo> <tag> "<告知の文>" --remote
   ```

2. 出力に、止めた版のタグ・`reason` の `admin`・告知の文が表示されることを確認します。
3. 告知ページ `https://audio-soko-kun.allegromoltov.jp/notices` と詳細ページに、止めた版の警告が出ていることを確認します。

止めた版の記録は削除できません。告知の文を直すときは、同じ版にもう一度 `suspend-release` を実行します。

## 試行を使い切った検査のやり直し

証明の検証・中身の検査・macOS の判定は、`error` で 3 回終わると自動ではやり直しません。LLM のレビューも、2 回失敗すると選ばれなくなります。配布物の取得の失敗や Workers AI の障害のように、原因が本サービスの側にあって解消したときに、管理者が検査を待ちの状態に戻します。

1. `pending` で、`checks_exhausted` が 1 以上の版、または `review_state` が `failed` で `review_attempts` が 2 の版を探します。
2. 定期処理のログと `verify.yaml` の実行の記録で、失敗の原因が解消したことを確かめます。
3. 版の検査を待ちの状態に戻します。

   ```sh
   npm run admin -- retry-checks <owner/repo> <tag> --remote
   ```

4. 出力で、配布物ごとの結果が `pending` に、試行の回数が 0 に戻ったことを確認します。

`retry-checks` が戻すのは、指定した版の次の検査です。

| 検査 | 戻す条件 | 戻した後に検査する処理 |
| --- | --- | --- |
| 証明の検証 (`attestation_checks`) | `error` で試行が 3 回 | 次の `verify.yaml` の起動 |
| 中身の検査 (`content_checks`) | `error` で試行が 3 回 | 次の `verify.yaml` の起動 |
| macOS の判定 (`macos_signing_checks`) | `error` で試行が 3 回 | `macos-verify.yaml`。判定の経路は未実装のため、現在は `pending` のまま残る |
| LLM のレビュー (`release_checks` の `review_state`) | `failed` で試行が 2 回 | 次の定期処理の新しい版の検査 |

通信の検出 (`network_state`) の試行切れは戻しません。通信の検出の試行切れは掲載を止めず、レビューは検出の結果なしで進むためです。試行が残っている `error` と、結果が確定した検査は変えません。レビューの失敗による確認待ちは `approve-release` でも解けます。レビューの結果を得てから判断したいときに `retry-checks` を使います。

## 通報を受けたとき

通報は、公開してよい内容を GitHub Issues で、マルウェアの疑いのような非公開の内容を GitHub の Private vulnerability reporting で受け付けます。通報を受けたら、次の順で対応します。

1. 通報の対象のプラグイン ID を特定し、`show` で現在の値を確認します。
2. 詳細ページで、掲載対象バージョン・配布物の SHA-256・検査結果を確認します。
3. 利用者への被害のおそれがある場合は、調査の前に停止します。理由には、公開してよい範囲の内容を書きます。
4. GitHub のリポジトリとリリースを確認し、通報の内容を調べます。
5. 通報が誤りと判断した場合は、再開します。
6. 調べた結果と対応を通報者へ返答します。Private vulnerability reporting で受けた通報には、同じ非公開の場で返答します。
