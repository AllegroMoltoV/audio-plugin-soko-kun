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

Registry への書き込みには、`AllegroMoltoV` の GitHub アカウントでの認証が要ります。認証はブラウザーでの確認を伴います。`mcp-publisher` は外部から取得したプログラムで、Claude Code では実行が自動の権限判定で止められることがあるため、運営者が実行します。

1. 公式の GitHub のリリースから `mcp-publisher` を入手します。手順は Registry の Quickstart (https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx) にあります。
2. リポジトリの直下で `mcp-publisher validate` を実行し、`server.json` の形を確かめます。
3. `mcp-publisher login github` を実行し、表示に従って GitHub で認証します。
4. `mcp-publisher publish` を実行します。
5. `https://registry.modelcontextprotocol.io/v0/servers?search=audio-plugin-soko-kun&version=latest` で、登録された内容を確かめます。

エンドポイント、説明、版を変えたときは、`server.json` を直し、`version` を上げてから、同じ手順で登録し直します。
