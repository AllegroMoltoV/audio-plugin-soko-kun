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

Malware disguised as cracked audio plugins has been reported repeatedly, and in 2026 an OBS Studio plugin forum saw author accounts taken over and published files replaced. Audio Plugin Soko-kun does not host files. It links to the files that authors publish on GitHub Releases, and lists a version only if the release is immutable, every listed archive has a build provenance attestation from the repository's own release workflow, no file is a known malware sample in MalwareBazaar, and macOS bundles are signed with a Developer ID and notarized. Until the macOS check is implemented, archives with macOS bundles are not linked. It also reviews the repository's development practices against published [review criteria](docs/design/review-criteria.md) (in Japanese). Passing the checks does not guarantee that a plugin is safe.

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
- macOS 向けのバンドルに、Developer ID の署名と Apple の公証がある。この判定を実装するまでは、macOS 向けのバンドルを含むアーカイブを案内しない

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

### 0.1.1 (2026-11-15)

- 本番の Workers AI の呼び出しを、配信プラグイン倉庫くんと共有する AI Gateway に通し、その支出の上限で 2 つのサービスを合わせた費用を止めるようにしました。上限に達したときは、無料枠の不足と同じく、レビューを 1 時間後にやり直し、翻訳を次回に回します。

### 0.1.0 (2026-11-15)

- 設計文書と設計判断の記録を公開しました。
- 配信プラグイン倉庫くん 0.2.1 のコードをもとに、オーディオプラグイン向けの登録サービスを https://audio-soko-kun.allegromoltov.jp で公開しました。
- VST 3・CLAP・LV2・Audio Unit のバンドルを zip の中から検出する中身の検査と、宣言ファイル `.audio-soko-kun/` を加えました。
- 開発の実践のレビューを、ルールで判定する項目と LLM が判定する項目に分けました。差分が大きいだけでは確認待ちにせず、変更されたファイルの一覧から計算した事実で判断します。
- macOS の配布物は、署名と公証の判定を実装するまで案内しません。
