# 審査の基準

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../images/VST_Compatible_Logo_Steinberg_negative.png">
  <img src="../images/VST_Compatible_Logo_Steinberg.png" alt="VST Compatible" width="120">
</picture>

VST® is a registered trademark of Steinberg Media Technologies GmbH.

新しい版を掲載する前に確かめる項目の一覧です。本文書が審査の基準の正本です。MCP で作者に返す固定の文言 (英語) は、本サービスのリポジトリに項目の ID ごとに持ち、本文書の ID と一致することをテストで確かめる予定です。作者への返し方は [作者へのレビューの返し方](author-feedback.md) に記載します。

配信プラグイン倉庫くんの [審査の基準](https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md) を引き継ぎ、OBS Studio に固有の項目をオーディオプラグインの項目に置き換えています。

## 基準の出典

基準は、配信プラグイン倉庫くんと同じく、OBS のプラグインの開発者である宇田川海斗さん (umireon) が公開物で述べている供給網の攻撃への懸念と推奨を出発点にしています。宇田川さんは、プラグインが公開前の映像と音声に触れるため、供給網の攻撃の標的になると指摘しています。オーディオプラグインも、DAW のプロセスの中で動作し、未発表の楽曲とプロジェクトのファイルに触れます。1 つの DAW に多数のプラグインを読み込むため、1 本の悪意あるプラグインがプロジェクト全体に触れられます。そのため、同じ懸念が当てはまると考えています。

宇田川さんの主な公開物は次のとおりです。

- スライド「モダン OBS プラグイン開発」: https://speakerdeck.com/umireon/modanobspuraguinkai-fa
- Qiita の記事へのコメント: https://qiita.com/AllegroMoltoV/items/bdb672f2b8d33acdd20e
- live-backgroundremoval-lite のリポジトリ: https://github.com/kaito-tokyo/live-backgroundremoval-lite
- obs-backgroundremoval の Issue と PR: https://github.com/royshil/obs-backgroundremoval

オーディオプラグインに固有の項目は、次を出典にしています。

- Steinberg VST usage guidelines: https://steinbergmedia.github.io/vst3_dev_portal/pages/VST+3+Licensing/Usage+guidelines.html
- オーディオプラグインを装うマルウェアの報告 (非公開の調査記録)。2019 年の LoudMiner、2020 年の ThiefQuest、2026 年の音楽プラグインの DMG を装うローダーが例です。2026 年には、乗っ取られた YouTube のアカウントから GitHub へ誘導し、Ableton や Kontakt を装う偽のインストーラーを配った例が報告されています。偽の GitHub のリポジトリには、README だけを置いて端末へのコマンドの貼り付けを求めるものがあります
- 無料や個人のオーディオプラグインの README の調査 (非公開の調査記録)。macOS の Gatekeeper の隔離属性を外す `xattr -rd com.apple.quarantine` を案内する例が多く見られます

宇田川さんのプロジェクトの方針のうち、生成 AI の出力を製品に入れないことなどは採りません。本サービスは、AI の利用の有無を掲載に影響させないためです。

## 区分

項目は次の 4 つの区分に分けます。

| 区分 | 判定 | 掲載への影響 |
| --- | --- | --- |
| 掲載の条件 | ルール | 満たさない版は掲載しない。または満たさない配布物を案内しない。作者に理由と直し方を返す |
| 乗っ取りの兆候 | ルール | 当たった版は管理者の確認待ちにする |
| 審査の基準 | LLM またはルール | 重大な指摘は管理者の確認待ちにする。それ以外は作者に直すことを勧める |
| 推奨 | LLM またはルール | 掲載に影響しない。参考として作者に返す |

## 掲載の条件

[ADR 0003](../decisions/0003-listing-conditions.md) と [ADR 0004](../decisions/0004-vst-trademark.md) の条件と、掲載の対象をオープンソースのプラグインに限る条件です。

