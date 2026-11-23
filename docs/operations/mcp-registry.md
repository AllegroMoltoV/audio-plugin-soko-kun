# 公式 MCP Registry への登録

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../images/VST_Compatible_Logo_Steinberg_negative.png">
  <img src="../images/VST_Compatible_Logo_Steinberg.png" alt="VST Compatible" width="120">
</picture>

VST® is a registered trademark of Steinberg Media Technologies GmbH.

MCP クライアントの利用者が本サービスを見つけられるよう、本サービスの MCP サーバーを公式の MCP Registry (https://registry.modelcontextprotocol.io) に登録します。Registry の情報は、ほかの MCP サーバーの一覧にも取り込まれます。

## 登録の定義

登録の内容は、リポジトリの直下の `server.json` に置きます。本サービスは利用者の PC に導入するパッケージを持たないため、`remotes` に Streamable HTTP のエンドポイントだけを書きます。

| 項目 | 値 |
| --- | --- |
| `name` | `io.github.AllegroMoltoV/audio-plugin-soko-kun`。`io.github.<アカウント名>/` で始まる名前は、GitHub のアカウントでの認証で所有を示せる。DNS の設定は要らない |
| `description` | Registry の上限の 100 文字以内。宣伝の語を並べない |
| `version` | 本サービスの版。README の更新履歴、`package.json` と `package-lock.json` の `version`、`src/mcp/server.ts` の MCP の `serverInfo` の `version` にそろえる |
| `remotes` | `streamable-http` と `https://audio-soko-kun.allegromoltov.jp/mcp` |
| `icons` | `/logo.png` (256 x 256 px) と `/logo.svg`。MCP の `serverInfo` のアイコンと同じもの |

Registry は `version` を登録ごとの識別子として扱い、本番の Worker の版とは照合しません。版を上げただけの変更は、本番へ配備しなくても登録し直せます。

## 登録と更新の手順

Registry への公開は、`.github/workflows/deploy.yml` の job `publish-registry` が行います。この job は job `deploy` が成功した後に動き、GitHub Actions の OIDC (`mcp-publisher login github-oidc`) で認証するため、版ごとのデバイスコードの入力が要りません。job は次の順に処理します。

1. `server.json` と `package.json` の `version` を比べ、食い違えば止めます。
2. Registry の API で、同じ名前と版の登録の有無を確かめます。登録済みなら、以降を飛ばして成功で終わります。未登録なら公開へ進みます。API の応答が 200 と 404 のどちらでもないときは止めます。
3. `mcp-publisher` を v1.8.9 に固定して取得し、cosign で Sigstore のバンドルを検証してから展開します。
4. `mcp-publisher login github-oidc` で認証し、`mcp-publisher publish` で公開します。

エンドポイント、説明、版を変えたときは、`server.json` を直し、`version` を上げてから、`deploy.yml` を実行します。公開に失敗したときは、同じ実行の job `publish-registry` だけを再実行できます。deploy は再実行しません。公開後は、`https://registry.modelcontextprotocol.io/v0/servers?search=audio-plugin-soko-kun&version=latest` で、登録された内容を確かめます。

### 名前空間の権限

Registry は、OIDC のトークンの `repository_owner` だけから `io.github.<所有者>/*` の権限を与えます。environment、ワークフロー、ブランチは見ません。そのため、所有者のリポジトリで `id-token: write` を持つすべてのワークフローが、この名前空間の全体へ公開できます。`production` の承認は、この経路を守りません。job `publish-registry` に `environment` を付けないのは、このためです。公開は `needs` により、承認済みの deploy の後に限られます。

### 手で公開する手順

ワークフローが使えないときは、`AllegroMoltoV` の GitHub アカウントで認証して手で公開します。認証はブラウザーでの確認を伴います。`mcp-publisher` は外部から取得したプログラムで、Claude Code では実行が自動の権限判定で止められることがあるため、運営者が実行します。

1. 公式の GitHub のリリースから `mcp-publisher` を入手します。手順は Registry の Quickstart (https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx) にあります。
2. リポジトリの直下で `mcp-publisher validate` を実行し、`server.json` の形を確かめます。
3. `mcp-publisher login github` を実行し、表示に従って GitHub で認証します。
4. `mcp-publisher publish` を実行します。
