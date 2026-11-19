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

Malware disguised as cracked audio plugins has been reported repeatedly, and in 2026 an OBS Studio plugin forum saw author accounts taken over and published files replaced. Audio Plugin Soko-kun does not host files. It links to the files that authors publish on GitHub Releases, and lists a version only if the release is immutable, every file in the release, including installers that are not linked, has a build provenance attestation from the repository's own release workflow, a zip archive contains a VST 3, CLAP, LV2 or Audio Unit bundle and no archive contains a VST 2 plugin, the repository has an OSI- or FSF-approved open-source license at the release tag, no file is a known malware sample in MalwareBazaar, and macOS bundles are signed with a Developer ID and notarized. LV2 bundles for macOS are not linked, because Gatekeeper does not assess them. It also reviews the repository's development practices against published [review criteria](docs/design/review-criteria.md) (in Japanese). Passing the checks does not guarantee that a plugin is safe.

### Usage

Connect an MCP client to `https://audio-soko-kun.allegromoltov.jp/mcp`.

```sh
# Claude Code
claude mcp add --transport http audio-plugin-soko-kun https://audio-soko-kun.allegromoltov.jp/mcp

# Codex
codex mcp add audio-plugin-soko-kun --url https://audio-soko-kun.allegromoltov.jp/mcp
```

Searching and viewing details work without signing in. To register a repository you administer, sign in with GitHub first: run `/mcp` in Claude Code, or `codex mcp login audio-plugin-soko-kun` in Codex. Then ask, for example, "Register the audio plugin in this GitHub repository". New releases are picked up automatically. Authors can ask, for example, "Check whether my plugin meets the listing conditions" before a release, and "Is the new release of my plugin listed?" after it.

Authors who build plugins with Claude Code can install the skill `audio-plugin-dev`. It guides planning, a CLAP-first project template, validation in CI, releases with build provenance attestations, and listing on this service. The plugin also registers the MCP server above.

```sh
claude plugin marketplace add AllegroMoltoV/audio-plugin-soko-kun
claude plugin install audio-soko-kun-plugin-dev@audio-plugin-soko-kun
```