| ID | 内容 | 判定の観点 | 満たさないとき | 出典 |
| --- | --- | --- | --- | --- |
| `immutable-release` | リリースが不変 (immutable) である | GitHub のリリースの API の `immutable` が true | 版を掲載しない | obs-backgroundremoval Issue 775 |
| `distribution-format` | 案内する配布物は zip のアーカイブである | 配布物のファイル名の拡張子。インストーラー (`.exe`・`.msi`・`.pkg`・`.dmg`) と zip 以外のファイルは案内しない。アーカイブが無い版は掲載しない | アーカイブが無ければ版を掲載しない。インストーラーは案内しないだけ | ADR 0003、Qiita のコメント、obs-backgroundremoval Issue 832 |
| `attestation` | リリースのすべての配布物に、build provenance の証明がある。案内しないインストーラーと zip 以外のファイルも含む | 証明の署名を検証し、ソースのリポジトリがこのリポジトリ、ソースの参照が `refs/tags/<タグ>`、ソースのコミットがタグのコミット、署名したワークフローが記録したリリースのワークフローに一致する | 版を掲載しない | ADR 0003、スライド 16 枚目、Qiita のコメント、obs-backgroundremoval Issue 775 |
| `plugin-content` | アーカイブに、VST 3・CLAP・LV2・Audio Unit のいずれかのバンドルがある | 中身の検査で規格のバンドルを 1 つ以上検出する。規則は [検査と同期](scanning.md) の「中身の検査」に記載する | バンドルの無いアーカイブは案内しない。案内するアーカイブが無ければ版を掲載しない | ADR 0004 |
| `no-vst2` | 配布物に VST 2 のプラグインが無い | 中身の検査で、`.vst` のバンドルと、VST 2 のエントリーポイント (`VSTPluginMain`、`main_macho`、共有ライブラリの `main`) をエクスポートするバイナリを検出しない。中を調べられないものを含む判定不能のアーカイブは合格にしない | 版を掲載しない | ADR 0004 |
| `macos-signing` | macOS 向けのバンドルに、Developer ID の署名と Apple の公証がある | 署名と公証の判定。規則は [検査と同期](scanning.md) の「署名と公証の判定」に記載する | その配布物を案内しない。macOS の配布物だけの版は掲載しない | ADR 0003、obs-backgroundremoval Issue 971 |
| `declaration` | 宣言ファイルがあれば、形が正しく、中身の検査の結果と食い違わない。宣言ファイルは任意 | [検査と同期](scanning.md) の「宣言ファイル」の規則 | 版を掲載しない | 配信プラグイン倉庫くんの宣言ファイル |
| `open-source-license` | 版のタグの時点のライセンスが、OSI の承認か FSF の自由なライセンスの認定を持つ | GitHub の `/license?ref=<タグ>` の SPDX 識別子を、本サービスのリポジトリに固定して置く SPDX License List の JSON の `isOsiApproved` と `isFsfLibre` で判定する。LLM では判定しない。規則は [検査と同期](scanning.md) の「ライセンスの判定」に記載する | 版を掲載しない | 運営者の方針 |

署名したワークフローは、初めて証明を検証できた版のものを記録します。以後の版で違うワークフローが署名していれば、証明の検証を失敗とします。

macOS の条件は、安全の証拠として求めるものではありません。Apple の公証は提出時の検査で、公証を通ったマルウェアの例が 2025 年に複数報告されています (非公開の調査記録)。利用者にセキュリティ機能の解除を求めずに済むよう、署名と公証のある配布物だけを案内します。

Windows の署名は条件にしません。日本の個人の作者が Windows の署名を無償で得る手段は、SignPath Foundation のオープンソースの枠のほかに見つかっていません。Azure Artifact Signing は、個人では米国とカナダの在住者だけが使えます (非公開の調査記録)。

## 乗っ取りの兆候

掲載中の版のタグから新しい版のタグまでの差分で判定します。差分は先頭の 24,000 文字までを読みます。

