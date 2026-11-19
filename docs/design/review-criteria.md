# 審査の基準

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../images/VST_Compatible_Logo_Steinberg_negative.png">
  <img src="../images/VST_Compatible_Logo_Steinberg.png" alt="VST Compatible" width="120">
</picture>

VST® is a registered trademark of Steinberg Media Technologies GmbH.

新しい版を掲載する前に確かめる項目の一覧です。本文書が審査の基準の正本です。MCP で作者に返す固定の文言 (英語) は、本サービスのリポジトリの `src/review/criteria.ts` に項目の ID ごとに持ちます。本文書の ID・判定の方法・重大とする場合と一致することを、テスト `test/review-criteria.test.ts` で確かめます。作者への返し方は [作者へのレビューの返し方](author-feedback.md) に記載します。

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
| 審査の基準 | ルールまたは LLM | 重大な指摘は管理者の確認待ちにする。それ以外は作者に直すことを勧める |
| 推奨 | ルールまたは LLM | 掲載に影響しない。参考として作者に返す |

## 判定の方法

審査の基準と推奨の項目は、判定に要るものによって、ルール・LLM・判定しないの 3 つに分けます。配信プラグイン倉庫くんの ADR 0016 の分け方です。1 回の LLM の呼び出しですべての項目を判定すると、ファイルを見れば決まる項目でも呼び出しごとに結果が揺れ、入力に無い知識が要る項目では LLM が思い込みで知識を補うためです。

| 判定 | 対象 | 方法 |
| --- | --- | --- |
| ルール | ファイルの有無と中身から機械的に決まる項目 | 本サービスのコードで判定する。同じリポジトリには同じ結果を返し、根拠のファイルと行を示す。作者に返す説明も固定の文で、`Checked by rules: ` で始まる。判定できなかった `unclear` の説明も同じ |
| LLM | 文章の意図を読む項目 | LLM が判定する。本サービスが計算した事実を添える。事実は、ファイルの一覧から分かる `.github/scripts/` 配下のスクリプトの名前、ワークフローで検証の道具に触れる行、README の見出しと URL のホストと行番号、新しい版のソースから検出した通信の API の使用、ルールの判定の結果、差分が上限を超えたときの変更されたファイルの一覧の事実である |
| 判定しない | 入力に無い知識が要る項目と、ソースコードや配布物の中身を読む項目 | 判定せず、作者にも返さない。材料を確実に得られるようになったら判定に戻す。表では「判定しない」か「ルール (将来)」と書く |

LLM に渡すファイルは README とワークフローだけです。ルールだけが読むビルド系のファイルと CONTRIBUTING は渡しません。同じ項目の判定がルールと LLM の両方から返った場合は、ルールの判定を使います。LLM の応答に含まれるルールで判定する項目の判定は捨てます。

## 掲載の条件

[ADR 0003](../decisions/0003-listing-conditions.md) と [ADR 0004](../decisions/0004-vst-trademark.md) の条件と、掲載の対象をオープンソースのプラグインに限る条件です。