The listing conditions, the security policy, and how to report a problem are on the website: [What is Audio Plugin Soko-kun?](https://audio-soko-kun.allegromoltov.jp/about?lang=en), [Listing policy](https://audio-soko-kun.allegromoltov.jp/policy?lang=en), [Submit a plugin](https://audio-soko-kun.allegromoltov.jp/submit?lang=en), [Security and disclaimer](https://audio-soko-kun.allegromoltov.jp/security?lang=en), [Report](https://audio-soko-kun.allegromoltov.jp/report?lang=en).

### Contents

| Path | Contents |
| --- | --- |
| `docs/INDEX.md` | Index of the documents |
| `docs/decisions/` | Architecture decision records |
| `docs/design/` | Design documents |
| `docs/glossary.md` | Glossary |
| `docs/operations/` | Operations guides (deployment, admin commands, local development, incident response, backup, MCP Registry listing) |
| `src/` | Cloudflare Worker: web catalog, MCP server, checks and sync |
| `public/` | Static files: service logo, sharing image, VST Compatible logo |
| `migrations/` | D1 schema migrations |
| `scripts/` | Admin commands and maintenance scripts |
| `test/` | Automated tests |
| `.github/workflows/` | CI, deployment and verification workflows run on GitHub Actions |
| `.github/scripts/` | Scripts run by the verification workflows: archive inspection, macOS signing judgment, network API and document scans |
| `.claude-plugin/marketplace.json` | Claude Code plugin marketplace of this repository |
| `plugins/audio-soko-kun-plugin-dev/` | Claude Code plugin with the author skill `audio-plugin-dev` and its project template |
| `server.json` | Listing definition for the official MCP Registry |
| `glama.json` | Maintainer of the Glama listing |
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
- リリースのすべてのファイルに、そのリポジトリのリリースのワークフローによる build provenance の証明がある。案内しないインストーラーも含む
- zip のアーカイブに VST 3・CLAP・LV2・Audio Unit のいずれかのバンドルがあり、どのアーカイブにも VST 2 のプラグインが無い
- リリースのタグの時点のリポジトリのライセンスが、OSI か FSF が認めるオープンソースのライセンスである
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
| `docs/operations/` | 運用の手順 (配備・管理コマンド・ローカルでの開発・侵害の対応・バックアップ・MCP Registry への登録) |
| `src/` | Cloudflare Worker の本体。Web カタログ・MCP サーバー・検査と同期 |
| `public/` | 静的なファイル。サービスのロゴ・共有のときの画像・VST Compatible ロゴ |
| `migrations/` | D1 のスキーマのマイグレーション |
| `scripts/` | 管理コマンドと保守用のスクリプト |
| `test/` | 自動テスト |
| `.github/workflows/` | GitHub Actions で実行する CI・配備・検証のワークフロー |
| `.github/scripts/` | 検証のワークフローが実行するスクリプト。アーカイブの中身の検査・macOS の署名と公証の判定・通信の API と文書の照合 |
| `.claude-plugin/marketplace.json` | このリポジトリを Claude Code のプラグインのマーケットプレイスにする定義 |
| `plugins/audio-soko-kun-plugin-dev/` | 作者向けのスキル `audio-plugin-dev` とプロジェクトの雛形を含む Claude Code のプラグイン |
| `server.json` | 公式の MCP Registry への登録の定義 |
| `glama.json` | Glama の掲載の保守者 |
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

Claude Code でプラグインを作る作者は、スキル `audio-plugin-dev` を入れられます。企画、CLAP を先に書くプロジェクトの雛形、CI での検証、ビルドの来歴の証明つきのリリース、本サービスへの掲載を案内します。このプラグインは、上の MCP サーバーも登録します。

```sh
claude plugin marketplace add AllegroMoltoV/audio-plugin-soko-kun
claude plugin install audio-soko-kun-plugin-dev@audio-plugin-soko-kun
```

掲載の条件、セキュリティの方針、問題の通報の方法は Web サイトに記載しています。[音のプラグイン倉庫くんとは？](https://audio-soko-kun.allegromoltov.jp/about)、[掲載ポリシー](https://audio-soko-kun.allegromoltov.jp/policy)、[プラグインを登録する](https://audio-soko-kun.allegromoltov.jp/submit)、[セキュリティと免責](https://audio-soko-kun.allegromoltov.jp/security)、[通報](https://audio-soko-kun.allegromoltov.jp/report) を参照してください。

### AI 利用開示

本サービスの開発では、調査、ソースコード、Cloudflare と GitHub の設定、テスト、文書を含むほぼすべての工程で Anthropic Claude Code を使用しました。ソースコードは、同じく Claude Code で開発した配信プラグイン倉庫くんをもとにしています。シードのプラグイン simple-pitchshift-audio も Claude Code で書き、作者が DAW で動作を確認しました。要件と設計の方針は作者が決めました。作者は Web の画面と文書を確認し、配備と外部への操作を 1 回ずつ承認しました。ソースコードを 1 行ずつ読む厳密な人間のレビューは行っていません。

### ライセンス

MIT License です。[LICENSE](LICENSE) を参照してください。VST Compatible ロゴの画像 (`docs/images/VST_Compatible_Logo_Steinberg*.png` と、その複製の `public/images/vst-compatible*.png`) は Steinberg Media Technologies GmbH の商標で、MIT License の対象外です。

## 更新履歴

### 0.1.30 (2026-11-19)

- 審査の推奨 `plugin-name` (名前に単語としての `VST` を含めない) の照合に、審査する版の宣言ファイルの `name` を使うようにしました。これまでは掲載中の版の表示名を照合していたため、審査中の版で宣言の `name` に `VST` を入れても指摘が届かず、掲載中の版の名前に `VST` が残っていると、新しい版で外しても指摘が出続けていました。照合の対象はリポジトリ名と、審査する版の宣言の `name` です。あわせて、`submit_plugin` の check モードでも、既定のブランチの宣言の `name` を照合に入れるようにしました。これまではリポジトリ名だけを照合していたため、宣言の `name` に `VST` が入っていても、リリースの前に指摘が届きませんでした。

### 0.1.29 (2026-11-19)

- 表示名・カテゴリ・宣言の配布物を版ごとに扱い、掲載中の版の値を表示するようにしました。これまでは、掲載されていない新しい版 (確認待ちや条件を満たさない版) が宣言ファイルの `name` を変えると、掲載中の古い版の表示名が書き換わっていました。宣言の配布物 (`assets`) も同じで、新しい版の `pattern` で、掲載中の版の配布物の絞り込みが食い違うおそれがありました。配信プラグイン倉庫くん 0.3.5 の修正と同じ趣旨です。
- 表示名と宣言の配布物は、版ごとに保存している宣言 (`release_checks.config_json`) から読みます。各版の配布物の判定も、その版自身の宣言で行います。カテゴリは宣言ではなく中身の検査からの推定のため、マイグレーション `0009_category_per_release.sql` で `release_checks` に列を足して版ごとに保存します。判定を終えた既存の行には `plugins` の今のカテゴリを写し、今の表示を変えません。判定待ちの行には写しません。
- 掲載中の版が無い間 (停止・掲載の終了・検査中) は、最後に掲載していた版の値を表示します。一度も掲載していなければ、宣言の判定が `ok` か `missing` の版のうちいちばん新しい版の値を使います。検査を通っていない新しい版の名前を、公開のページに出さないためです。
- `plugins` の `display_name`・`declared_assets`・`category` は、以後は読みも書きもしません。管理コマンドの `set-category` は全版のカテゴリを書き、`show` は版ごとの表示名とカテゴリを表示します。

### 0.1.28 (2026-11-19)

- 無料のタグを付け分けました。有料の機能か外部の有料サービスを申告したものは「入手は無料」、それ以外は「無料」です。すべてを「入手は無料」にすると、無料のプラグインに留保の含みが付くためです。配信プラグイン倉庫くんと同じ扱いです。
- 作者向けの最重要の文に、有料の機能や外部の有料サービスは申告が要り、申告が無いと無料と表示されることを足しました。
- ヘッダーの副題を「無料で入手できるオーディオプラグインの倉庫」にしました。オープンソースの語を外し、配信プラグイン倉庫くんの副題と同じ組み立てにそろえました。オープンソースであることは、サイトの説明文と掲載の条件で示します。

### 0.1.27 (2026-11-19)

- 詳細ページで、本サービスが確かめたライセンスの SPDX 識別子を、SPDX のライセンスの本文へリンクしました。利用者が再配布の条件を本文で確かめられるようにするためです。配信プラグイン倉庫くんと同じ扱いです。
- 詳細ページに商用利用の 1 行を置きました。コードはライセンスの条件にしたがって商用利用できること (本サービスが確認) と、同梱素材の制限の作者の申告から組み立てます。外部の有料サービスがあるときは、その規約も確かめるよう添えます。
- ヘッダーの副題を「無料で入手できる、オープンソースのオーディオプラグインの倉庫」にし、注意の帯から無料の語を外しました。
- 一覧のカードと詳細ページの見出しの下に、掲載中のすべてのプラグインへ「入手は無料」のタグを付けます。素材の制限を申告したものには「素材に商用利用の制限あり」、それ以外には「商用利用可」を付け、2 つは同時に出しません。有料の機能を申告したものには「有料の機能あり」、外部の有料サービスを申告したものには「外部の有料サービスが必要」を付けます。両方なら両方を付けます。タグの見た目は、規格のタグも含めてすべて同じにしました。カードの区切りの点線と余白が、カードの中のタグにも当たっていた不具合を直しました。
- 作者向けの最重要の文の末尾に、商用利用を制限する同梱素材は `restrictedAssets` で申告すること、申告が無いと商用利用可と表示されることを足しました。
- 作者向けの最重要の文 (掲載するとファイルは誰でも無料で入手でき、コードはライセンスの条件にしたがって誰でも商用利用・再配布できること、ファイルの販売だけで収益を得たい場合や商用利用を制限したい場合は掲載の対象にならないこと) を、`/submit` と `/policy` の先頭の枠、MCP の説明の作者向けの部分と `submit_plugin` の説明の最初、確認のモードの結果の `important` に置きました。作者が意図しない形の商用利用を、掲載の後に取り消せないためです。以上は配信プラグイン倉庫くんの 0.3.2 と同じ内容です。

### 0.1.26 (2026-11-19)

- 宣言ファイル `.audio-soko-kun/config.json` に、作者の申告の任意の 4 項目を足しました。`paidFeatures` (支払いで解放する機能)・`paidServices` (利用者が別に契約する有料サービス)・`restrictedAssets` (同梱素材の利用の制限)・`supportUrl` (支援・購入のページ) です。利用者が費用と商用の利用の条件を判断でき、作者が有料の配布の扱いを分かるようにするためです。形の誤りでは掲載を止めず、その項目を申告なしとして扱います。申告は版ごとに持ち、掲載中の版の値を表示します。配信プラグイン倉庫くんの 0.3.0 と同じ仕様です。
- Web の詳細ページで、本サービスが確かめたライセンスと作者の申告を分けて表示します。申告の無い項目は「作者の申告なし」と表示します。一覧には申告のタグを付けます。
- MCP の `search_plugins` と `get_plugin` に、`license` (`{ spdx, openSource }`) と `declared` を足し、`paidServices` と `supportUrl` は `untrusted` に入れました。`search_plugins` に絞り込みの `excludePaid` と `excludeRestrictedAssets` を足しました。申告なしのものは除きません。MCP の説明に、入手は常に無料であること、ソースを公開しない有料の配布は掲載しないこと、申告は確かめていないことを書きました。
- `list_my_plugins` に、掲載を止めない注意 `notices` を足しました。掲載中の版に申告が無いときの `declarations_missing` と、申告の形の誤りを返します。`submit_plugin` の確認のモードも、申告の形の誤りを返します。
- レビューに推奨の項目 `pricing-declaration` を足しました。申告と README の記述の食い違いを指摘し、掲載は止めません。
- 掲載ポリシー・登録のページ・サービスの説明・通報のページ (7 言語) に、有料の配布の 3 つの型と扱い、申告の書き方、オーディオプラグインのライセンスの手引きを書きました。利用規約は変えていません。

### 0.1.25 (2026-11-18)

- `list_my_plugins` と `submit_plugin` の確認のモードで、レビューの指摘の説明文 (`explanation`) と根拠のファイルのパスと行 (`evidence`) を、指摘ごとの `untrusted` の枠に入れて返します。パスと行は 200 文字までに切り詰めます。どちらもリポジトリの内容に左右される文字列で、リポジトリに書き込める者が作者の AI へ文を届けられないようにするためです。
- 指摘に `judgedBy` (`rule` または `llm`) を足しました。項目の定義から決めるため、LLM が説明文をルールの文言で書き始めても、ルールの判定には見えません。これまでの「説明文が `Checked by rules` で始まる指摘はルールの判定」という案内を、この欄に置き換えました。配信プラグイン倉庫くんと形をそろえ、姉妹版で先に直しました。
- 作者向けのスキル `audio-plugin-dev` の説明を、この形に合わせました (1.0.2)。

### 0.1.24 (2026-11-18)

- MCP の `search_plugins`・`get_plugin`・`list_my_plugins` で、プラグインの表示名・配布物名・アーカイブの中の VST 2 のファイルの名前を `untrusted` の枠に入れて返します。表示名は `untrusted.name`、配布物名は配布物の各要素の `untrusted.name` です。これらは作者が書ける文字列で、悪意のある作者が利用者や作者の AI へ文を届けられないようにするためです。応答の形が変わり、これまでの `name` の欄は無くなりました。ダウンロードの URL は配布物を指すため、枠の外に置いたままです。配信プラグイン倉庫くんと形をそろえ、姉妹版で先に直しました。
- `admin pending` で、掲載中の版より前に公開された版を表示しないようにしました (前回の PR #37 で取り込み済み)。
- 作者向けのスキル `audio-plugin-dev` の `untrusted` の説明を、この形に合わせました (1.0.1)。

### 0.1.23 (2026-11-17)

- `submit_plugin` の確認のモードで、既定のブランチの名前に `/` を含むリポジトリ (`release/1.x` など) が内部エラーになる不具合を直しました。宣言ファイル・ファイルの一覧・文書を、ブランチの名前ではなく `HEAD` で読みます。GitHub の API のパスの検査は緩めていません。配信プラグイン倉庫くんの 0.2.21 と同じ修正です。

### 0.1.22 (2026-11-17)

- 作者向けのスキル `audio-plugin-dev` を、Claude Code のプラグイン `audio-soko-kun-plugin-dev` としてこのリポジトリに同梱しました。企画から掲載までの 7 段の手順と、そのままビルドして検証を通せるプロジェクトの雛形を含みます。第三者の作者が、掲載の条件と審査の基準を満たすプラグインを作れるようにするためです。
- MCP の説明と、プラグインを登録するページ (7 言語) に、スキルの入れ方を足しました。README の使い方と内容物にも記載しました。

### 0.1.21 (2026-11-17)

- 推奨の `agent-editor-config` を足しました。リポジトリのファイルの一覧に、エージェントとエディターの設定 (`CLAUDE.md`・`AGENTS.md`・`.claude/`・`.codex/`・`.cursor/`・`.windsurf/`・`.vscode/`・`.vs/`・`.idea/` など) があれば、当たった場所を返します。これらのファイルも審査の対象になり、意図しない指摘や管理者の確認待ちを招くためです。推奨のため掲載は止めず、意図して共有するものは対応不要です。審査の対象から外すことはしません。配信プラグイン倉庫くんと定義をそろえ、本家より先に入れました。

### 0.1.20 (2026-11-17)

- `submit_plugin` の確認のモードでも、README 以外の文書を新しい版の検査と同じ選び方で照合します。照合できなかったときも重大の指摘にします。作者が不変のリリースの公開の前に当たりを直せるようにするためです。配信プラグイン倉庫くんの 0.2.19 と同じ修正です。
- `list_my_plugins` の `checkAgainAfter` を、検査の上限の時刻から、次に確かめる時刻 (次の定期処理の区切りの 5 分後) に改めました。作者の AI が上限の時刻を完了の見込みと読み、重大の指摘で確認待ちになった後も待ち続けないようにするためです。配信プラグイン倉庫くんの 0.2.19 と同じ修正です。
- `list_my_plugins` と `submit_plugin` の確認のモードで、差分の規則の当たりのファイル名とレビューで読まなかったファイルのパスを `untrusted` の枠に入れ、200 文字までに切り詰めて返します。2 つのツールの説明に `untrusted` の扱いを書きました。リポジトリに書き込める者が、ファイル名で作者の AI へ文を届けられないようにするためです。配信プラグイン倉庫くんの 0.2.18 と同じ修正です。

### 0.1.19 (2026-11-16)

- 新しい版の検査で GitHub に渡す参照を、タグの名前から、同期で記録した版のコミット SHA に替えました。差分・宣言ファイル・ライセンス・レビューのファイルをそのコミットで読みます。コミット SHA はタグの完全な参照名 (`refs/tags/<タグ>`) で解決し、登録の時点のライセンスもそのコミットで判定します。タグと同じ名前のブランチで検査の対象を変えられないようにするためです。配信プラグイン倉庫くんの 0.2.17 と同じ修正です。

### 0.1.18 (2026-11-16)

- 画面の下部に、姉妹サービスの配信プラグイン倉庫くん (OBS Studio のプラグイン) へのリンクの 1 行を置きました。表示中の言語を引き継ぎます。配信プラグイン倉庫くんの下部にも、本サービスへの同じ形の 1 行があります。

### 0.1.17 (2026-11-16)

- 検索で、プラグインの表示名 (宣言ファイルの `name`) の語でも見つかるようにしました。これまでは所有者名、リポジトリ名、概要、概要の訳、分類だけを照合しており、リポジトリ名と異なる表示名で探しても見つかりませんでした。MCP の `search_plugins` とサイトの検索の両方に効きます。配信プラグイン倉庫くんの同じ修正を写しました。

### 0.1.16 (2026-11-15)

- `submit_plugin` の確認のモードの上限 (GitHub のアカウントごとに直近 24 時間で 5 回) で断るとき、次に使える時刻 `resumesAt` を返します。時刻は、直近 24 時間の利用を新しい順に並べた 5 番目の 24 時間後です。作者の AI が、待つ時間の分からないまま呼び直さないようにするためです。配信プラグイン倉庫くんの 0.2.14 を写しました。

### 0.1.15 (2026-11-15)

- 通信の API の検出で、拡張子とディレクトリの名前による絞り込みをやめ、`.git` を除くすべてのテキストファイルを探します。`#include` で取り込む別の拡張子や大文字の拡張子、`build` と `target` の配下に置いた通信の処理を見逃していたためです。JUCE を同梱した作者の誤検出を避けるため、JUCE の配置 (`modules/juce_core/`) のファイルだけを捨てます。UTF-8 として読めない文字を含む行も当てます。ツリーの全体を読むのを 1 回にまとめ、範囲を広げても探索の時間を延ばさないようにしました。

### 0.1.14 (2026-11-15)

- 古い版の宣言ファイルを後から判定し直すと、新しい版の宣言で決まった表示名・カテゴリ・配布物の宣言を古い版の値で上書きしていた不具合を直しました。より新しい版に判定済みの宣言があれば、プラグインの値を替えません。古い版の配布物の名前の型が新しい版のファイル名に合わないと、新しい版の配布物が案内から外れ、掲載が旧い版に移っていました。

### 0.1.13 (2026-11-15)

- 公式の MCP Registry への登録の定義 `server.json` を足しました。名前は `io.github.AllegroMoltoV/audio-plugin-soko-kun` で、エンドポイントは `https://audio-soko-kun.allegromoltov.jp/mcp` です。登録と更新の手順を [公式 MCP Registry への登録](docs/operations/mcp-registry.md) に記載しました。

### 0.1.12 (2026-11-15)

- 依存のパッケージを更新しました。実行時に使う `hono` を 4.13.18 に、開発用の `@cloudflare/vitest-plugin` を 1.8.0、`@cloudflare/workers-types` を 5.20261110.1、`msw` を 3.0.5、`wrangler` を 4.160.1 にしました。Dependabot が作った 2 件の更新を、現在の main に合わせて取り込みました。

### 0.1.11 (2026-11-15)

- 版やプラグインが管理者の確認待ちになったとき、管理者だけが見られる Discord のチャンネルへ、確認待ちの理由ごとに 1 回通知します。誤検出のたびに審査の規則を緩めず、管理者が気づいて承認できるようにするためです。通知は定期処理の最後に、2 つの検証のワークフローの起動の後で送ります。配信プラグイン倉庫くんの 0.2.13 の該当部分を写しました。
- 通知した理由を記録する表を、マイグレーション `0008_admin_notifications.sql` で足しました。秘密情報 `DISCORD_WEBHOOK_URL` が無い環境では通知しません。

### 0.1.10 (2026-11-15)

- 乗っ取りの兆候の差分の規則で、細工したパスや行による見逃しを塞ぎました。空白や非 ASCII を含むパスの見出しも必ずファイルの区切りとして扱い、ワークフローの変更を見出しの行で判定します。変更の塊の中では `+++` で始まる行も追加の行として照合します。バイナリの削除は `deleted file mode` の行だけで判定し、名前が ` and /dev/null` で終わるファイルの追加を削除と取り違えないようにしました。
- GitHub の呼び出しの `getRulesets` を、配信プラグイン倉庫くんと同じ実装にそろえました。挙動は変わりません。配信プラグイン倉庫くんの 0.2.13 の該当部分を写しました。

### 0.1.9 (2026-11-15)

- 掲載の後も、既定のブランチの README を 1 日 1 回、審査の基準 `no-security-bypass` と `no-terminal-paste` で照合します。新しい版のレビューはタグの時点の README を照合するため、掲載の後に足された案内を次の版まで検知できなかったためです。照合はダウンロード数の記録と同じ回に行い、記録と照合の 2 件の予算が残らないときは記録ごと次の起動へ回します。
- 最初の照合は基準の記録だけにします。基準に無い案内が現れたとき、README が新たに上限を超えたとき、照合に失敗したときは、管理者が確かめるまでプラグインのどの版も掲載しません。作者には `list_my_plugins` の理由 `readme_held` として返します。
- 管理コマンドの `pending` に、この確認待ちのプラグインと当たった行を表示し、`approve-readme` で解けるようにしました。マイグレーション `0007_readme_watch.sql` で、`plugins` に `readme_state`・`readme_hits`・`readme_held` の列を足しました。設計書・運用の文書・作者向けのページ (7 言語) を更新しました。配信プラグイン倉庫くんの 0.2.12 を写しました。

### 0.1.8 (2026-11-15)

- 審査の基準 `no-security-bypass` と `no-terminal-paste` で、README のほかに、リリースノートと README 以外の文書も照合します。リリースノートは同期・登録・ダウンロード数の記録で受け取る本文をその場で照合し、本文は保存しません。承認の後に本文を編集して案内を足した版は、承認を取り消して管理者の確認待ちに戻します。README 以外の文書は、検証のワークフローが通信の検出と同じ取り出しで照合します。照合の型は、Worker と GitHub Actions で共有するファイル `src/review/guidance-patterns.mjs` に移しました。照合の結果が期限までに届かなかった版は、2 つの項目を重大の指摘にします。配信プラグイン倉庫くんの 0.2.10 を写しました。
- `submit_plugin` の確認のモードで、リリースがまだ無いときも、リリースを要る条件を未判定として直し方とともに返します。あわせて、既定のブランチの `.audio-soko-kun/config.json` の形を確かめて返します。不変のリリースは公開の後に直せないため、作者が公開の前に問題に気づけるようにしました。
- `list_my_plugins` の再開の目安の時刻を、版の公開の時刻からの上限にしました。呼ぶたびに時刻が後ろへ動き、検査が延びたと誤って説明される問題を直しました。
- `repository-protection` の直し方に、1 人で開発する作者がブランチの ruleset の例外にリポジトリの管理者を「For pull requests only」で足す設定を書きました。`get_plugin` と `list_my_plugins` の説明に audio plugin を足しました。以上は配信プラグイン倉庫くんの 0.2.11 を写しました。
- 作者向けのページ (7 言語) に、確認のモードのサインイン、下書きのリリースに配布物を添付してから公開する手順、案内の型のルールが否定の文にも当たること、宣言ファイルの最小の例、カテゴリの決め方、CLAP の features をカテゴリに使わないことを書きました。README の導入の手順を LLM が判定するとしていたセキュリティのページの記述を、ルールで判定する実装に合わせて直しました。`/submit` の理由の一覧に `macos_lv2_not_guided` を足し、掲載ポリシーに macOS 向けの LV2 を案内しないことを書きました。

### 0.1.7 (2026-11-15)

- 宣言ファイル `.audio-soko-kun/config.json` の一部の項目だけを書いた正しい宣言が、照合の段階で不正と判定される不具合を直しました。保存した宣言を読み直すときに、書いていない項目を不正とみなしていました。
- 宣言ファイルの判定をやり直す管理コマンド `retry-declaration` を足しました。

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