| ID | 内容 |
| --- | --- |
| `diff-workflow-changed` | `.github/workflows/`・`.github/actions/`・`.github/scripts/` 配下のファイルが変わった |
| `diff-binary-added` | バイナリのファイルが追加または変更された。削除は当たらない |
| `diff-external-link` | このリポジトリ・本サービス・許可するホスト以外のホストへのリンクやダウンロードが追加された |
| `diff-too-large` | 差分が 24,000 文字を超えた |
| `owner-changed` | リポジトリの所有者が、登録したときから別のアカウントか組織に変わった。差分ではなく同期で判定し、管理者が版を承認するまで、変更のあとの新しい版に当てる |
| `team-id-mismatch` | 版の macOS 向けのバンドルの署名の Team ID が、バンドルによって食い違う。差分ではなく署名と公証の判定の結果で判定する |

`diff-external-link` で許可するホストは、VST 3 の文書と VST Compatible ロゴの規則の `steinbergmedia.github.io`、CLAP の `cleveraudio.org`、LV2 の `lv2plug.in`、Audio Unit の `developer.apple.com` です。README で SDK の文書へリンクする作者が多いと考えて許可しています。配信プラグイン倉庫くんが許可していた `obsproject.com` は許可しません。

`diff-binary-added` は、差分の追加の側だけで判定し、削除の行を数えません。オーディオプラグインでは音声のサンプル・インパルス応答・プリセットの追加でも当たります。正当な変更でも管理者の確認待ちになることを、作者向けの文言で知らせます。

`diff-too-large` に当たっただけでは、版を確認待ちにしません。差分の本文が上限を超えたときは、変更されたファイルの一覧から、`.github/` 配下の変更・ビルドのスクリプトの変更・バイナリの追加・一覧を取り切れなかったことの 4 つの事実をルールで計算し、どれかに当たるときだけ確認待ちにします。オーディオプラグインの差分は大きく、上限を超えるたびに確認待ちにすると、ほとんどの新しい版で管理者の確認が要るためです。LLM は、この事実と差分の先頭を受け取って指摘を足すだけにし、確認待ちを外す判断には使いません。差分の内容は攻撃者が書けるため、LLM の出力で確認待ちを外させないようにします。

初めて登録する版には、差分の判定を当てません。

## 審査の基準

`no-security-bypass` と `no-terminal-paste` は、README と導入の手順の文字列に正規表現を当てるルールで判定します。案内の書き方の型がはっきりしていて、判定を揺らさずに済み、Workers AI の無料枠も使わないためです。ほかの項目は LLM で判定します。

LLM は、新しい版のタグの時点の `.github/workflows/`、ビルド系のファイル、README と、乗っ取りの兆候の判定に使った差分を読んで判定します。あわせて、GitHub が検出した版のタグの時点のライセンスを渡します。ビルド系のファイルの一覧は [検査と同期](scanning.md) に記載しています。

