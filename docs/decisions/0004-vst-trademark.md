# ADR 0004: VST® の商標をガイドラインの文面どおりに扱い、対象を VST 3・CLAP・LV2・Audio Unit にする

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../images/VST_Compatible_Logo_Steinberg_negative.png">
  <img src="../images/VST_Compatible_Logo_Steinberg.png" alt="VST Compatible" width="120">
</picture>

VST® is a registered trademark of Steinberg Media Technologies GmbH.

- 状態: 採用 (2026-11-14)

## 背景

VST は Steinberg Media Technologies GmbH の登録商標です。VST 3 SDK は 3.8 (2025-10) から MIT ライセンスになり、プラグインの開発と配布に Steinberg との契約は要らなくなりました。商標の扱いは MIT とは別に、Steinberg VST usage guidelines (https://steinbergmedia.github.io/vst3_dev_portal/pages/VST+3+Licensing/Usage+guidelines.html) にしたがいます。

ガイドラインの要点は次のとおりです。

- 社名とロゴに VST を使えない。ドメイン名は、互換性への言及であり単独のブランドでない場合に限る
- VST の語を表示するウェブページには VST Compatible ロゴが要る。サイト全体のフッターだけの表示では足りない
- VST の語の初出に ® を付け、指定の注記を書く
- VST のカテゴリと URL には、VST SDK を使った製品だけを載せる

ストアやレジストリのように、他者の製品を一覧する第三者のサービスへの適用範囲は、ガイドラインに明記がありません。Steinberg は、VST を含むドメインに対して紛争処理の申し立てを繰り返しています。

VST 2 は、2018 年 10 月より前に Steinberg と契約した開発者でなければ、新たに配布できません。AAX は、Avid との契約と iLok による電子署名が前提です。

## 決定

サービス名とドメインに VST を入れません。独自の名称に、オーディオプラグインという一般語を添えます。

掲載の対象は VST 3・CLAP・LV2・Audio Unit とします。VST 2 と AAX は対象外です。

Steinberg へ適用範囲を問い合わせず、ガイドラインの文面にすべてしたがいます。

- VST の語を表示するすべてのページで、その語の近くに VST Compatible ロゴを置く。プラグインの詳細のページでは「VST® 3」の表示の隣に置く。一覧と検索のページで、カードの規格のタグや絞り込みの選択肢に VST の語を出す場合も、同じページにロゴを置く。ロゴは掲載したプラグインの互換性を示すためだけに使い、サイトの装飾やブランドには使わない
- ページに「VST is a registered trademark of Steinberg Media Technologies GmbH.」と注記する
- VST 3 での絞り込みには、配布物に VST 3 のバンドルを検出したプラグインだけを出す
- 作者には、プラグインの名前に VST を入れないよう案内する。SDK の README の禁止事項にしたがうためです

ロゴは Steinberg の VST 3 SDK の配布物に含まれる公式のファイルを使い、ガイドラインの最小サイズを守ります。

## 検討した選択肢

| 選択肢 | 判断 |
| --- | --- |
| ガイドラインの文面にすべてしたがう | 採用しました。問い合わせの回答を待たずに、文面上の条件を満たせます |
| 公開前に Steinberg へ適用範囲を問い合わせ、ロゴを使わずに注記だけを表示する | 採用しませんでした。回答の有無と時期が分からず、回答が無い場合の扱いが決まりません |
| KVR Audio などと同じく、形式名だけを書いてロゴも注記も表示しない | 採用しませんでした。ガイドライン第 4 節の文面に反すると分かったうえで運用することになります |
| サービスで VST の語を使わない | 採用しませんでした。音楽制作者の多くは VST 3 を基準にプラグインを探すため、対応形式が伝わりません |

## 影響

VST 3 に対応したプラグインのページには、ロゴが表示されます。ほかの形式とは表示が揃いません。

Steinberg が第三者のレジストリによるロゴの使用を認めない可能性は残ります。指摘を受けた場合は、ロゴの表示を外すか、VST の語の表示をやめます。

VST 3 SDK を使わずに VST 3 のインターフェースを実装したプラグインは、配布物から見分けられません。VST 3 での絞り込みに混ざる可能性があります。

VST 2 のプラグインを掲載しないため、配布物の検査で VST 2 のエントリーポイントを検出する必要があります。