| ID | 内容 | 判定の観点 | 満たさないとき | 出典 |
| --- | --- | --- | --- | --- |
| `immutable-release` | リリースが不変 (immutable) である | GitHub のリリースの API の `immutable` が true | 版を掲載しない | obs-backgroundremoval Issue 775 |
| `distribution-format` | 案内する配布物は zip のアーカイブである | 配布物のファイル名の拡張子。インストーラー (`.exe`・`.msi`・`.pkg`・`.dmg`) と zip 以外のファイルは案内しない。アーカイブが無い版は掲載しない | アーカイブが無ければ版を掲載しない。インストーラーは案内しないだけ | ADR 0003、Qiita のコメント、obs-backgroundremoval Issue 832 |
| `attestation` | リリースのすべての配布物に、build provenance の証明がある。案内しないインストーラーと zip 以外のファイルも含む | 証明の署名を検証し、ソースのリポジトリがこのリポジトリ、ソースの参照が `refs/tags/<タグ>`、ソースのコミットがタグのコミット、署名したワークフローが記録したリリースのワークフローに一致する | 版を掲載しない | ADR 0003、スライド 16 枚目、Qiita のコメント、obs-backgroundremoval Issue 775 |
| `plugin-content` | アーカイブに、VST 3・CLAP・LV2・Audio Unit のいずれかのバンドルがある | 中身の検査で規格のバンドルを 1 つ以上検出する。規則は [検査と同期](scanning.md) の「中身の検査」に記載する | バンドルの無いアーカイブは案内しない。案内するアーカイブが無ければ版を掲載しない | ADR 0004 |
| `no-vst2` | 配布物に VST 2 のプラグインが無い | 中身の検査で、`.vst` のバンドルと、VST 2 のエントリーポイント (`VSTPluginMain`、`main_macho`、共有ライブラリの `main`) をエクスポートするバイナリを検出しない。中を調べられないものを含む判定不能のアーカイブは合格にしない | 版を掲載しない | ADR 0004 |
| `macos-signing` | macOS 向けのバンドルに、Developer ID の署名と Apple の公証がある | 署名と公証の判定。規則は [検査と同期](scanning.md) の「署名と公証の判定」に記載する。macOS の LV2 のバンドルは Gatekeeper が判定しないため、判定せず案内しない | その配布物を案内しない。macOS の配布物だけの版は掲載しない。Developer ID の署名があり公証済みと判定されないものは、3 回まで判定し直し、その後は管理者の確認を待つ | ADR 0003、obs-backgroundremoval Issue 971 |
| `declaration` | 宣言ファイルがあれば、形が正しく、中身の検査の結果と食い違わない。宣言ファイルは任意 | [検査と同期](scanning.md) の「宣言ファイル」の規則 | 版を掲載しない | 配信プラグイン倉庫くんの宣言ファイル |
| `open-source-license` | 版のタグの時点のライセンスが、OSI の承認か FSF の自由なライセンスの認定を持つ | GitHub の `/license?ref=<タグのコミット>` の SPDX 識別子を、本サービスのリポジトリに固定して置く SPDX License List の JSON の `isOsiApproved` と `isFsfLibre` で判定する。LLM では判定しない。規則は [検査と同期](scanning.md) の「ライセンスの判定」に記載する | 版を掲載しない | 運営者の方針 |

署名したワークフローは、初めて証明を検証できた版のものを記録します。以後の版で違うワークフローが署名していれば、証明の検証を失敗とします。

macOS の条件は、安全の証拠として求めるものではありません。Apple の公証は提出時の検査で、公証を通ったマルウェアの例が 2025 年に複数報告されています (非公開の調査記録)。利用者にセキュリティ機能の解除を求めずに済むよう、署名と公証のある配布物だけを案内します。

Windows の署名は条件にしません。日本の個人の作者が Windows の署名を無償で得る手段は、SignPath Foundation のオープンソースの枠のほかに見つかっていません。Azure Artifact Signing は、個人では米国とカナダの在住者だけが使えます (非公開の調査記録)。

## 乗っ取りの兆候

`diff-` で始まる項目は、掲載中の版のタグから新しい版のタグまでの差分で判定します。差分は先頭の 24,000 文字までを読みます。ほかの項目の判定の方法は、各項目の内容に書きます。

