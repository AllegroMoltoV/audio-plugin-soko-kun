# 認証と認可

MCP のツールの認証要件・OAuth のエンドポイント・サインインの流れ・GitHub の権限・配布物の検証の受け口の認証の仕様です。

仕組みは配信プラグイン倉庫くんの [認証と認可](https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/auth.md) と同じです。認可サーバーと MCP を 1 つの Worker に同居させる判断も、配信プラグイン倉庫くんの ADR 0002 を引き継ぎます。変えるのは、配布物の検証の受け口の経路と、OIDC のトークンで照合する値です。

## ツールごとの認証要件

| ツール | 認証 | 認可の条件 |
| --- | --- | --- |
| `search_plugins` | 不要 | なし |
| `get_plugin` | 不要 | なし |
| `submit_plugin` | 必須 | 対象リポジトリについて、サインインした GitHub の利用者の `permissions.admin` が `true`。確認のモードでも同じ |
| `list_my_plugins` | 必須 | 返すのは、サインインした GitHub の利用者の `permissions.admin` が `true` のリポジトリのプラグインだけ。候補の決め方は [作者へのレビューの返し方](author-feedback.md) に記載する |

認証は、リソースサーバーと各ツールのハンドラの両方で確かめます。認証なしで処理する MCP ハンドラには、認証を要するツールを登録しません。

## /mcp の振り分け

| 要求 | 振り分け先 |
| --- | --- |
| `Authorization` ヘッダーを持つ | リソースサーバー |
| `Mcp-Name` ヘッダーが認証を要するツール | リソースサーバー |
| `Mcp-Name` ヘッダーが無く、本文で認証を要するツールを呼び出す | リソースサーバー |
| `Mcp-Name` ヘッダーと本文のツール名が食い違う | 拒否。400 を返す |
| 上のいずれにも当てはまらない | 認証なしの MCP ハンドラ |

リソースサーバーは、トークンが無い要求と検証に失敗した要求に 401 を返します。偽のトークンには `error="invalid_token"` を返します。MCP の実装は `@modelcontextprotocol/server` の `createMcpHandler` を使い、セッションを持たない形で動作させます。

## エンドポイント

| パス | 役割 |
| --- | --- |
| `/mcp` | MCP エンドポイント。リソースサーバーが保護する |
| `/.well-known/oauth-protected-resource` | 保護リソースのメタデータ。RFC 9728 |
| `/.well-known/oauth-authorization-server` | 認可サーバーのメタデータ。RFC 8414 |
| `/oauth/register` | DCR のクライアント登録 |
| `/authorize` | 認可要求の受付と同意画面 |
| `/callback` | GitHub での認可からの戻り先 |
| `/oauth/token` | アクセストークンの発行 |
| `/internal/checks/pending`・`/internal/checks/results`・`/internal/macos-checks/pending`・`/internal/macos-checks/results` | 配布物の検証の受け口。GitHub Actions の OIDC のトークンで守る |

`/oauth/register`・`/authorize`・`/oauth/token`・`/callback` には、送信元 IP アドレスあたり 1 分 20 回のレート制限を設けます。これらの経路は KV へ書き込むため、無料プランの KV の書き込みの上限を守る必要があります。`/mcp` と Web カタログの上限は、送信元 IP アドレスあたり 1 分 120 回です。OAuth のメタデータにはレート制限を設けません。集計の方式は [データモデル](data-model.md) の `rate_limit` に記載します。

## アクセストークン

| 項目 | 値 |
| --- | --- |
| 発行者 | 本サービスの認可サーバー。`issuer` は `ORIGIN` |
| audience | `<ORIGIN>/mcp`。一致しないトークンは拒否する |
| 保存先 | KV の `OAUTH_KV`。`@cloudflare/workers-oauth-provider` が管理する |
| スコープ | 権限の区分は設けていない。認証済みであることが `submit_plugin` と `list_my_plugins` の条件である |

## クライアントの登録方式

CIMD と DCR の両方を受け付けます。認可サーバーのメタデータは `client_id_metadata_document_supported: true` と `registration_endpoint` を含みます。CIMD の文書の取得には、Worker の互換性フラグ `global_fetch_strictly_public` が適用されます。

## サインインの流れ

1. MCP クライアントが `/mcp` から 401 を受け取り、保護リソースのメタデータと認可サーバーのメタデータを取得する。
2. MCP クライアントが `/authorize` へ認可要求を送る。要求は PKCE の S256 と `resource` を含む。
3. 認可サーバーが同意画面を表示する。同意画面は、クライアントの名前と、アクセスを渡す先のホストを示す。
4. 利用者が同意すると、認可サーバーが GitHub の認可画面へ転送する。この要求は、本サービスが生成した PKCE の S256 を含む。
5. GitHub が `/callback` へ戻る。認可サーバーは GitHub のアクセストークンと refresh token を取得し、GitHub の利用者 ID とログイン名とともに認可の情報に保存する。
6. 認可サーバーが MCP クライアントへ認可コードを返す。MCP クライアントは `/oauth/token` でアクセストークンを受け取る。

