# ADR 0002: 配信プラグイン倉庫くんの派生として独立したサービスにする

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../images/VST_Compatible_Logo_Steinberg_negative.png">
  <img src="../images/VST_Compatible_Logo_Steinberg.png" alt="VST Compatible" width="120">
</picture>

VST® is a registered trademark of Steinberg Media Technologies GmbH.

- 状態: 採用 (2026-11-14)。コードを独立に保守する判断の一部を [ADR 0005](0005-shared-foundation-with-soko-kun.md) で置き換えた

## 背景

配信プラグイン倉庫くん (https://soko-kun.allegromoltov.jp、GitHub: AllegroMoltoV/plugin-soko-kun) は、GitHub Releases で公開された OBS Studio のプラグインを検査して掲載する非公式のレジストリです。配布物を預からず、作者が公開したファイルへ案内します。MCP を主な操作手段にしています。

同じ仕組みで、VST 3・CLAP・LV2・Audio Unit のオーディオプラグインを掲載したいと考えました。

オーディオプラグインには、近い仕組みの先行事例として Open Audio Stack Registry があります。作者が YAML の宣言を pull request で追加し、sha256 の照合と VirusTotal への照会を経て、人がマージします。2026-11-14 時点で 640 パッケージを掲載しています (非公開の調査記録)。

倉庫くんと Open Audio Stack Registry の違いは、次の 4 点です。

- build provenance の証明 (artifact attestation) の検証
- MalwareBazaar への照会
- LLM による開発の実践のレビュー
- MCP による検索と登録

## 決定

倉庫くんの派生として、オーディオプラグインのための独立したサービスを作ります。上の 4 点を差別化の中心に置きます。倉庫くんの設計と判断のうち、OBS に依存しない部分を引き継ぎます。

コードは倉庫くんから写し、以後は独立に保守します。OBS Studio とオーディオプラグインでは、関わるライセンスもコミュニティも違います。それぞれの事情に合わせて変えられるほうが、保守しやすいと判断しました。

| コードの扱いの選択肢 | 判断 |
| --- | --- |
| 倉庫くんのコードを写し、独立に保守する | 採用しました |
| 共通の部分を倉庫くんから切り出して共有する | 採用しませんでした。片方の事情による変更が、もう片方に影響します |
| 同じコードを設定だけ変えて 2 回配備する | 採用しませんでした。OBS とオーディオの違いが、設定の分岐として同じコードに積み重なります |

## 検討した選択肢

| 選択肢 | 判断 |
| --- | --- |
| 倉庫くんの派生として独立したサービスを作る | 採用しました。倉庫くんのコードと判断の大半を引き継げます。掲載の条件を独自に決められます |
| 新しいサービスは作らず、Open Audio Stack Registry に証明の検証などを提案する | 採用しませんでした。運営の負担は無くなりますが、提案が採用される保証が無く、MCP と LLM のレビューは実現できません |
| 倉庫くん本体にオーディオプラグインの区分を足す | 採用しませんでした。倉庫くんの名前と利用者層 (配信者) が合いません。OBS Studio に同梱の obs-vst は VST 2 しか読み込めないため、配信者と音楽制作者の重なりは小さいと考えました |

## 影響

運営するサービスが 2 つになります。共通の不具合やセキュリティの修正は、両方のリポジトリに行う必要があります。

倉庫くんのうち、OBS に依存する部分は作り直します。掲載対象の判定、宣言ファイル、審査の基準、カテゴリ、文言が該当します。