| ID | 内容 | 判定の観点 | 重大とする場合 | 出典 |
| --- | --- | --- | --- | --- |
| `ci-source-build` | リリースの配布物を、CI でソースからビルドしている | リリースの資産を作るジョブがソースからビルドしている。外部で作ったバイナリを添付するだけの手順になっていない | なし | スライド 16〜17 枚目 |
| `ci-plugin-validation` | CI で、ビルドしたプラグインを検証の道具に読み込ませている | CI が、ビルドの確認にとどまらず、pluginval・VST 3 SDK の validator・clap-validator・lv2lint・auval のような道具でプラグインを読み込み、処理を試している | なし | obs-backgroundremoval Issue 971 |
| `no-security-bypass` | 利用者にセキュリティの機能を切らせない | README や導入の手順に、次の案内が無い。macOS の `xattr -rd com.apple.quarantine`・`xattr -cr` による隔離属性の除去、`spctl --master-disable`・`spctl --global-disable` による Gatekeeper の無効化、プライバシーとセキュリティの設定での「このまま開く」の誘導、Windows の SmartScreen・Defender・Smart App Control の無効化や除外の設定 | 案内がある | obs-backgroundremoval Issue 832、obs-spout2-plugin Issue 105、ADR 0003 |
| `no-terminal-paste` | 導入のために、端末へ取得したものを実行するコマンドを貼り付けさせない | README や導入の手順に、ネットワークから取得した内容をその場で実行させるコマンドが無い。例は `curl ... \| sh`・`curl ... \| bash`、PowerShell の `irm ... \| iex`、base64 で埋め込んだ文字列を復号して実行するもの、`osascript` で取得したスクリプトを実行するもの。ソースからビルドする手順の `cmake` や `cargo` のコマンドは当たらない | 案内がある | オーディオプラグインを装うマルウェアの報告 (非公開の調査記録) |
| `dependency-pinning` | 依存をパッケージマネージャーやサブモジュールで、版を固定して入れている | ハッシュの無い URL からのダウンロードや、リポジトリに直接入れたバイナリが無い。JUCE や VST 3 SDK をサブモジュールで入れる場合はコミットを固定している | なし | スライド 17 枚目、obs-backgroundremoval Issue 644 |
| `ci-hardening` | CI を最小の権限で守っている | ワークフローの `permissions` の最小化、アクションの SHA の固定、`persist-credentials: false`、Dependabot の設定 | なし | obs-backgroundremoval PR 805、スライド 19 枚目 |
| `third-party-provenance` | 同梱する第三者の素材とバイナリの出所とライセンスを示している | リリースの配布物に同梱する第三者の音声のサンプル・インパルス応答・プリセット・フォント・画像・モデル・バイナリについて、上流の URL・版・ハッシュと、ライセンスと再配布の条件の記載。ビルドにだけ使い、同梱しないものは対象外 | なし | obs-backgroundremoval PR 974、Issue 983 |
| `license-compatibility` | プラグインと依存のライセンスが両立する | GitHub が検出したリポジトリのライセンスと依存の一覧から、両立しない組み合わせが無い。例は、AGPLv3 で使う JUCE を MIT で配るプラグイン。非営利に限るライセンスの素材を、制限の無いライセンスの配布物に同梱する例も当たる | なし | obs-backgroundremoval Issue 644 |
| `user-data-handling` | 音声・プロジェクトのファイル・設定・鍵を、利用者に知らせずに外部へ送らない | ネットワークの処理の有無と目的。オーディオプラグインでは、ライセンスの認証と更新の確認のための通信が普通にあるため、通信の有無では判定しない。送る場合は README に送り先と内容が書かれ、コードと食い違っていない | README に書かずに送る | スライド 15 枚目、obs-backgroundremoval FAQ |
| `build-hardening` | 防御のためのビルドの設定がある | Sanitizer のビルドの設定と、スタック保護のフラグ | なし | live-backgroundremoval-lite の CMakeLists.txt |

`no-terminal-paste` は、配信プラグイン倉庫くんに無い項目です。偽のオーディオソフトの配布で、README から端末へのコマンドの貼り付けに誘導する手口が報告されているため加えます。

## 推奨

