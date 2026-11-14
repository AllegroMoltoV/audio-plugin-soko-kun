# Audio Plugin Soko-kun (音のプラグイン倉庫くん)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/VST_Compatible_Logo_Steinberg_negative.png">
  <img src="docs/images/VST_Compatible_Logo_Steinberg.png" alt="VST Compatible" width="120">
</picture>

VST® is a registered trademark of Steinberg Media Technologies GmbH.

[English](#english) | [日本語](#日本語)

## English

Audio Plugin Soko-kun will be an independent, open registry of open-source audio plugins in VST 3, CLAP, LV2 and Audio Unit formats. Like its sibling [Plugin Soko-kun](https://github.com/AllegroMoltoV/plugin-soko-kun) for OBS Studio, it is designed MCP-first, so AI coding agents can search for plugins and register GitHub repositories directly.

Status: in design. The service is not running yet. This repository currently holds the design documents and decision records (in Japanese).

This project is an unofficial service that is not affiliated with Steinberg Media Technologies GmbH, the CLAP project, Apple, or the LV2 project.

### Background

Malware disguised as cracked audio plugins has been reported repeatedly, and in 2026 an OBS Studio plugin forum saw author accounts taken over and published files replaced. Audio Plugin Soko-kun does not host files. It will link to the files that authors publish on GitHub Releases, and list a version only if the release is immutable, every listed archive has a build provenance attestation from the repository's own release workflow, no file is a known malware sample in MalwareBazaar, and macOS bundles are signed with a Developer ID and notarized. It will also review the repository's development practices against published [review criteria](docs/design/review-criteria.md). Passing the checks will not guarantee that a plugin is safe.

### Contents

| Path | Contents |
| --- | --- |
| `docs/INDEX.md` | Index of the documents |
| `docs/decisions/` | Architecture decision records |
| `docs/design/` | Draft design documents |
| `docs/glossary.md` | Glossary |
| `docs/operations/` | Operations guides (deployment, admin commands, local development, incident response, backup) |
| `src/` | Cloudflare Worker: web catalog, MCP server, checks and sync |
| `public/` | Static files: service logo, sharing image, VST Compatible logo |
| `migrations/` | D1 schema migrations |
| `scripts/` | Admin commands and maintenance scripts |
| `test/` | Automated tests |
| `.github/workflows/` | CI, deployment and verification workflows run on GitHub Actions |
| `LICENSE` | MIT License |

### License

MIT License. See [LICENSE](LICENSE). The VST Compatible logo images (`docs/images/VST_Compatible_Logo_Steinberg*.png` and their copies `public/images/vst-compatible*.png`) are trademarks of Steinberg Media Technologies GmbH and are not covered by the MIT License.

## 日本語

音のプラグイン倉庫くんは、VST 3・CLAP・LV2・Audio Unit のオープンソースのオーディオプラグインを掲載する、独立した非公式のレジストリです。OBS Studio 向けの[配信プラグイン倉庫くん](https://github.com/AllegroMoltoV/plugin-soko-kun)の姉妹で、MCP を主な操作手段にします。AI のコーディングエージェントから、プラグインを探したり、GitHub のリポジトリを登録したりできるようにします。

現在は設計の段階で、サービスはまだ動作していません。このリポジトリには、設計文書と設計判断の記録を置いています。

Steinberg Media Technologies GmbH、CLAP のプロジェクト、Apple、LV2 のプロジェクトとは関係のない非公式のサービスです。

### 背景

クラック版のオーディオプラグインを装うマルウェアが、繰り返し報告されています。2026 年には、OBS Studio のプラグインの掲示板で作者のアカウントが乗っ取られ、公開中のファイルが差し替えられました。

音のプラグイン倉庫くんは、ファイルを預かりません。作者が GitHub Releases で公開したファイルへ案内します。版を掲載するのは、次の条件をすべて満たすときです。

- リリースが不変 (immutable release) である
- 案内するアーカイブのすべてに、そのリポジトリのリリースのワークフローによる build provenance の証明がある
- どのファイルも、MalwareBazaar に既知のマルウェアとして登録されていない
- macOS 向けのバンドルに、Developer ID の署名と Apple の公証がある

あわせて、公開した[審査の基準](docs/design/review-criteria.md)にしたがって、リポジトリの開発の実践をレビューします。検査を通っても、プラグインの安全を保証するものではありません。

### 内容物

| パス | 内容 |
| --- | --- |
| `docs/INDEX.md` | 文書の索引 |
| `docs/decisions/` | 設計判断の記録 |
| `docs/design/` | 設計文書の下書き |
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

サービスの公開後に記載します。

### ライセンス

MIT License です。[LICENSE](LICENSE) を参照してください。VST Compatible ロゴの画像 (`docs/images/VST_Compatible_Logo_Steinberg*.png` と、その複製の `public/images/vst-compatible*.png`) は Steinberg Media Technologies GmbH の商標で、MIT License の対象外です。

## 更新履歴

### 未公開

- 設計文書と設計判断の記録を公開しました。
