# 文書索引

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="images/VST_Compatible_Logo_Steinberg_negative.png">
  <img src="images/VST_Compatible_Logo_Steinberg.png" alt="VST Compatible" width="120">
</picture>

VST® is a registered trademark of Steinberg Media Technologies GmbH.

公開する文書の索引です。docs/ には、製品の現在の設計と確定した判断を置きます。

| 知りたいこと | 参照先 | 区分 |
| --- | --- | --- |
| プロジェクトの目的と使い方、更新履歴 | [README](../README.md) | |
| 用語の定義 | [用語集](glossary.md) | リファレンス |
| 構成要素と要求の流れ | [アーキテクチャ](design/architecture.md) | リファレンス |
| テーブルと掲載状態の算出規則 | [データモデル](design/data-model.md) | リファレンス |
| 認可の流れとスコープ | [認証と認可](design/auth.md) | リファレンス |
| 登録・検査・同期・配布物の検証の処理と 1 回の起動の予算 | [検査と同期](design/scanning.md) | リファレンス |
| 新しい版を掲載する前に確かめる項目 | [審査の基準](design/review-criteria.md) | リファレンス |
| 作者の LLM へ検査とレビューの結果を返す MCP のツール | [作者へのレビューの返し方](design/author-feedback.md) | リファレンス |
| 対応言語と言語の判定 | [多言語対応](design/i18n.md) | リファレンス |
| 画面の一覧と各画面の要素、VST の語の表示 | [画面構成](design/ui.md) | リファレンス |
| 自動テストで守るラインとテストシナリオ | [テストの設計](design/testing.md) | リファレンス |

残りの論点は、設計文書の「未決定の事項」の節に、決める時点とあわせて記載しています。

## 運用

運営者が本サービスを開発・配備・運用するときの手順です。

| 知りたいこと | 参照先 | 区分 |
| --- | --- | --- |
| 手元の PC での Worker の起動、ローカルの D1 のマイグレーション、テスト | [ローカルでの開発](operations/local-development.md) | ハウツーガイド |
| ワークフローの目的と権限、秘密情報、本番の配備 | [CI と配備](operations/ci-cd.md) | ハウツーガイド |
| 管理コマンド、プラグインと版の停止と再開、確認待ちの版の承認、通報の対応 | [管理コマンドと掲載停止](operations/suspend.md) | ハウツーガイド |
| 作者のアカウントの乗っ取りや悪意のある版が疑われるときの対応 | [侵害の対応](operations/incident-response.md) | ハウツーガイド |
| 本番の D1 のバックアップと復元 | [バックアップと復元](operations/backup.md) | ハウツーガイド |

## 設計判断の記録

確定した設計判断と、未決定の論点を 1 件 1 ファイルで記録します。区分はいずれも解説です。

| 番号 | 判断 | 状態 |
| --- | --- | --- |
| 0001 | [公開文書と作業記録の分担](decisions/0001-docs-and-work-records.md) | 採用 |
| 0002 | [配信プラグイン倉庫くんの派生として独立したサービスにする](decisions/0002-independent-service-derived-from-soko-kun.md) | 採用。一部を 0005 で置き換え |
| 0003 | [掲載の条件](decisions/0003-listing-conditions.md) | 採用 |
| 0004 | [VST の商標の扱いと対象の規格](decisions/0004-vst-trademark.md) | 採用 |
| 0005 | [共通の土台を配信プラグイン倉庫くんと同じ内容に保つ](decisions/0005-shared-foundation-with-soko-kun.md) | 採用 |

作業の記録 (調査報告、実行ログ、計画、運営者との確認事項) は公開せず、git の追跡対象外に置きます。その索引は `.prompts/INDEX.md` にあります。