| ID | 内容 | 判定 | 出典 |
| --- | --- | --- | --- |
| `windows-code-signing` | Windows のバイナリに Authenticode の署名を付ける。署名の無いバイナリは Smart App Control で読み込みを止められることがある | ルール (将来) | obs-backgroundremoval Issue 965 |
| `plugin-name` | プラグインの名前とリポジトリ名に VST を含めない | ルール | VST 3 SDK の README、[ADR 0004](../decisions/0004-vst-trademark.md) |
| `no-impersonation` | 有名な商用のプラグインの名前や、crack・keygen のような語を名前に含めない | ルール (将来) | オーディオプラグインを装うマルウェアの報告 (非公開の調査記録) |
| `user-verification-guide` | 利用者に、ダウンロードしたファイルを検証する手順を示す。例は `gh attestation verify` | LLM | live-backgroundremoval-lite の開発者ノート |
| `install-location` | README で、規格ごとの標準の導入先を示す。例は Windows の `C:\Program Files\Common Files\VST3` と `C:\Program Files\Common Files\CLAP`、macOS の `~/Library/Audio/Plug-Ins/` の下の規格ごとのフォルダー | LLM | obs-backgroundremoval Issue 832 |
| `stable-plugin-id` | 版を重ねても、プラグインの ID を変えない。対象は CLAP の ID、VST 3 のクラス ID、Audio Unit の type・subtype・manufacturer、LV2 の URI | ルール (将来) | 非公開の調査記録。DAW はプロジェクトの中のプラグインを ID で探すため、ID が変わると保存したプロジェクトが開けなくなる |
| `realtime-safety` | オーディオのスレッドで、メモリの確保・ロック・ファイルの入出力を行わない。CI でリアルタイム安全性を検査する。例は pluginval の macOS での検査 | LLM | 非公開の調査記録 |
| `cpu-compatibility` | AVX2 などの命令を無条件に必須にしない | LLM | Qiita の記事「たった３ヶ月で OBS のプラグインを開発し 1.5 万ダウンロードを達成できました！」 |
| `dll-footprint` | 同梱する共有ライブラリを減らし、同じ DAW のプロセスに読み込まれるほかのプラグインとの競合を避ける | LLM | live-backgroundremoval-lite の開発者ノート |
| `hermetic-build` | ビルドの環境を絞り、ツールの版を固定する | LLM | obs-backgroundremoval PR 846 |
| `contribution-compliance` | コントリビューターに、ライセンスの同意・DCO・署名付きコミットを求める | LLM | live-backgroundremoval-lite の CONTRIBUTING.md |
| `reuse-compliance` | REUSE に準拠する | ルール (将来) | live-backgroundremoval-lite の CONTRIBUTING.md |
| `license-notices` | 同梱する依存と素材のライセンスを列挙する。VST Compatible ロゴを同梱する場合は、Steinberg の商標でありプラグインのライセンスの対象外であることを書く | LLM | live-backgroundremoval-lite の README、Steinberg VST usage guidelines |
| `diagnostic-logging` | 失敗の原因を特定できるログを出す | LLM | スライド 11 枚目 |
| `security-policy` | SECURITY.md で報告の窓口と、対応する版を示す | ルール (将来) | live-backgroundremoval-lite の SECURITY.md |

「ルール (将来)」の項目は、配布物の中身やリポジトリの設定を読む仕組みが要るため、初めは判定せず、作者にも返しません。`plugin-name` は、表示名とリポジトリ名に、単語としての `VST` が含まれるときに当たります。大文字と小文字は区別しません。推奨のため、当たっても掲載は止めません。

配信プラグイン倉庫くんの推奨のうち、次のものは外しています。

| 項目 | 外した理由 |
| --- | --- |
| `macos-code-signing` | 掲載の条件 `macos-signing` に移した |
| `manifest-consistency` | OBS の `data/manifest.json` に固有。規格ごとの ID の一貫性は `stable-plugin-id` で扱う |
| `resource-raii` | OBS の C API を名指しする。オーディオでは `realtime-safety` に置き換えた |
| `crash-report-privacy` | 出典が OBS のプラグインの Issue テンプレートで、オーディオプラグインに求める根拠が見つかっていない |

`realtime-safety` と `install-location` は、LLM に渡すファイルにソースコードを含めないため、ワークフローと README の記載からしか判定できません。判定の精度は、段階 2 の実装の後に確かめます。

## 採らない項目

| 内容 | 理由 |
| --- | --- |
| 生成 AI の生の出力を投稿しない、生成物を製品に入れない、LLM をコードの生成に使わない、エージェントの行動を AGENTS.md で定める | 本サービスは、AI の利用の有無を掲載に影響させない |
| 通信を行うプラグインを掲載しない | オーディオプラグインでは、ライセンスの認証と更新の確認の通信が普通にある。知らせずに送ることだけを `user-data-handling` で扱う |
| 更新の告知にファイルの URL を書かない、リリースの実行に手動の承認を挟む、main で署名付きコミットを必須にする、Issue で LLM の未検証の修正案を出さない、リリース前に全プラットフォームで検証する | リポジトリのファイルやリリースからは判定できない |