配信プラグイン倉庫くんでは、Claude Code と Codex がこの流れでサインインを終えています。本サービスで同じ確認を行うのは、段階 2 の実装の後です。

## GitHub のトークンの更新

MCP クライアントが `/oauth/token` へ `grant_type=refresh_token` の要求を送ると、認可サーバーは保存した GitHub の refresh token で GitHub のアクセストークンを取り直します。

| GitHub の応答 | 扱い |
| --- | --- |
| 新しいアクセストークンを返した | 認可の情報の GitHub のアクセストークンを置き換える。新しい refresh token が返された場合は、それも置き換える |
| `bad_refresh_token` を返した | `invalid_grant` を返す。利用者は再びサインインする必要がある |
| その他の失敗 | 503 の `temporarily_unavailable` を返す |

保存した GitHub の refresh token が無い場合は、GitHub のトークンを更新せずに MCP のトークンだけを更新します。

## GitHub の権限

| 項目 | 内容 |
| --- | --- |
| アプリの種類 | GitHub OAuth App。配信プラグイン倉庫くんとは別のアプリを作る |
| 要求するスコープ | なし。公開リポジトリの `permissions.admin` はスコープ無しのトークンで取得できる |
| 利用者のトークンの用途 | `submit_plugin` と `list_my_plugins` での管理権限の確認だけ |
| アプリの認証情報の用途 | `submit_plugin` での情報取得と、同期での GitHub API の呼び出し。`client_id` と `client_secret` の Basic 認証で送る |

GitHub API を認証なしで呼ぶと、Workers の共有の送信元 IP アドレスのために 403 を受けることがあります。そのため、本人確認を伴わない呼び出しにもアプリの認証情報を使います。利用者のトークン・アプリの認証ヘッダー・スキャナーの API キーは、ログと応答に出力しません。

## 配布物の検証の受け口の認証

`/internal/` 配下の 4 つの経路は、本サービスのリポジトリの GitHub Actions のワークフローだけが使います。`/internal/checks/` の 2 つの経路は `verify.yaml` が、`/internal/macos-checks/` の 2 つの経路は `macos-verify.yaml` が使います。OAuth のアクセストークンではなく、`Authorization: Bearer` の GitHub Actions の OIDC のトークンを求めます。Worker は GitHub が公開する鍵でトークンの署名を確かめ、`iss`・`aud`・`repository`・`job_workflow_ref`・`exp` を照合します。満たさない要求には 401 を返します。照合するクレームの値は [検査と同期](scanning.md) の「Worker の経路」に記載します。

`job_workflow_ref` はワークフローのファイルごとの値で、同じファイルの 2 つのジョブを区別できません。そのため、macOS の判定は別のファイル `macos-verify.yaml` に置き、Worker は経路ごとに期待する `job_workflow_ref` を持ちます。`src/checks/oidc.ts` の `VERIFY_WORKFLOW_REF` と `MACOS_VERIFY_WORKFLOW_REF` で、`/internal/checks/` は `src/checks/route.ts`、`/internal/macos-checks/` は `src/checks/macos-route.ts` が照合します。一方のワークフローが乗っ取られても、もう一方の経路には結果を書けません。

この認証のために Worker が保存しておく鍵や秘密情報はありません。

## 秘密情報

秘密情報は `wrangler secret` で設定し、ローカルでは git の追跡対象外の `.dev.vars` に置きます。

| 名前 | 用途 |
| --- | --- |
| `GITHUB_CLIENT_ID` | GitHub OAuth App の Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App の Client secret |
| `MALWAREBAZAAR_AUTH_KEY` | MalwareBazaar の Auth-Key。配信プラグイン倉庫くんと同じ鍵を使う |
| `GITHUB_DISPATCH_TOKEN` | 配布物の検証のワークフロー `verify.yaml` と `macos-verify.yaml` を起動するための fine-grained personal access token。対象は本サービスのリポジトリだけで、権限は Actions の Read and write だけ |
| `CONTACT_EMAIL` | 開発者の連絡先のメールアドレス。収集を防ぐためソースコードに書かず、秘密情報と同じ方法で設定する |

`GITHUB_DISPATCH_TOKEN` は省略できます。省略した場合は Worker からワークフローを起動せず、ワークフローの schedule と手動の起動だけに頼ります。`MALWAREBAZAAR_AUTH_KEY` は省略できます。省略した場合は照会を行わず、検査結果は `pending` のまま残ります。

macOS の公証の判定は Apple への照会を伴いますが、照会に認証情報は要りません。検証 A2 では、秘密情報を参照しないワークフローで、公証済みの標本が公証済みと判定されました。そのため、`macos-verify.yaml` に秘密情報を置きません。