| ID | 内容 |
| --- | --- |
| `diff-workflow-changed` | `.github/workflows/`・`.github/actions/`・`.github/scripts/` 配下のファイルが変わった |
| `diff-binary-added` | バイナリのファイルが追加または変更された。削除は当たらない |
| `diff-external-link` | このリポジトリ・本サービス・許可するホスト以外のホストへのリンクやダウンロードが追加された |
| `diff-too-large` | 差分が 24,000 文字を超え、変更されたファイルの一覧に `.github/` 配下の変更・ビルドのスクリプトの変更・バイナリの追加と変更のいずれかがある。または一覧を取り切れなかった |
| `tag-not-on-default-branch` | 新しい版のタグのコミットが、既定のブランチの履歴に無い。差分ではなく、記録した版のコミットと既定のブランチを GitHub の compare で比べて判定する。書き込みの権限を持つ人や漏れたトークンが、既定のブランチを通さないコードから版を作る経路を管理者の確認に回すため |
| `owner-changed` | リポジトリの所有者が、登録したときから別のアカウントか組織に変わった。差分ではなく同期で判定し、管理者が版を承認するまで、変更のあとの新しい版に当てる |
| `team-id-mismatch` | 版の macOS 向けのバンドルの署名の Team ID が、バンドルによって食い違う。差分ではなく署名と公証の判定の結果で判定する |

`diff-external-link` で許可するホストは、VST 3 の文書と VST Compatible ロゴの規則の `steinbergmedia.github.io`、CLAP の `cleveraudio.org`、LV2 の `lv2plug.in`、Audio Unit の `developer.apple.com` です。README で SDK の文書へリンクする作者が多いと考えて許可しています。配信プラグイン倉庫くんが許可していた `obsproject.com` は許可しません。

`diff-binary-added` は、差分の追加の側だけで判定し、削除の行を数えません。オーディオプラグインでは音声のサンプル・インパルス応答・プリセットの追加でも当たります。正当な変更でも管理者の確認待ちになることを、作者向けの文言で知らせます。

差分が 24,000 文字を超えただけでは、版を確認待ちにしません。オーディオプラグインの差分は大きく、上限を超えるたびに確認待ちにすると、ほとんどの新しい版で管理者の確認が要るためです。差分の本文が上限を超えたときは、変更されたファイルの一覧を取得し、次の 4 つの事実をルールで計算します。どれかに当たるときだけ `diff-too-large` として確認待ちにします。差分の先頭の 24,000 文字には、ほかの乗っ取りの兆候の判定もそのまま当てます。

| 事実 | 当たる場合 |
| --- | --- |
| `.github/` 配下の変更 | 変更されたファイルのパスか、名前を変えたファイルの元のパスが `.github/` で始まる。追加と削除も当たる |
| ビルドのスクリプトの変更 | 変更されたファイルか、名前を変えたファイルの元のファイルが、`CMakeLists.txt`・`Cargo.toml`・`build.rs`・`meson.build`・`meson_options.txt`・`meson.options`・`vcpkg.json`・`vcpkg-configuration.json`・`Makefile`・`GNUmakefile`・`premake5.lua`・`conanfile.txt`・`conanfile.py`・`.gitmodules` のいずれかの名前のファイルか、拡張子が `.cmake`・`.mk`・`.jucer`・`.sh`・`.ps1`・`.bat`・`.cmd` のファイルである。追加と削除も当たる |
| バイナリの追加と変更 | 削除以外の変更で、GitHub が差分の本文を返さず行の増減が 0 のファイルか、拡張子が共有ライブラリ・実行ファイル・インストーラー・アーカイブ・プラグインのバイナリのファイルである。名前だけの変更は、拡張子で当たる場合に限る |
| 一覧を取り切れなかった | 一覧の件数が GitHub の上限の 300 件に達した。応答が 1 MiB を超えた。一覧の取得がレート制限以外の理由で失敗した |

