# Audio Plugin Soko-kun (音のプラグイン倉庫くん)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/VST_Compatible_Logo_Steinberg_negative.png">
  <img src="docs/images/VST_Compatible_Logo_Steinberg.png" alt="VST Compatible" width="120">
</picture>

VST® is a registered trademark of Steinberg Media Technologies GmbH.

[English](#english) | [日本語](#日本語)

## English

Audio Plugin Soko-kun is an independent, open registry of open-source audio plugins in VST 3, CLAP, LV2 and Audio Unit formats. Like its sibling [Plugin Soko-kun](https://github.com/AllegroMoltoV/plugin-soko-kun) for OBS Studio, it is designed MCP-first, so AI coding agents such as Claude Code and Codex can search for plugins and register GitHub repositories directly. A read-only web catalog is also provided at https://audio-soko-kun.allegromoltov.jp.

This project is an unofficial service that is not affiliated with Steinberg Media Technologies GmbH, the CLAP project, Apple, or the LV2 project.

### Background

Malware disguised as cracked audio plugins has been reported repeatedly, and in 2026 an OBS Studio plugin forum saw author accounts taken over and published files replaced. Audio Plugin Soko-kun does not host files. It links to the files that authors publish on GitHub Releases, and lists a version only if the release is immutable, every listed archive has a build provenance attestation from the repository's own release workflow, no file is a known malware sample in MalwareBazaar, and macOS bundles are signed with a Developer ID and notarized. LV2 bundles for macOS are not linked, because Gatekeeper does not assess them. It also reviews the repository's development practices against published [review criteria](docs/design/review-criteria.md) (in Japanese). Passing the checks does not guarantee that a plugin is safe.

### Usage

Connect an MCP client to `https://audio-soko-kun.allegromoltov.jp/mcp`.

```sh
# Claude Code
claude mcp add --transport http audio-plugin-soko-kun https://audio-soko-kun.allegromoltov.jp/mcp

# Codex
codex mcp add audio-plugin-soko-kun --url https://audio-soko-kun.allegromoltov.jp/mcp
```

Searching and viewing details work without signing in. To register a repository you administer, sign in with GitHub first: run `/mcp` in Claude Code, or `codex mcp login audio-plugin-soko-kun` in Codex. Then ask, for example, "Register the audio plugin in this GitHub repository". New releases are picked up automatically. Authors can ask, for example, "Check whether my plugin meets the listing conditions" before a release, and "Is the new release of my plugin listed?" after it.

The listing conditions, the security policy, and how to report a problem are on the website: [What is Audio Plugin Soko-kun?](https://audio-soko-kun.allegromoltov.jp/about?lang=en), [Listing policy](https://audio-soko-kun.allegromoltov.jp/policy?lang=en), [Submit a plugin](https://audio-soko-kun.allegromoltov.jp/submit?lang=en), [Security and disclaimer](https://audio-soko-kun.allegromoltov.jp/security?lang=en), [Report](https://audio-soko-kun.allegromoltov.jp/report?lang=en).

### Contents

| Path | Contents |
| --- | --- |
| `docs/INDEX.md` | Index of the documents |
| `docs/decisions/` | Architecture decision records |
| `docs/design/` | Design documents |
| `docs/glossary.md` | Glossary |
| `docs/operations/` | Operations guides (deployment, admin commands, local development, incident response, backup) |
| `src/` | Cloudflare Worker: web catalog, MCP server, checks and sync |
| `public/` | Static files: service logo, sharing image, VST Compatible logo |
| `migrations/` | D1 schema migrations |
| `scripts/` | Admin commands and maintenance scripts |
| `test/` | Automated tests |
| `.github/workflows/` | CI, deployment and verification workflows run on GitHub Actions |
| `LICENSE` | MIT License |

### AI disclosure

Anthropic Claude Code was used for almost the entire development of this service, including research, source code, Cloudflare and GitHub configuration, tests, and documentation. The source code was derived from Plugin Soko-kun, which was also developed with Claude Code. The seed plugin simple-pitchshift-audio was also written with Claude Code, and the author checked it in a DAW. The author decided the requirements and design policies, reviewed the web pages and documents, and approved each deployment and external operation one by one. The author did not perform a rigorous line-by-line human review of the source code.

### License

MIT License. See [LICENSE](LICENSE). The VST Compatible logo images (`docs/images/VST_Compatible_Logo_Steinberg*.png` and their copies `public/images/vst-compatible*.png`) are trademarks of Steinberg Media Technologies GmbH and are not covered by the MIT License.

## 日本語

音のプラグイン倉庫くんは、VST 3・CLAP・LV2・Audio Unit のオープンソースのオーディオプラグインを掲載する、独立した非公式のレジストリです。OBS Studio 向けの[配信プラグイン倉庫くん](https://github.com/AllegroMoltoV/plugin-soko-kun)の姉妹で、MCP を主な操作手段にします。Claude Code や Codex などの AI のコーディングエージェントから、プラグインを探したり、GitHub のリポジトリを登録したりできます。閲覧専用の Web カタログを https://audio-soko-kun.allegromoltov.jp で提供しています。

Steinberg Media Technologies GmbH、CLAP のプロジェクト、Apple、LV2 のプロジェクトとは関係のない非公式のサービスです。

### 背景

クラック版のオーディオプラグインを装うマルウェアが、繰り返し報告されています。2026 年には、OBS Studio のプラグインの掲示板で作者のアカウントが乗っ取られ、公開中のファイルが差し替えられました。

音のプラグイン倉庫くんは、ファイルを預かりません。作者が GitHub Releases で公開したファイルへ案内します。版を掲載するのは、次の条件をすべて満たすときです。

- リリースが不変 (immutable release) である
- 案内するアーカイブのすべてに、そのリポジトリのリリースのワークフローによる build provenance の証明がある
- どのファイルも、MalwareBazaar に既知のマルウェアとして登録されていない
- macOS 向けのバンドルに、Developer ID の署名と Apple の公証がある。macOS の LV2 のバンドルは、Gatekeeper が判定しないため案内しない

あわせて、公開した[審査の基準](docs/design/review-criteria.md)にしたがって、リポジトリの開発の実践をレビューします。検査を通っても、プラグインの安全を保証するものではありません。

### 内容物

| パス | 内容 |
| --- | --- |
| `docs/INDEX.md` | 文書の索引 |
| `docs/decisions/` | 設計判断の記録 |
| `docs/design/` | 設計文書 |
| `docs/glossary.md` | 用語集 |
| `docs/operations/` | 運用の手順 (配備・管理コマンド・ローカルでの開発・障害対応・バックアップ) |
| `src/` | Cloudflare Worker の本体。Web カタログ・MCP サーバー・検査と同期 |
| `public/` | 静的なファイル。サービスのロゴ・共有のときの画像・VST Compatible ロゴ |
| `migrations/` | D1 のスキーマのマイグレーション |
| `scripts/` | 管理コマンドと保守用のスクリプト |
| `test/` | 自動テスト |
| `.github/workflows/` | GitHub Actions で実行する CI・配備・検証のワークフロー |
| `LICENSE` | MIT License |

### 使い方

MCP クライアントを `https://audio-soko-kun.allegromoltov.jp/mcp` に接続します。

```sh
# Claude Code
claude mcp add --transport http audio-plugin-soko-kun https://audio-soko-kun.allegromoltov.jp/mcp

# Codex
codex mcp add audio-plugin-soko-kun --url https://audio-soko-kun.allegromoltov.jp/mcp
```

検索と詳細の取得は、サインインなしで使えます。自分が管理するリポジトリを登録するときは、先に GitHub でサインインします。Claude Code では `/mcp` を、Codex では `codex mcp login audio-plugin-soko-kun` を実行します。そのうえで「この GitHub リポジトリのオーディオプラグインを登録して」のように話しかけます。新しいリリースは自動で取り込みます。作者は、リリースの前に「このプラグインの掲載の条件を確かめて」、リリースのあとに「新しい版の掲載の状況を確かめて」のように話しかけて確かめられます。

掲載の条件、セキュリティの方針、問題の通報の方法は Web サイトに記載しています。[音のプラグイン倉庫くんとは？](https://audio-soko-kun.allegromoltov.jp/about)、[掲載ポリシー](https://audio-soko-kun.allegromoltov.jp/policy)、[プラグインを登録する](https://audio-soko-kun.allegromoltov.jp/submit)、[セキュリティと免責](https://audio-soko-kun.allegromoltov.jp/security)、[通報](https://audio-soko-kun.allegromoltov.jp/report) を参照してください。

### AI 利用開示

本サービスの開発では、調査、ソースコード、Cloudflare と GitHub の設定、テスト、文書を含むほぼすべての工程で Anthropic Claude Code を使用しました。ソースコードは、同じく Claude Code で開発した配信プラグイン倉庫くんをもとにしています。シードのプラグイン simple-pitchshift-audio も Claude Code で書き、作者が DAW で動作を確認しました。要件と設計の方針は作者が決めました。作者は Web の画面と文書を確認し、配備と外部への操作を 1 回ずつ承認しました。ソースコードを 1 行ずつ読む厳密な人間のレビューは行っていません。

### ライセンス

MIT License です。[LICENSE](LICENSE) を参照してください。VST Compatible ロゴの画像 (`docs/images/VST_Compatible_Logo_Steinberg*.png` と、その複製の `public/images/vst-compatible*.png`) は Steinberg Media Technologies GmbH の商標で、MIT License の対象外です。

## 更新履歴

### 0.1.6 (2026-11-15)

- レビューの README を、GitHub がリポジトリの画面に表示するものを GitHub の README の API で取得し、そのパスで照合するようにしました。`README.md` 以外の名前の README や、`.github` と `docs` に置いた README で、`no-security-bypass` と `no-terminal-paste` の照合を逃れられた欠陥を直しました。README の上限は 128 KB のままで、LLM には先頭の 32,768 文字だけを渡します。配信プラグイン倉庫くん 0.2.9 と同じ実装です。
- AI Gateway のログで配信プラグイン倉庫くんと消費を区別できるよう、Workers AI の呼び出しにサービス名 `audio-plugin-soko-kun` のメタデータを付けました。

### 0.1.5 (2026-11-15)

- README を最初に 128 KB まで読み、`no-security-bypass` と `no-terminal-paste` で全文を照合するようにしました。読めなかった README は、無い README と同じに扱わず、重大の指摘にします。LLM には README の先頭 32 KB だけを渡します。配信プラグイン倉庫くん 0.2.7 と 0.2.8 と同じ実装です。
- 規則で判定して判定できなかった項目の説明を、すべて「Checked by rules: 」で始め、LLM の指摘と見分けられるようにしました。
- macOS の判定の受け口で、試行を使い切った配布物にも、遅れて届いた判定の結果を受け入れるようにしました。確定した結果は書き換えません。

### 0.1.4 (2026-11-15)

- macOS 向けのバンドルの署名と公証の判定を始めました。新しいワークフロー `macos-verify.yaml` が macOS のランナーで配布物を判定し、`spctl --assess --type install` が `source=Notarized Developer ID` を返したバンドルだけを案内します。ステープルの有無は問いません。署名が無いもの、アドホックの署名だけのもの、Developer ID 以外の証明書で署名したものは案内しません。Developer ID の署名があるのに公証済みと判定されないものは、Apple への照会の失敗と区別できないため 3 回まで判定し直し、その後は管理者の確認を待ちます。
- macOS の LV2 のバンドルは、Gatekeeper が判定しないため案内しないことにしました。Linux のバイナリも持つ LV2 のバンドルは、Linux 向けとして案内します。
- `ditto` で展開する前に zip の項目を確かめ、絶対パス・`..`・バンドルの外を指すシンボリックリンクを含むアーカイブは展開しないようにしました。フレームワークの中を指すシンボリックリンクは許します。
- Worker に、`macos-verify.yaml` のトークンだけを受け付ける受け口 `/internal/macos-checks/pending` と `/internal/macos-checks/results` を加え、定期処理から `macos-verify.yaml` も起動するようにしました。版の macOS のバンドルの Team ID が食い違うときは、管理者の確認を待ちます。

### 0.1.3 (2026-11-15)

- 定期処理で、新しい版の検査を同期より先に行うようにしました。これまでは同期が先に外部呼び出しの予算を使い、同期を待つプラグインが 20 件ほどに増えると、新しい版の検査が毎回飛ばされていました。検査の間も同期 1 件の分を残し、検査が予算を超えても失敗しても同期は進みます。検査で GitHub が 5xx を返し続ける版は試行に数え、2 回で管理者の確認待ちにします。配信プラグイン倉庫くん 0.2.6 の変更に合わせたものです。
- 管理コマンドに `retry-checks` を加えました。証明の検証・中身の検査・macOS の判定が 3 回 `error` で終わった版と、レビューが 2 回失敗した版の検査を、原因を確かめたあとに待ちの状態へ戻せます。管理コマンド `pending` には、版の公開からの経過時間 `waiting_minutes` と、試行を使い切った配布物の件数 `checks_exhausted` を出します。

### 0.1.2 (2026-11-15)

- 新しい版のソースのコードから通信の API の使用を GitHub Actions で検出し、結果をレビューに事実として渡すようにしました。JUCE と Rust の通信の API も探します。ソースは実行もビルドもしません。通信の API があるのに README が外部への送信に一切触れていない版は、管理者の確認待ちにします。レビューは検出の結果を、版の公開から 6 時間まで待ちます。配信プラグイン倉庫くん 0.2.3 の変更に合わせたものです。
- 新しい版のタグのコミットが既定のブランチの履歴に無ければ、乗っ取りの兆候 `tag-not-on-default-branch` として管理者の確認待ちにするようにしました。比べるのはタグの名前ではなく、証明と結び付いた版のコミットです。初めて登録する版にも当てます。推奨の項目に、既定のブランチとリリースのタグを ruleset で守る `repository-protection` を足し、登録の方法のページに設定の仕方を書きました。配信プラグイン倉庫くん 0.2.4 の変更に合わせたものです。

### 0.1.1 (2026-11-15)

- 本番の Workers AI の呼び出しを、配信プラグイン倉庫くんと共有する AI Gateway に通し、その支出の上限で 2 つのサービスを合わせた費用を止めるようにしました。上限に達したときは、無料枠の不足と同じく、レビューを 1 時間後にやり直し、翻訳を次回に回します。

### 0.1.0 (2026-11-15)

- 設計文書と設計判断の記録を公開しました。
- 配信プラグイン倉庫くん 0.2.1 のコードをもとに、オーディオプラグイン向けの登録サービスを https://audio-soko-kun.allegromoltov.jp で公開しました。
- VST 3・CLAP・LV2・Audio Unit のバンドルを zip の中から検出する中身の検査と、宣言ファイル `.audio-soko-kun/` を加えました。
- 開発の実践のレビューを、ルールで判定する項目と LLM が判定する項目に分けました。差分が大きいだけでは確認待ちにせず、変更されたファイルの一覧から計算した事実で判断します。
- macOS の配布物は、署名と公証の判定を実装するまで案内しません。