変更されたファイルの一覧は、GitHub の比較の API (`GET /repos/{owner}/{repo}/compare/{起点のタグ}...{新しいタグ}`) の JSON の `files` から得ます。この API は、変更されたファイルを比較の全体で 300 件までしか返しません ([GitHub REST API の文書](https://docs.github.com/en/rest/commits/commits#compare-two-commits))。応答は各ファイルの差分の本文を含み大きくなるため、Worker の読み込みの上限として 1 MiB を超える応答は読み切りません。

LLM には、この事実と差分の先頭の 24,000 文字を渡します。LLM は審査の基準と推奨の指摘を足すだけで、確認待ちを外す判断には使いません。確認待ちは事実からルールで決め、LLM の応答では変えません。差分の内容は攻撃者が書けるため、LLM の出力で確認待ちを外させないようにします。

初めて登録する版には、差分の判定を当てません。`tag-not-on-default-branch` は差分を使わないため、初めて登録する版にも当てます。

`tag-not-on-default-branch` で比べるのは、タグの名前ではなく、証明の検証で配布物と結び付いた版のコミット (`releases.commit_sha`) です。タグと同じ名前のブランチを作って判定を変えられないようにするためです。比較の応答は 64 KiB まで読み、超えたら既定のブランチに無いものとします。既定のブランチにあるコミットの応答は小さく、上限を超える応答はそのコミットにだけあるコミットを含むためです。リリース用のブランチから意図して版を作る作者も、管理者の確認を経て掲載できます。配信プラグイン倉庫くんの 0.2.4 と同じ規則です。

## 審査の基準

入力は、新しい版のタグの時点の `.github/workflows/` のワークフロー、ルートのビルド系のファイル、README、CONTRIBUTING、プルリクエストのテンプレート、リポジトリの有効な ruleset と、乗っ取りの兆候の判定に使った差分です。取得するファイルの一覧と上限は [検査と同期](scanning.md) に記載しています。

`user-data-handling` には、新しい版のソースのコードから検出した通信の API の使用を事実として渡します。事実の中身は、当たったファイル・行・API の名前・行の文字列です。検出は GitHub Actions で行い、ソースは実行もビルドもしません。規則は [検査と同期](scanning.md) の「通信の検出」に記載しています。確認のモードと、検出の結果が届かないまま期限を過ぎた版では、検出していないことを伝えます。

| ID | 内容 | 判定 | 判定の観点 | 重大とする場合 | 出典 |
| --- | --- | --- | --- | --- | --- |
| `ci-source-build` | リリースの配布物を、CI でソースからビルドしている | 判定しない | 掲載の条件の `attestation` で、配布物をタグのコミットからリリースのワークフローで作ったことを確かめるため、別に判定しない | なし | スライド 16〜17 枚目 |
| `ci-plugin-validation` | CI で、ビルドしたプラグインを検証の道具に読み込ませている | LLM | CI が、ビルドの確認にとどまらず、pluginval・VST 3 SDK の validator・clap-validator・lv2lint・auval のような道具でプラグインを読み込み、処理を試している。ワークフローでこれらの道具に触れる行と、`.github/scripts/` 配下のスクリプトの名前を事実として渡す | なし | obs-backgroundremoval Issue 971 |
| `no-security-bypass` | 利用者にセキュリティの機能を切らせない | ルール | README・リリースノート・README 以外の文書の行に、次の案内の型が無い。macOS の `xattr` の `-d`・`-c` による隔離属性の除去 (`xattr -rd com.apple.quarantine`・`xattr -cr` など)、`spctl --master-disable`・`spctl --global-disable` による Gatekeeper の無効化、「このまま開く」と「Open Anyway」の誘導、`Add-MpPreference`・`Set-MpPreference` の除外と無効化の設定、SmartScreen・Defender・Smart App Control の語と無効化や除外の語を同じ行に含む案内 | 案内がある | obs-backgroundremoval Issue 832、obs-spout2-plugin Issue 105、ADR 0003 |
| `no-terminal-paste` | 導入のために、端末へ取得したものを実行するコマンドを貼り付けさせない | ルール | README・リリースノート・README 以外の文書の行に、ネットワークから取得した内容をその場で実行させるコマンドの型が無い。型は、`curl` や `wget` の出力をシェル・`osascript`・スクリプトの処理系へパイプで渡すもの、`bash -c "$(curl ...)"` と `bash <(curl ...)`、PowerShell の `irm ... \| iex` と `iex` で取得した文字列を実行するもの、base64 で埋め込んだ文字列を復号して実行するもの、`powershell -EncodedCommand`、`osascript` で取得したスクリプトを実行するものである。ソースからビルドする手順の `cmake` や `cargo` のコマンドは当たらない | 案内がある | オーディオプラグインを装うマルウェアの報告 (非公開の調査記録) |
| `dependency-pinning` | 依存をパッケージマネージャーやサブモジュールで、版を固定して入れている | ルール | リポジトリに共有ライブラリや実行ファイルを直接入れていない。`CMakeLists.txt` の `FetchContent_Declare` がコミットの SHA か `URL_HASH` で固定され、`file(DOWNLOAD)` に `EXPECTED_HASH` がある。`vcpkg.json` に `builtin-baseline` か `vcpkg-configuration.json` がある。`Cargo.toml` の git の依存は `rev` を持つか、`Cargo.lock` をコミットしている。サブモジュールは Git がコミットで固定するため当たらない | なし | スライド 17 枚目、obs-backgroundremoval Issue 644 |
| `ci-hardening` | CI を最小の権限で守っている | ルール | ワークフローの `permissions` の指定、`write-all` を使わないこと、アクションの SHA の固定、`persist-credentials: false`、Dependabot の設定 | なし | obs-backgroundremoval PR 805、スライド 19 枚目 |
| `third-party-provenance` | 同梱する第三者の素材とバイナリの出所とライセンスを示している | 判定しない | 同梱する素材とバイナリを知るには配布物の中身が要り、再配布の条件の判断には入力に無いライセンスの知識が要る | なし | obs-backgroundremoval PR 974、Issue 983 |
| `license-compatibility` | プラグインと依存のライセンスが両立する | 判定しない | 依存の一覧とそれぞれのライセンスは入力に無く、両立の判断には入力に無い知識が要る。例は、AGPLv3 で使う JUCE を MIT で配るプラグインや、非営利に限るライセンスの素材を制限の無いライセンスの配布物に同梱するもの | なし | obs-backgroundremoval Issue 644 |
| `user-data-handling` | 音声・プロジェクトのファイル・設定・鍵を、利用者に知らせずに外部へ送らない | LLM | 通信の API の検出の結果、README、ワークフローから送る機能があると分かる場合に、README に送り先と内容が書かれている。オーディオプラグインでは、ライセンスの認証と更新の確認のための通信が普通にあるため、通信の有無では判定しない。README の中でデータの送信や API に触れる行と、通信の API の検出の結果を事実として渡す。検出していない版で送る機能の有無が分からなければ判定不能とする | 通信の API が見つかり、README が外部のホストにも送信にも一切触れていない | スライド 15 枚目、obs-backgroundremoval FAQ |
| `build-hardening` | 防御のためのビルドの設定がある | ルール | ルートの `CMakeLists.txt` か `meson.build` に、Sanitizer の設定 (`-fsanitize` か `b_sanitize`) とスタック保護のフラグ (`-fstack-protector` か `/GS`) がある。Rust だけのビルドは対象外とする | なし | live-backgroundremoval-lite の CMakeLists.txt |

`no-terminal-paste` は、本サービスが先に加え、配信プラグイン倉庫くんが取り込んだ項目です。偽のオーディオソフトの配布で、README から端末へのコマンドの貼り付けに誘導する手口が報告されているため加えました。

`no-security-bypass` と `no-terminal-paste` をルールで判定するのは、案内の書き方の型がはっきりしていて、判定を揺らさずに済み、Workers AI も呼ばずに済むためです。型に当たる行は、「〜しないでください」のような否定の文脈でも当たります。重大の指摘は管理者の確認待ちになり、管理者が根拠の行を見て判断します。

2 つの項目は、README のほかに、リリースノート (GitHub のリリースの本文) と README 以外の文書も照合します。案内を README から移すだけで照合を逃れられないようにするためです。型は Worker と GitHub Actions で共有する `src/review/guidance-patterns.mjs` に置き、配信プラグイン倉庫くんと同じ実装に保ちます。

- リリースノートは、同期・登録・1 日 1 回のダウンロード数の記録で受け取る本文を、その場で照合します。当たった行は、根拠のファイルを `(release notes)` として示します。承認の後に本文を編集して案内を足した版は、承認を取り消して管理者の確認待ち (`notes_held`) に戻します
- README 以外の文書は、`verify.yaml` が通信の検出と同じ取り出しで照合します。対象は `.md`・`.markdown`・`.mdx`・`.txt`・`.rst`・`.adoc`・`.asciidoc`・`.org` のファイルと、直下と `docs/` の拡張子の無い大文字で始まる名前のファイル (`INSTALL` など) です。ワークフロー・スクリプト・ロケールのファイルは拡張子で外れます。README と同じファイルの当たりは、README の照合と重なるため捨てます
- 照合の結果が期限までに届かなかった版は、2 つの項目を重大の指摘にします。リポジトリを大きくして取得を時間切れにすることで、照合を逃れられないようにするためです
- 掲載の後も、既定のブランチの README を 1 日 1 回照合します。基準に無い案内が足されたら、管理者が確かめるまでプラグインのどの版も掲載しません (`readme_held`)。新しい版のレビューはタグの時点の README を照合するため、掲載の後に足した案内を次の版まで検知できないためです
- 確認のモードも、既定のブランチの README 以外の文書を同じ選び方で照合します。リポジトリの tarball が上限 (圧縮で 100 MB、展開で 200 MB) を超えたときなど、確認のモードで照合できなかったときも、2 つの項目を重大の指摘にします。作者が公開の前に当たりを直せるようにするためです。リリースノートは、確認のモードでは照合しません
- GitHub の Wiki・gh-pages・外部のサイトと、掲載の後に既定のブランチの README 以外の文書へ足した案内は照合しません

`user-data-handling` の重大は、通信の API が見つかり、README が外部のホストにも送信にも一切触れていないときに限ります。検出は API の使用だけを示し、送る内容は示さないためです。README で通信を説明している作者を、説明の細かさの違いで管理者の確認待ちにしないようにします。配信プラグイン倉庫くんの 0.2.3 と同じ条件です。

## 推奨

| ID | 内容 | 判定 | 出典 |
| --- | --- | --- | --- |
| `windows-code-signing` | Windows のバイナリに Authenticode の署名を付ける。署名の無いバイナリは Smart App Control で読み込みを止められることがある | ルール (将来) | obs-backgroundremoval Issue 965 |
| `plugin-name` | プラグインの名前とリポジトリ名に VST を含めない | ルール | VST 3 SDK の README、[ADR 0004](../decisions/0004-vst-trademark.md) |
| `no-impersonation` | 有名な商用のプラグインの名前や、crack・keygen のような語を名前に含めない | ルール (将来) | オーディオプラグインを装うマルウェアの報告 (非公開の調査記録) |
| `user-verification-guide` | 利用者に、ダウンロードしたファイルを検証する手順を示す。例は `gh attestation verify` | ルール | live-backgroundremoval-lite の開発者ノート |
| `install-location` | README で、規格ごとの標準の導入先を示す。例は Windows の `C:\Program Files\Common Files\VST3` と `C:\Program Files\Common Files\CLAP`、macOS の `~/Library/Audio/Plug-Ins/` の下の規格ごとのフォルダー | ルール | obs-backgroundremoval Issue 832 |
| `stable-plugin-id` | 版を重ねても、プラグインの ID を変えない。対象は CLAP の ID、VST 3 のクラス ID、Audio Unit の type・subtype・manufacturer、LV2 の URI | ルール (将来) | 非公開の調査記録。DAW はプロジェクトの中のプラグインを ID で探すため、ID が変わると保存したプロジェクトが開けなくなる |
| `realtime-safety` | オーディオのスレッドで、メモリの確保・ロック・ファイルの入出力を行わない。CI でリアルタイム安全性を検査する。例は pluginval の macOS での検査 | 判定しない | 非公開の調査記録 |
| `cpu-compatibility` | AVX2 などの命令を無条件に必須にしない | ルール | Qiita の記事「たった３ヶ月で OBS のプラグインを開発し 1.5 万ダウンロードを達成できました！」 |
| `dll-footprint` | 同梱する共有ライブラリを減らし、同じ DAW のプロセスに読み込まれるほかのプラグインとの競合を避ける | ルール (将来) | live-backgroundremoval-lite の開発者ノート |
| `hermetic-build` | ビルドの環境を絞り、ツールの版を固定する | ルール | obs-backgroundremoval PR 846 |
| `repository-protection` | 既定のブランチとリリースのタグを ruleset で守る | ルール | 配信プラグイン倉庫くんの 2026-11-15 の調査。書き込みの権限を持つ人が、既定のブランチ以外のコミットからリリースを作れる |
| `agent-editor-config` | エージェントとエディターの設定を、公開する意図がなければリポジトリに入れない。これらのファイルも通信の検出・README 以外の文書の照合・差分の規則の対象になり、意図しない指摘や管理者の確認待ちを招く。意図して共有するもの (貢献者向けの `AGENTS.md`、`.vscode/extensions.json`・`launch.json` など) は対応不要 | ルール | 配信プラグイン倉庫くんと音のプラグイン倉庫くんの 2026-11-17 の相談 |
| `contribution-compliance` | コントリビューターに、ライセンスの同意・DCO・署名付きコミットを求める | ルール | live-backgroundremoval-lite の CONTRIBUTING.md |
| `reuse-compliance` | REUSE に準拠する | ルール (将来) | live-backgroundremoval-lite の CONTRIBUTING.md |
| `license-notices` | 同梱する依存と素材のライセンスを列挙する。VST Compatible ロゴを同梱する場合は、Steinberg の商標でありプラグインのライセンスの対象外であることを書く | 判定しない | live-backgroundremoval-lite の README、Steinberg VST usage guidelines |
| `diagnostic-logging` | 失敗の原因を特定できるログを出す | 判定しない | スライド 11 枚目 |
| `security-policy` | SECURITY.md で報告の窓口と、対応する版を示す | ルール (将来) | live-backgroundremoval-lite の SECURITY.md |
| `pricing-declaration` | 宣言ファイルの申告 (`paidFeatures`・`paidServices`・`restrictedAssets`) が README の記述と食い違わない。`restrictedAssets` が真なら、README か NOTICE・THIRD_PARTY_LICENSES に素材の出所とライセンスがある | LLM | 配信プラグイン倉庫くんと共通の有料・素材の申告 (2026-11-19 依頼者の承認) |

「ルール (将来)」の項目は、配布物の中身やリポジトリの設定を読む仕組みが要るため、初めは判定せず、作者にも返しません。「判定しない」の項目のうち、`realtime-safety` と `diagnostic-logging` はソースコードを読む項目です。`license-notices` は、同梱する依存と素材を知るのに配布物の中身が要ります。

`pricing-declaration` は LLM が判定する推奨で、当たっても掲載は止めません。LLM はソースと NOTICE の本文を読まないため、宣言ファイルの申告の値と、ファイルの一覧にある NOTICE・THIRD_PARTY_LICENSES の有無を事実として渡し、README の記述と照らし合わせます。README に書かれていない課金や素材の制限は見抜けません。

ルールで判定する推奨の観点は次のとおりです。推奨のため、当たっても掲載は止めません。

- `plugin-name`: リポジトリ名と、分かっていれば宣言ファイルの表示名に、単語としての `VST` が含まれるときに当たる。`VST3` のように数字が続く形も当たる。大文字と小文字は区別しない
- `user-verification-guide`: README に `gh attestation verify`・SHA-256・チェックサム・`Get-FileHash`・ハッシュの語がある
- `install-location`: README に、`Common Files\VST3`・`Common Files\CLAP`・`Common Files\LV2`・`~/Library/Audio/Plug-Ins`・`~/.vst3`・`~/.clap`・`~/.lv2` のような規格ごとの標準の導入先がある
- `cpu-compatibility`: ルートのビルド系のファイルとワークフローに、`/arch:AVX2`・`-mavx2`・`-march=native`・`target-cpu=native` のような命令の指定が無い
- `hermetic-build`: ワークフローに `-latest` のランナーが無い
- `repository-protection`: 有効な ruleset のうち、既定のブランチ (`~DEFAULT_BRANCH` か `~ALL`) を対象にして削除と強制 push を禁じ、承認 1 名以上のプルリクエストを必須にするブランチの ruleset と、タグの作成・更新・削除を制限するタグの ruleset の両方がある。ruleset の例外を許す相手は API で読めないため判定しない。1 人で開発する作者には、ブランチの ruleset の例外にリポジトリの管理者を「For pull requests only」で足す設定を案内する (強制 push と削除の禁止は残る)。既定のブランチを名前で指定した ruleset は数えない。ruleset を読めなかったとき、有効な ruleset が詳細を読む上限の 3 件を超えて満たすものが見つからないときは判定不能とする
- `agent-editor-config`: リポジトリのファイルの一覧に、`.claude/`・`.codex/`・`.cursor/`・`.windsurf/`・`.vscode/`・`.vs/`・`.idea/` のディレクトリの中のファイルか、`CLAUDE.md`・`AGENTS.md`・`.cursorrules` の名前のファイルがあれば当たる。深さは問わず、大文字と小文字を区別する。ディレクトリは中のファイルの数にかかわらず 1 か所と数え、当たった場所を根拠に返す。一覧が切り詰められ、当たりが無いときは判定不能とする。`.github/copilot-instructions.md` は対象にしない。`.github/` の変更は別の規則が扱うためである。ビルドの生成物も、性質が違うため対象にしない
- `contribution-compliance`: CONTRIBUTING かプルリクエストのテンプレートで、DCO や `Signed-off-by` を求めている

## 外した推奨

配信プラグイン倉庫くんの推奨のうち、次のものは外しています。

| 項目 | 外した理由 |
| --- | --- |
| `macos-code-signing` | 掲載の条件 `macos-signing` に移した |
| `manifest-consistency` | OBS の `data/manifest.json` に固有。規格ごとの ID の一貫性は `stable-plugin-id` で扱う |
| `resource-raii` | OBS の C API を名指しする。オーディオでは `realtime-safety` に置き換えた |
| `crash-report-privacy` | 出典が OBS のプラグインの Issue テンプレートで、オーディオプラグインに求める根拠が見つかっていない |

## 採らない項目

| 内容 | 理由 |
| --- | --- |
| 生成 AI の生の出力を投稿しない、生成物を製品に入れない、LLM をコードの生成に使わない、エージェントの行動を AGENTS.md で定める | 本サービスは、AI の利用の有無を掲載に影響させない |
| 通信を行うプラグインを掲載しない | オーディオプラグインでは、ライセンスの認証と更新の確認の通信が普通にある。知らせずに送ることだけを `user-data-handling` で扱う |
| 更新の告知にファイルの URL を書かない、リリースの実行に手動の承認を挟む、main で署名付きコミットを必須にする、Issue で LLM の未検証の修正案を出さない、リリース前に全プラットフォームで検証する | リポジトリのファイルやリリースからは判定できない |
