// Web カタログの 7 言語の辞書。英語版が正で、ほかの言語は参考訳。
import type { Category, Os } from '../domain/metadata';
import type { PluginStatus } from '../domain/status';

export const LANGS = ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko', 'pt-BR', 'es-419'] as const;
export type Lang = (typeof LANGS)[number];
export const FALLBACK_LANG: Lang = 'ja';

export const LANG_NAMES: Record<Lang, string> = {
  ja: '日本語',
  en: 'English',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  ko: '한국어',
  'pt-BR': 'Português (Brasil)',
  'es-419': 'Español (Latinoamérica)',
};

// Accept-Language の言語タグを、対応する 7 言語へ対応づける。
export function matchLang(tag: string): Lang | null {
  const t = tag.trim().toLowerCase();
  if (!t) return null;
  if (t.startsWith('ja')) return 'ja';
  if (t.startsWith('en')) return 'en';
  if (t.startsWith('ko')) return 'ko';
  if (t.startsWith('zh')) {
    if (t.includes('hant') || /^zh-(tw|hk|mo)/.test(t)) return 'zh-Hant';
    return 'zh-Hans';
  }
  if (t.startsWith('pt')) return 'pt-BR';
  if (t.startsWith('es')) return 'es-419';
  return null;
}

export function negotiate(acceptLanguage: string | null): Lang {
  if (!acceptLanguage) return FALLBACK_LANG;
  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.split(';');
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? '1');
      return { tag: tag ?? '', q: Number.isFinite(q) ? q : 0 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag, q } of ranked) {
    if (q <= 0) continue;
    const lang = matchLang(tag);
    if (lang) return lang;
  }
  return FALLBACK_LANG;
}

export interface Dict {
  tagline: string;
  siteDescription: string;
  notice: string;
  noticeShort: string;
  searchHeading: string;
  searchPlaceholder: string;
  searchButton: string;
  osLabel: string;
  osAll: string;
  categoryLabel: string;
  categoryAll: string;
  latest: string;
  resultsFor: (q: string, n: number) => string;
  results: (n: number) => string;
  noResults: string;
  prev: string;
  next: string;
  summaryOriginal: string;
  updated: string;
  status: Record<PluginStatus, string>;
  categories: Record<Category, string>;
  os: Record<Os, string>;
  library: string;
  author: string;
  license: string;
  supportedOs: string;
  formatLabel: string;
  formatAll: string;
  // 一覧のページで、VST Compatible ロゴと組にして出す説明の文。
  vstListNote: string;
  archLabel: string;
  macosNotGuided: string;
  attestationLabel: string;
  attestationVerified: string;
  macosSigningLabel: string;
  macosSigningPassed: string;
  pluginTitleSuffix: string;
  unknown: string;
  version: string;
  commit: string;
  source: string;
  releases: string;
  repository: string;
  releaseList: string;
  download: string;
  filesAndChecks: string;
  file: string;
  size: string;
  checks: string;
  check: Record<'malicious' | 'not_found' | 'pending' | 'error', string>;
  malwarebazaarNotFound: string;
  noDetectionNotSafe: string;
  cautions: string;
  cautionItems: string[];
  reportPlugin: string;
  suspendedDetail: string;
  removedDetail: string;
  reasonLabel: string;
  suspendedReleasesTitle: string;
  suspendedReleaseLabel: (tag: string) => string;
  suspendedReasons: Record<'admin' | 'malicious', string>;
  listedPeriod: (from: string, until: string | null) => string;
  noticesTitle: string;
  noticesIntro: string;
  noticesEmpty: string;
  sideAgentTitle: string;
  sideAgentBody: string;
  sideAgentExample: string;
  sideAgentLink: string;
  sideListingTitle: string;
  sideListingItems: string[];
  sidePolicy: string;
  sideReport: string;
  sideStatsTitle: string;
  sideStatsListed: (n: number) => string;
  sideStatsSynced: string;
  sameAuthor: string;
  sameCategory: string;
  nav: {
    about: string;
    policy: string;
    submit: string;
    security: string;
    report: string;
    terms: string;
    privacy: string;
    source: string;
    sponsor: string;
    notices: string;
  };
  translationNote: string;
  englishVersion: string;
  languageLabel: string;
  notFound: string;
  machineTranslated: string;
  showOriginal: string;
  showTranslation: string;
  machineTranslatedShort: string;
  downloadNote: string;
  sideLatestTitle: string;
  sideSubmitTitle: string;
  sideSubmitBody: string;
  sideSubmitLink: string;
  submitNav: string;
  translationNoteJa: string;
  japaneseVersion: string;
  contactLabel: string;
  // フッターの姉妹サービス (配信プラグイン倉庫くん) への 1 行。サービス名だけをリンクにする。
  sister: { before: string; name: string; after: string };
  cautionLabel: string;
  showContact: string;
  contactHint: string;
  contactUnavailable: string;
  imageAlt: string;
  playAnimation: string;
  downloadsLabel: string;
  downloadsShort: string;
  downloadsAsOf: string;
  downloadsNote: string;
  sideWeeklyTitle: string;
  // 詳細ページで、このプラットフォームが確かめた項目と作者の申告を分けて示す区画と、一覧の申告のタグ。
  // 申告は作者の主張で、このプラットフォームは確かめない (docs/design/scanning.md の「有料・素材の申告」)。
  pricing: {
    heading: string;
    checkedTitle: string;
    licenseChecked: string;
    declaredTitle: string;
    declaredNote: string;
    paidFeatures: string;
    paidServices: string;
    restrictedAssets: string;
    supportUrl: string;
    yes: string;
    no: string;
    // paidServices が [] のとき。申告なしと区別するため、申告した旨を添える。
    none: string;
    notDeclared: string;
    tagPaidFeatures: string;
    tagPaidServices: string;
    tagRestrictedAssets: string;
    // 商用利用の 1 行。ライセンスの判定と restrictedAssets から組み立て、作者に新しい項目は申告させない。
    commercialUse: string;
    commercialAllowed: string;
    commercialRestrictedAssets: string;
    commercialUndeclared: string;
    commercialServices: string;
    // すべての掲載に付けるタグ。入手が無料であることと、商用利用できること (素材の制限の申告が無いとき)。
    tagFree: string;
    tagCommercialOk: string;
  };
}

const en: Dict = {
  tagline: 'A warehouse of open-source audio plugins, free to download',
  siteDescription:
    'A registry of open-source audio plugins that you can search from the web or from AI agents such as Claude Code and Codex. Every listed file has a verified build provenance attestation and is checked against a database of known malware samples.',
  notice:
    'This platform is an unofficial service not affiliated with the developers of plugin formats or DAWs. It does not guarantee the safety of any plugin, so use plugins carefully and at your own risk.',
  noticeShort: 'This platform is unofficial and does not guarantee the safety of any plugin, so use plugins carefully.',
  searchHeading: 'Find audio plugins',
  searchPlaceholder: 'Keyword (e.g. pitch shift)',
  searchButton: 'Search',
  osLabel: 'OS',
  osAll: 'All',
  categoryLabel: 'Category',
  categoryAll: 'All',
  latest: 'New and updated',
  resultsFor: (q, n) => `Results for "${q}": ${n}`,
  results: (n) => `${n} plugins`,
  noResults: 'No plugins match. Try a different keyword.',
  prev: 'Previous',
  next: 'Next',
  summaryOriginal: 'This summary is the author’s original text on GitHub.',
  updated: 'Updated',
  status: { listed: 'Listed', pending: 'Under check', suspended: 'Suspended', removed: 'Removed' },
  categories: {
    instrument: 'Instruments',
    effect: 'Effects',
    analyzer: 'Analyzers and meters',
    midi: 'MIDI',
    utility: 'Utilities',
  },
  os: { windows: 'Windows', macos: 'macOS', linux: 'Linux' },
  library: 'Library',
  author: 'Author',
  license: 'License',
  supportedOs: 'Supported OS',
  pluginTitleSuffix: 'Audio plugin',
  unknown: 'Not confirmed',
  version: 'Version',
  commit: 'Commit',
  source: 'Source',
  releases: 'Releases',
  repository: 'GitHub repository',
  releaseList: 'GitHub releases',
  download: 'Download from GitHub',
  filesAndChecks: 'Files and checks',
  file: 'File',
  size: 'Size',
  checks: 'Checks',
  check: {
    malicious: 'Detected',
    not_found: 'Not in database',
    pending: 'Waiting',
    error: 'Check failed',
  },
  malwarebazaarNotFound: 'Not a known malware sample',
  noDetectionNotSafe: 'A file with no detections is not necessarily safe, so use it carefully.',
  cautions: 'Notes',
  cautionItems: [
    'The author published these files on GitHub, so read the author’s instructions before installing.',
    'Extract the archive and put each plugin bundle in the plugin folder for its format, as the author describes.',
    'Compare the SHA-256 of the downloaded file with the value shown here.',
  ],
  reportPlugin: 'Report this plugin',
  suspendedDetail: 'This platform has suspended this plugin, so it does not show download links.',
  removedDetail: 'This plugin is no longer public on GitHub, so it cannot be downloaded.',
  reasonLabel: 'Reason',
  suspendedReleasesTitle: 'Suspended versions',
  suspendedReleaseLabel: (tag) => `Version ${tag}`,
  suspendedReasons: { admin: 'Suspended by the operator', malicious: 'Malware detected' },
  listedPeriod: (from, until) => `Listed here from ${from} to ${until ?? 'now'}`,
  noticesTitle: 'Notices',
  noticesIntro:
    'These are versions that this platform suspended. If you downloaded one of these files during the listed period, delete the plugin from your plugin folders and scan your PC.',
  noticesEmpty: 'There are no notices.',
  sideAgentTitle: 'Use from AI agents',
  sideAgentBody:
    'Connect Claude Code or Codex over MCP to search for plugins in conversation. Authors of audio plugins can also submit their plugins in conversation.',
  sideAgentExample: 'Example: "Find a pitch shift plugin that works on Windows"',
  sideAgentLink: 'How to connect',
  sideListingTitle: 'About listings and checks',
  sideListingItems: [
    'Authors submit their own public GitHub repositories.',
    'This platform verifies the build provenance of every file and inspects the plugin bundles in each archive.',
    'This platform checks files against a database of known malware.',
    'A file with no detections is not necessarily safe, so use it carefully.',
  ],
  sidePolicy: 'Listing policy',
  sideReport: 'Report',
  sideStatsTitle: 'Warehouse status',
  sideStatsListed: (n) => `${n} plugins listed`,
  sideStatsSynced: 'GitHub info checked',
  sameAuthor: 'More from this author',
  sameCategory: 'New in this category',
  nav: {
    about: 'What is Audio Plugin Soko-kun?',
    policy: 'Listing policy',
    submit: 'Submit a plugin',
    security: 'Security and disclaimer',
    report: 'Report',
    privacy: 'Privacy policy',
    terms: 'Terms of use',
    source: 'Source code on GitHub',
    sponsor: 'Support development',
    notices: 'Notices',
  },
  translationNote: 'This page is the authoritative version.',
  englishVersion: 'English version',
  languageLabel: 'Language',
  notFound: 'The page you are looking for was not found.',
  machineTranslated: 'This summary was machine-translated from the original.',
  showOriginal: 'Show the original',
  showTranslation: 'Show the machine translation',
  machineTranslatedShort: 'Machine translation',
  downloadNote: 'The file is downloaded directly from GitHub. This platform does not host files.',
  sideLatestTitle: 'Latest 5 plugins',
  sideSubmitTitle: 'Submit your plugin',
  sideSubmitBody: 'Authors of audio plugins can submit their GitHub repositories from an AI agent.',
  sideSubmitLink: 'How to submit',
  submitNav: 'Submit a plugin',
  translationNoteJa: 'This translation is for reference, so check the exact content in the Japanese version.',
  japaneseVersion: 'Japanese version',
  contactLabel: 'Developer contact',
  sister: { before: 'Sister service: ', name: 'Plugin Soko-kun', after: ' (plugins for OBS Studio)' },
  cautionLabel: 'Caution',
  showContact: 'Show contact',
  contactHint: 'Replace [at] with @ when you send email.',
  contactUnavailable: 'The developer contact is being prepared.',
  imageAlt: 'Image describing {name}',
  playAnimation: 'Play animation',
  downloadsLabel: 'Downloads (GitHub)',
  downloadsShort: 'Downloads',
  downloadsAsOf: 'as of {date}',
  downloadsNote: 'This is the number of downloads on GitHub, including downloads not made through this site.',
  sideWeeklyTitle: 'Top 5 weekly downloads',
  formatLabel: 'Format',
  formatAll: 'All',
  vstListNote:
    'The VST® 3 tag is shown only for plugins whose release archives were inspected and found to contain a VST 3 bundle.',
  archLabel: 'Architecture',
  macosNotGuided: 'This platform does not list the macOS files of this version. Only the files shown here are listed.',
  attestationLabel: 'Build provenance',
  attestationVerified: 'Verified',
  macosSigningLabel: 'macOS signing and notarization',
  macosSigningPassed: 'Developer ID signature and notarization confirmed',
  pricing: {
    heading: 'License and author declarations',
    checkedTitle: 'Checked by this platform',
    licenseChecked: 'Approved by the OSI or recognized as free by the FSF',
    declaredTitle: 'Declared by the author',
    declaredNote:
      'The author declared these items in .audio-soko-kun/config.json. This platform does not verify them. The files are always free to download from the public GitHub releases.',
    paidFeatures: 'Features unlocked by payment',
    paidServices: 'Paid services used separately',
    restrictedAssets: 'Bundled assets with usage restrictions',
    supportUrl: 'Support or purchase page',
    yes: 'Yes',
    no: 'No',
    none: 'None (declared)',
    notDeclared: 'Not declared by the author',
    tagPaidFeatures: 'Paid features',
    tagPaidServices: 'Paid services',
    tagRestrictedAssets: 'Commercial-use restrictions on assets',
    commercialUse: 'Commercial use',
    commercialAllowed:
      'Allowed under the license terms. This platform checked the code license, and the author declares that the bundled assets have no usage restrictions.',
    commercialRestrictedAssets:
      'The code can be used commercially under the license terms (checked by this platform). The author declares that the bundled assets restrict use, such as commercial use. See the README for details.',
    commercialUndeclared:
      'The code can be used commercially under the license terms (checked by this platform). The author has not declared whether the bundled assets restrict use.',
    commercialServices: 'Also check the terms of the external services it uses.',
    tagFree: 'Free',
    tagCommercialOk: 'Commercial use OK',
  },
};

const ja: Dict = {
  tagline: '無料で入手できる、オープンソースのオーディオプラグインの倉庫',
  siteDescription:
    'オープンソースのオーディオプラグインを、Web と Claude Code や Codex などの AI エージェントから探せるレジストリです。掲載する配布物は、ビルドの来歴の証明を検証し、既知のマルウェアのデータベースと照合しています。',
  notice:
    'このプラットフォームは、プラグインの規格の策定元や DAW の開発元と無関係の、非公式のサービスです。各プラグインの安全性を保証しないので、個人の責任にもとづき注意して利用してください。',
  noticeShort: 'このプラットフォームは非公式で、各プラグインの安全性を保証しないので、注意して利用してください。',
  searchHeading: 'オーディオプラグインを探す',
  searchPlaceholder: 'キーワード (例: pitch shift)',
  searchButton: '探す',
  osLabel: 'OS',
  osAll: 'すべて',
  categoryLabel: 'カテゴリ',
  categoryAll: 'すべて',
  latest: '新着・更新',
  resultsFor: (q, n) => `「${q}」の検索結果 ${n} 件`,
  results: (n) => `${n} 件`,
  noResults: '条件に合うプラグインはありません。キーワードを変えて探してください。',
  prev: '前へ',
  next: '次へ',
  summaryOriginal: 'この概要は作者が GitHub に書いた原文です。',
  updated: '更新',
  status: { listed: '掲載中', pending: '検査中', suspended: '掲載停止', removed: '掲載終了' },
  categories: {
    instrument: '音源',
    effect: 'エフェクト',
    analyzer: '分析・メーター',
    midi: 'MIDI',
    utility: 'ユーティリティ',
  },
  os: { windows: 'Windows', macos: 'macOS', linux: 'Linux' },
  library: 'ライブラリ',
  author: '作者',
  license: 'ライセンス',
  supportedOs: '対応 OS',
  pluginTitleSuffix: 'オーディオプラグイン',
  unknown: '確認できません',
  version: 'バージョン',
  commit: 'コミット',
  source: 'ソース',
  releases: 'リリース',
  repository: 'GitHub リポジトリ',
  releaseList: 'GitHub リリース一覧',
  download: 'GitHub からダウンロード',
  filesAndChecks: '配布物と検査',
  file: 'ファイル',
  size: 'サイズ',
  checks: '検査',
  check: {
    malicious: '検出あり',
    not_found: '未登録',
    pending: '検査待ち',
    error: '検査失敗',
  },
  malwarebazaarNotFound: '既知のマルウェアに該当なし',
  noDetectionNotSafe: '検査で何も検出されなくても安全とは限らないので、注意して利用してください。',
  cautions: '注意事項',
  cautionItems: [
    '配布物は作者が GitHub で公開したものなので、作者の説明を読んでから導入してください。',
    'アーカイブを展開し、作者の説明にしたがって、各プラグインのバンドルを規格ごとのプラグインのフォルダーに置いてください。',
    'ダウンロードしたファイルの SHA-256 をここに示した値と照合してください。',
  ],
  reportPlugin: 'このプラグインを通報する',
  suspendedDetail: 'このプラットフォームはこのプラグインの掲載を停止しているので、ダウンロードの案内を表示しません。',
  removedDetail: 'このプラグインは GitHub で公開されなくなったので、ダウンロードできません。',
  reasonLabel: '理由',
  suspendedReleasesTitle: '止めた版',
  suspendedReleaseLabel: (tag) => `版 ${tag}`,
  suspendedReasons: { admin: '運営者が掲載を止めました', malicious: 'マルウェアを検出しました' },
  listedPeriod: (from, until) => `このプラットフォームでの掲載: ${from} から ${until ?? '現在'} まで`,
  noticesTitle: '告知',
  noticesIntro:
    'このプラットフォームが掲載を止めた版の一覧です。掲載の期間にこれらのファイルをダウンロードした場合は、プラグインのフォルダーから該当のプラグインを削除し、PC をスキャンしてください。',
  noticesEmpty: '告知はありません。',
  sideAgentTitle: 'AI エージェントから使う',
  sideAgentBody:
    'Claude Code や Codex を MCP で接続すると、会話でプラグインを探せます。オーディオプラグインの作者は、会話でプラグインを登録することもできます。',
  sideAgentExample: '例:「Windows で動くピッチシフトのプラグインを探して」',
  sideAgentLink: '接続方法を見る',
  sideListingTitle: '掲載と検査について',
  sideListingItems: [
    '作者本人が GitHub の公開リポジトリを登録します。',
    'このプラットフォームは、すべての配布物のビルドの来歴の証明を検証し、アーカイブの中のプラグインのバンドルを検査します。',
    'このプラットフォームは配布物を既知のマルウェアのデータベースと照合します。',
    '検査で何も検出されなくても安全とは限らないので、注意して利用してください。',
  ],
  sidePolicy: '掲載ポリシー',
  sideReport: '通報する',
  sideStatsTitle: '倉庫の状況',
  sideStatsListed: (n) => `掲載中 ${n} 件`,
  sideStatsSynced: 'GitHub の情報の確認日時',
  sameAuthor: 'この作者のプラグイン',
  sameCategory: '同じカテゴリの新着',
  nav: {
    about: '音のプラグイン倉庫くんとは？',
    policy: '掲載ポリシー',
    submit: 'プラグインを登録する',
    security: 'セキュリティと免責',
    report: '通報',
    privacy: 'プライバシーポリシー',
    terms: '利用規約',
    source: 'GitHub のソースコード',
    sponsor: '開発を支援する',
    notices: '告知',
  },
  translationNote: 'この翻訳は参考訳なので、正確な内容は英語版で確認してください。',
  englishVersion: '英語版',
  languageLabel: '言語',
  notFound: 'お探しのページは見つかりません。',
  machineTranslated: 'この概要は原文を自動翻訳したものです。',
  showOriginal: '原文を表示する',
  showTranslation: '自動翻訳を表示する',
  machineTranslatedShort: '自動翻訳',
  downloadNote: '配布物は GitHub から直接ダウンロードします。このプラットフォームは配布物を保管しません。',
  sideLatestTitle: '新着 5 件',
  sideSubmitTitle: 'プラグインを登録する',
  sideSubmitBody: 'オーディオプラグインの作者は、AI エージェントから GitHub リポジトリを登録できます。',
  sideSubmitLink: '登録の方法を見る',
  submitNav: 'プラグインを登録する',
  translationNoteJa: 'この翻訳は参考訳なので、正確な内容は日本語版で確認してください。',
  japaneseVersion: '日本語版',
  contactLabel: '開発者の連絡先',
  sister: { before: '姉妹サービス: ', name: '配信プラグイン倉庫くん', after: ' (OBS Studio のプラグイン)' },
  cautionLabel: '注意',
  showContact: '連絡先を表示',
  contactHint: 'メールを送るときは、[at] を @ に置き換えてください。',
  contactUnavailable: '開発者の連絡先は準備中です。',
  imageAlt: '{name} の説明の画像',
  playAnimation: 'アニメーションを再生',
  downloadsLabel: 'ダウンロード数 (GitHub)',
  downloadsShort: 'ダウンロード数',
  downloadsAsOf: '{date} 時点',
  downloadsNote: 'GitHub でのダウンロード数で、このサイトを経由したものに限りません。',
  sideWeeklyTitle: '週間 DL 数ランキング 5 件',
  formatLabel: '規格',
  formatAll: 'すべて',
  vstListNote: 'VST® 3 のタグは、配布物の中身を検査して VST 3 のバンドルを確かめたプラグインにだけ付けています。',
  archLabel: 'アーキテクチャ',
  macosNotGuided:
    'このプラットフォームは、この版の macOS 向けの配布物を案内していません。案内するのは、ここに示した配布物だけです。',
  attestationLabel: 'ビルドの来歴の証明',
  attestationVerified: '検証済み',
  macosSigningLabel: 'macOS の署名と公証',
  macosSigningPassed: 'Developer ID の署名と公証を確認済み',
  pricing: {
    heading: 'ライセンスと作者の申告',
    checkedTitle: 'このプラットフォームが確かめた項目',
    licenseChecked: 'OSI の承認、または FSF の自由なライセンスの認定を確認済み',
    declaredTitle: '作者の申告',
    declaredNote:
      '以下は作者が .audio-soko-kun/config.json で申告した内容で、このプラットフォームは確かめていません。配布物は、GitHub の公開リリースからいつでも無料でダウンロードできます。',
    paidFeatures: '支払いで解放する機能',
    paidServices: '別に契約する有料サービス',
    restrictedAssets: '利用の制限がある同梱の素材',
    supportUrl: '支援・購入のページ',
    yes: 'あり',
    no: 'なし',
    none: 'なし (申告済み)',
    notDeclared: '作者の申告なし',
    tagPaidFeatures: '有料の機能あり',
    tagPaidServices: '有料サービスあり',
    tagRestrictedAssets: '素材に商用利用の制限あり',
    commercialUse: '商用利用',
    commercialAllowed:
      'ライセンスの条件にしたがって商用利用できます。コードのライセンスはこのプラットフォームが確かめました。同梱の素材に利用の制限が無いことは、作者が申告しています。',
    commercialRestrictedAssets:
      'コードはライセンスの条件にしたがって商用利用できます (このプラットフォームが確認)。同梱の素材には商用利用などの制限があると、作者が申告しています。詳しくは README を確かめてください。',
    commercialUndeclared:
      'コードはライセンスの条件にしたがって商用利用できます (このプラットフォームが確認)。同梱の素材の制限は、作者の申告がありません。',
    commercialServices: '利用する外部サービスの規約も確かめてください。',
    tagFree: '無料',
    tagCommercialOk: '商用利用可',
  },
};

const zhHans: Dict = {
  tagline: '可免费获取的开源音频插件仓库',
  siteDescription:
    '一个可以通过网页以及 Claude Code、Codex 等 AI 代理查找开源音频插件的收录平台。收录的发布文件均已验证构建来源证明，并与已知恶意软件数据库进行比对。',
  notice:
    '本平台是与插件格式的制定方及 DAW 开发商无关的非官方服务。本平台不保证各插件的安全性，请自行承担责任并谨慎使用。',
  noticeShort: '本平台为非官方服务，不保证各插件的安全性，请谨慎使用。',
  searchHeading: '查找音频插件',
  searchPlaceholder: '关键词（例：pitch shift）',
  searchButton: '搜索',
  osAll: '全部',
  osLabel: 'OS',
  os: { windows: 'Windows', macos: 'macOS', linux: 'Linux' },
  categoryLabel: '分类',
  categoryAll: '全部',
  latest: '最新与更新',
  resultsFor: (q, n) => `“${q}”的搜索结果：${n} 个`,
  results: (n) => `${n} 个插件`,
  noResults: '没有符合条件的插件。请换个关键词搜索。',
  prev: '上一页',
  next: '下一页',
  summaryOriginal: '此简介是作者在 GitHub 上撰写的原文。',
  updated: '更新',
  status: { listed: '已收录', pending: '检查中', suspended: '已暂停', removed: '已下架' },
  categories: {
    instrument: '音源',
    effect: '效果器',
    analyzer: '分析与电平表',
    midi: 'MIDI',
    utility: '实用工具',
  },
  library: '插件库',
  author: '作者',
  license: '许可证',
  supportedOs: '支持的系统',
  pluginTitleSuffix: '音频插件',
  unknown: '未确认',
  version: '版本',
  commit: '提交',
  source: '源代码',
  releases: '发布',
  repository: 'GitHub 仓库',
  releaseList: 'GitHub 发布列表',
  download: '从 GitHub 下载',
  filesAndChecks: '文件与检查',
  file: '文件',
  size: '大小',
  checks: '检查',
  check: {
    malicious: '已检出',
    not_found: '未收录',
    pending: '等待检查',
    error: '检查失败',
  },
  malwarebazaarNotFound: '不属于已知恶意软件',
  noDetectionNotSafe: '即使检查未检出任何问题，文件也不一定安全，请谨慎使用。',
  cautions: '注意事项',
  cautionItems: [
    '发布文件由作者在 GitHub 上公开，安装前请阅读作者的说明。',
    '请解压压缩包，并按照作者的说明将各插件包放入对应格式的插件文件夹。',
    '请将下载文件的 SHA-256 与此处显示的值进行比对。',
  ],
  reportPlugin: '举报此插件',
  suspendedDetail: '本平台已暂停收录此插件，因此不显示下载链接。',
  removedDetail: '此插件已不在 GitHub 上公开，因此无法下载。',
  reasonLabel: '原因',
  suspendedReleasesTitle: '已停止的版本',
  suspendedReleaseLabel: (tag) => `版本 ${tag}`,
  suspendedReasons: { admin: '运营者已停止收录', malicious: '检测到恶意软件' },
  listedPeriod: (from, until) => `在本平台的收录期间：${from} 至 ${until ?? '现在'}`,
  noticesTitle: '公告',
  noticesIntro:
    '以下是本平台已停止收录的版本。如果您在收录期间下载了这些文件，请从插件文件夹中删除该插件，并扫描您的电脑。',
  noticesEmpty: '暂无公告。',
  sideAgentTitle: '通过 AI 代理使用',
  sideAgentBody: '通过 MCP 连接 Claude Code 或 Codex，即可在对话中查找插件。音频插件的作者也可以在对话中提交插件。',
  sideAgentExample: '例：“帮我找一个能在 Windows 上使用的变调插件”',
  sideAgentLink: '查看连接方法',
  sideListingTitle: '关于收录与检查',
  sideListingItems: [
    '作者本人提交自己的 GitHub 公开仓库。',
    '本平台验证所有发布文件的构建来源证明，并检查压缩包中的插件包。',
    '本平台将发布文件与已知恶意软件数据库进行比对。',
    '即使未检测到任何问题，也不代表一定安全，请谨慎使用。',
  ],
  sidePolicy: '收录政策',
  sideReport: '举报',
  sideStatsTitle: '仓库状态',
  sideStatsListed: (n) => `已收录 ${n} 个`,
  sideStatsSynced: 'GitHub 信息确认时间',
  sameAuthor: '该作者的其他插件',
  sameCategory: '同分类的新插件',
  nav: {
    about: '什么是音のプラグイン倉庫くん？',
    policy: '收录政策',
    submit: '提交插件',
    security: '安全与免责声明',
    report: '举报',
    privacy: '隐私政策',
    terms: '使用条款',
    source: 'GitHub 上的源代码',
    sponsor: '支持开发',
    notices: '公告',
  },
  translationNote: '本翻译仅供参考，准确内容请以英文版为准。',
  englishVersion: '英文版',
  languageLabel: '语言',
  notFound: '找不到您要查找的页面。',
  machineTranslated: '此简介由原文自动翻译而成。',
  showOriginal: '显示原文',
  showTranslation: '显示自动翻译',
  machineTranslatedShort: '自动翻译',
  downloadNote: '文件直接从 GitHub 下载。本平台不保存文件。',
  sideLatestTitle: '最新 5 个插件',
  sideSubmitTitle: '提交插件',
  sideSubmitBody: '音频插件的作者可以通过 AI 代理提交 GitHub 仓库。',
  sideSubmitLink: '查看提交方法',
  submitNav: '提交插件',
  translationNoteJa: '本翻译仅供参考，准确内容请以日文版为准。',
  japaneseVersion: '日文版',
  contactLabel: '开发者联系方式',
  sister: { before: '姊妹服务：', name: '配信プラグイン倉庫くん', after: '（OBS Studio 插件）' },
  cautionLabel: '注意',
  showContact: '显示联系方式',
  contactHint: '发送邮件时，请将 [at] 替换为 @。',
  contactUnavailable: '开发者联系方式正在准备中。',
  imageAlt: '{name} 的说明图片',
  playAnimation: '播放动画',
  downloadsLabel: '下载次数 (GitHub)',
  downloadsShort: '下载次数',
  downloadsAsOf: '截至 {date}',
  downloadsNote: '这是在 GitHub 上的下载次数，不限于通过本站的下载。',
  sideWeeklyTitle: '每周下载次数排行前 5 名',
  formatLabel: '格式',
  formatAll: '全部',
  vstListNote: 'VST® 3 标签仅显示在经检查发布文件并确认包含 VST 3 插件包的插件上。',
  archLabel: '架构',
  macosNotGuided: '本平台未收录此版本的 macOS 发布文件。仅收录此处显示的文件。',
  attestationLabel: '构建来源证明',
  attestationVerified: '已验证',
  macosSigningLabel: 'macOS 签名与公证',
  macosSigningPassed: '已确认 Developer ID 签名与公证',
  pricing: {
    heading: '许可证与作者声明',
    checkedTitle: '本平台确认的项目',
    licenseChecked: '已确认获得 OSI 批准或被 FSF 认定为自由许可证',
    declaredTitle: '作者声明',
    declaredNote:
      '以下内容由作者在 .audio-soko-kun/config.json 中声明，本平台未加核实。文件始终可以从 GitHub 的公开发布免费下载。',
    paidFeatures: '付费解锁的功能',
    paidServices: '需另行订阅的付费服务',
    restrictedAssets: '有使用限制的附带素材',
    supportUrl: '支持或购买页面',
    yes: '有',
    no: '无',
    none: '无（已声明）',
    notDeclared: '作者未声明',
    tagPaidFeatures: '付费功能',
    tagPaidServices: '付费服务',
    tagRestrictedAssets: '素材有商业使用限制',
    commercialUse: '商业使用',
    commercialAllowed: '可按照许可证条款进行商业使用。代码的许可证已由本平台确认，捆绑素材没有使用限制由作者申报。',
    commercialRestrictedAssets:
      '代码可按照许可证条款进行商业使用（本平台已确认）。作者申报捆绑素材有商业使用等限制，详情请查看 README。',
    commercialUndeclared: '代码可按照许可证条款进行商业使用（本平台已确认）。捆绑素材是否有限制，作者没有申报。',
    commercialServices: '也请确认所使用的外部服务的条款。',
    tagFree: '免费',
    tagCommercialOk: '可商用',
  },
};

const zhHant: Dict = {
  ...zhHans,
  tagline: '可免費取得的開源音訊外掛倉庫',
  siteDescription:
    '一個可以透過網頁以及 Claude Code、Codex 等 AI 代理尋找開源音訊外掛的收錄平台。收錄的發行檔案均已驗證建置來源證明，並與已知惡意軟體資料庫進行比對。',
  notice:
    '本平台是與外掛格式的制定方及 DAW 開發商無關的非官方服務。本平台不保證各外掛的安全性，請自行承擔責任並謹慎使用。',
  noticeShort: '本平台為非官方服務，不保證各外掛的安全性，請謹慎使用。',
  searchHeading: '尋找音訊外掛',
  searchPlaceholder: '關鍵字（例：pitch shift）',
  searchButton: '搜尋',
  categoryLabel: '分類',
  latest: '最新與更新',
  resultsFor: (q, n) => `「${q}」的搜尋結果：${n} 個`,
  results: (n) => `${n} 個外掛`,
  noResults: '沒有符合條件的外掛。請換個關鍵字搜尋。',
  prev: '上一頁',
  next: '下一頁',
  summaryOriginal: '此簡介是作者在 GitHub 上撰寫的原文。',
  status: { listed: '已收錄', pending: '檢查中', suspended: '已暫停', removed: '已下架' },
  categories: {
    instrument: '音源',
    effect: '效果器',
    analyzer: '分析與電平表',
    midi: 'MIDI',
    utility: '實用工具',
  },
  library: '外掛庫',
  license: '授權',
  supportedOs: '支援的系統',
  pluginTitleSuffix: '音訊外掛',
  unknown: '未確認',
  version: '版本',
  commit: '提交',
  source: '原始碼',
  releases: '發行',
  repository: 'GitHub 儲存庫',
  releaseList: 'GitHub 發行列表',
  download: '從 GitHub 下載',
  filesAndChecks: '檔案與檢查',
  file: '檔案',
  checks: '檢查',
  check: {
    malicious: '已檢出',
    not_found: '未收錄',
    pending: '等待檢查',
    error: '檢查失敗',
  },
  malwarebazaarNotFound: '不屬於已知惡意軟體',
  noDetectionNotSafe: '即使檢查未檢出任何問題，檔案也不一定安全，請謹慎使用。',
  cautions: '注意事項',
  cautionItems: [
    '發行檔案由作者在 GitHub 上公開，安裝前請閱讀作者的說明。',
    '請解壓縮壓縮檔，並依照作者的說明將各外掛套件放入對應格式的外掛資料夾。',
    '請將下載檔案的 SHA-256 與此處顯示的值進行比對。',
  ],
  reportPlugin: '檢舉此外掛',
  suspendedDetail: '本平台已暫停收錄此外掛，因此不顯示下載連結。',
  removedDetail: '此外掛已不在 GitHub 上公開，因此無法下載。',
  reasonLabel: '原因',
  suspendedReleasesTitle: '已停止的版本',
  suspendedReleaseLabel: (tag) => `版本 ${tag}`,
  suspendedReasons: { admin: '營運者已停止收錄', malicious: '偵測到惡意軟體' },
  listedPeriod: (from, until) => `在本平台的收錄期間：${from} 至 ${until ?? '現在'}`,
  noticesTitle: '公告',
  noticesIntro:
    '以下是本平台已停止收錄的版本。如果您在收錄期間下載了這些檔案，請從外掛資料夾中刪除該外掛，並掃描您的電腦。',
  noticesEmpty: '目前沒有公告。',
  sideAgentTitle: '透過 AI 代理使用',
  sideAgentBody: '透過 MCP 連接 Claude Code 或 Codex，即可在對話中尋找外掛。音訊外掛的作者也可以在對話中提交外掛。',
  sideAgentExample: '例：「幫我找一個能在 Windows 上使用的變調外掛」',
  sideAgentLink: '查看連接方法',
  sideListingTitle: '關於收錄與檢查',
  sideListingItems: [
    '作者本人提交自己的 GitHub 公開儲存庫。',
    '本平台驗證所有發行檔案的建置來源證明，並檢查壓縮檔中的外掛套件。',
    '本平台將發行檔案與已知惡意軟體資料庫進行比對。',
    '即使未偵測到任何問題，也不代表一定安全，請謹慎使用。',
  ],
  sidePolicy: '收錄政策',
  sideReport: '檢舉',
  sideStatsTitle: '倉庫狀態',
  sideStatsListed: (n) => `已收錄 ${n} 個`,
  sideStatsSynced: 'GitHub 資訊確認時間',
  sameAuthor: '此作者的其他外掛',
  sameCategory: '同分類的新外掛',
  nav: {
    about: '什麼是音のプラグイン倉庫くん？',
    policy: '收錄政策',
    submit: '提交外掛',
    security: '安全與免責聲明',
    report: '檢舉',
    privacy: '隱私政策',
    terms: '使用條款',
    source: 'GitHub 上的原始碼',
    sponsor: '支持開發',
    notices: '公告',
  },
  translationNote: '本翻譯僅供參考，正確內容請以英文版為準。',
  englishVersion: '英文版',
  languageLabel: '語言',
  notFound: '找不到您要尋找的頁面。',
  machineTranslated: '此簡介由原文自動翻譯而成。',
  showOriginal: '顯示原文',
  showTranslation: '顯示自動翻譯',
  machineTranslatedShort: '自動翻譯（簡體）',
  downloadNote: '檔案直接從 GitHub 下載。本平台不保存檔案。',
  sideLatestTitle: '最新 5 個外掛',
  sideSubmitTitle: '提交外掛',
  sideSubmitBody: '音訊外掛的作者可以透過 AI 代理提交 GitHub 儲存庫。',
  sideSubmitLink: '查看提交方法',
  submitNav: '提交外掛',
  translationNoteJa: '本翻譯僅供參考，正確內容請以日文版為準。',
  japaneseVersion: '日文版',
  contactLabel: '開發者聯絡方式',
  sister: { before: '姊妹服務：', name: '配信プラグイン倉庫くん', after: '（OBS Studio 外掛程式）' },
  cautionLabel: '注意',
  showContact: '顯示聯絡方式',
  contactHint: '寄送郵件時，請將 [at] 替換為 @。',
  contactUnavailable: '開發者聯絡方式正在準備中。',
  imageAlt: '{name} 的說明圖片',
  playAnimation: '播放動畫',
  downloadsLabel: '下載次數 (GitHub)',
  downloadsShort: '下載次數',
  downloadsAsOf: '截至 {date}',
  downloadsNote: '這是在 GitHub 上的下載次數，不限於透過本站的下載。',
  sideWeeklyTitle: '每週下載次數排行前 5 名',
  formatLabel: '格式',
  formatAll: '全部',
  vstListNote: 'VST® 3 標籤僅顯示在經檢查發佈檔案並確認包含 VST 3 外掛套件的外掛上。',
  archLabel: '架構',
  macosNotGuided: '本平台未收錄此版本的 macOS 發行檔案。僅收錄此處顯示的檔案。',
  attestationLabel: '建置來源證明',
  attestationVerified: '已驗證',
  macosSigningLabel: 'macOS 簽署與公證',
  macosSigningPassed: '已確認 Developer ID 簽署與公證',
  pricing: {
    heading: '授權與作者聲明',
    checkedTitle: '本平台確認的項目',
    licenseChecked: '已確認獲得 OSI 核准或被 FSF 認定為自由授權',
    declaredTitle: '作者聲明',
    declaredNote:
      '以下內容由作者在 .audio-soko-kun/config.json 中聲明，本平台未加查核。檔案隨時可以從 GitHub 的公開發行免費下載。',
    paidFeatures: '付費解鎖的功能',
    paidServices: '需另行訂閱的付費服務',
    restrictedAssets: '有使用限制的隨附素材',
    supportUrl: '支持或購買頁面',
    yes: '有',
    no: '無',
    none: '無（已聲明）',
    notDeclared: '作者未聲明',
    tagPaidFeatures: '付費功能',
    tagPaidServices: '付費服務',
    tagRestrictedAssets: '素材有商業使用限制',
    commercialUse: '商業使用',
    commercialAllowed: '可依照授權條款進行商業使用。程式碼的授權已由本平台確認，隨附素材沒有使用限制由作者申報。',
    commercialRestrictedAssets:
      '程式碼可依照授權條款進行商業使用（本平台已確認）。作者申報隨附素材有商業使用等限制，詳情請查看 README。',
    commercialUndeclared: '程式碼可依照授權條款進行商業使用（本平台已確認）。隨附素材是否有限制，作者沒有申報。',
    commercialServices: '也請確認所使用的外部服務的條款。',
    tagFree: '免費',
    tagCommercialOk: '可商用',
  },
};

const ko: Dict = {
  tagline: '무료로 받을 수 있는 오픈 소스 오디오 플러그인 창고',
  siteDescription:
    '웹과 Claude Code, Codex 같은 AI 에이전트에서 오픈 소스 오디오 플러그인을 찾을 수 있는 레지스트리입니다. 게재하는 배포 파일은 빌드 출처 증명을 검증하고, 알려진 악성 코드 데이터베이스와 대조합니다.',
  notice:
    '이 플랫폼은 플러그인 규격의 제정 주체나 DAW 개발사와 관계없는 비공식 서비스입니다. 각 플러그인의 안전성을 보장하지 않으므로, 본인의 책임하에 주의해서 이용해 주세요.',
  noticeShort: '이 플랫폼은 비공식이며 각 플러그인의 안전성을 보장하지 않으므로 주의해서 이용해 주세요.',
  searchHeading: '오디오 플러그인 찾기',
  searchPlaceholder: '키워드 (예: pitch shift)',
  searchButton: '검색',
  osAll: '전체',
  osLabel: 'OS',
  os: { windows: 'Windows', macos: 'macOS', linux: 'Linux' },
  categoryLabel: '카테고리',
  categoryAll: '전체',
  latest: '신규·업데이트',
  resultsFor: (q, n) => `"${q}" 검색 결과 ${n}개`,
  results: (n) => `플러그인 ${n}개`,
  noResults: '조건에 맞는 플러그인이 없습니다. 다른 키워드로 찾아 주세요.',
  prev: '이전',
  next: '다음',
  summaryOriginal: '이 개요는 작성자가 GitHub에 쓴 원문입니다.',
  updated: '업데이트',
  status: { listed: '게재 중', pending: '검사 중', suspended: '게재 중지', removed: '게재 종료' },
  categories: {
    instrument: '악기',
    effect: '이펙트',
    analyzer: '분석·미터',
    midi: 'MIDI',
    utility: '유틸리티',
  },
  library: '라이브러리',
  author: '작성자',
  license: '라이선스',
  supportedOs: '지원 OS',
  pluginTitleSuffix: '오디오 플러그인',
  unknown: '확인할 수 없음',
  version: '버전',
  commit: '커밋',
  source: '소스 코드',
  releases: '릴리스',
  repository: 'GitHub 저장소',
  releaseList: 'GitHub 릴리스 목록',
  download: 'GitHub에서 다운로드',
  filesAndChecks: '배포 파일과 검사',
  file: '파일',
  size: '크기',
  checks: '검사',
  check: {
    malicious: '검출됨',
    not_found: '미등록',
    pending: '검사 대기',
    error: '검사 실패',
  },
  malwarebazaarNotFound: '알려진 악성코드에 해당 없음',
  noDetectionNotSafe: '검사에서 아무것도 검출되지 않아도 안전하다고 단정할 수 없으므로 주의해서 이용해 주세요.',
  cautions: '주의 사항',
  cautionItems: [
    '배포 파일은 작성자가 GitHub에 공개한 것이므로, 설치하기 전에 작성자의 설명을 읽어 주세요.',
    '압축 파일을 풀고, 작성자의 설명에 따라 각 플러그인 번들을 규격별 플러그인 폴더에 넣어 주세요.',
    '다운로드한 파일의 SHA-256을 여기에 표시된 값과 대조해 주세요.',
  ],
  reportPlugin: '이 플러그인 신고하기',
  suspendedDetail: '이 플랫폼은 이 플러그인의 게재를 중지했으므로 다운로드 안내를 표시하지 않습니다.',
  removedDetail: '이 플러그인은 더 이상 GitHub에 공개되어 있지 않으므로 다운로드할 수 없습니다.',
  reasonLabel: '이유',
  suspendedReleasesTitle: '게재를 중지한 버전',
  suspendedReleaseLabel: (tag) => `버전 ${tag}`,
  suspendedReasons: { admin: '운영자가 게재를 중지했습니다', malicious: '악성 코드가 검출되었습니다' },
  listedPeriod: (from, until) => `이 플랫폼의 게재 기간: ${from}부터 ${until ?? '현재'}까지`,
  noticesTitle: '공지',
  noticesIntro:
    '이 플랫폼이 게재를 중지한 버전 목록입니다. 게재 기간에 이 파일을 다운로드했다면 플러그인 폴더에서 해당 플러그인을 삭제하고 PC를 검사해 주세요.',
  noticesEmpty: '공지가 없습니다.',
  sideAgentTitle: 'AI 에이전트에서 사용하기',
  sideAgentBody:
    'Claude Code나 Codex를 MCP로 연결하면 대화로 플러그인을 찾을 수 있습니다. 오디오 플러그인 작성자는 대화로 플러그인을 등록할 수도 있습니다.',
  sideAgentExample: '예: "Windows에서 동작하는 피치 시프트 플러그인을 찾아 줘"',
  sideAgentLink: '연결 방법 보기',
  sideListingTitle: '게재와 검사에 대하여',
  sideListingItems: [
    '작성자 본인이 GitHub 공개 저장소를 등록합니다.',
    '이 플랫폼은 모든 배포 파일의 빌드 출처 증명을 검증하고, 압축 파일 안의 플러그인 번들을 검사합니다.',
    '이 플랫폼은 배포 파일을 알려진 악성 코드 데이터베이스와 대조합니다.',
    '검사에서 아무것도 검출되지 않아도 안전하다고 단정할 수 없으므로, 주의해서 이용해 주세요.',
  ],
  sidePolicy: '게재 정책',
  sideReport: '신고하기',
  sideStatsTitle: '창고 현황',
  sideStatsListed: (n) => `게재 중 ${n}개`,
  sideStatsSynced: 'GitHub 정보 확인 일시',
  sameAuthor: '이 작성자의 플러그인',
  sameCategory: '같은 카테고리의 신규',
  nav: {
    about: '音のプラグイン倉庫くん이란?',
    policy: '게재 정책',
    submit: '플러그인 등록하기',
    security: '보안과 면책',
    report: '신고',
    privacy: '개인정보처리방침',
    terms: '이용약관',
    source: 'GitHub의 소스 코드',
    sponsor: '개발 후원하기',
    notices: '공지',
  },
  translationNote: '이 번역은 참고용이므로, 정확한 내용은 영어판에서 확인해 주세요.',
  englishVersion: '영어판',
  languageLabel: '언어',
  notFound: '찾으시는 페이지가 없습니다.',
  machineTranslated: '이 개요는 원문을 자동 번역한 것입니다.',
  showOriginal: '원문 보기',
  showTranslation: '자동 번역 보기',
  machineTranslatedShort: '자동 번역',
  downloadNote: '배포 파일은 GitHub에서 직접 다운로드합니다. 이 플랫폼은 배포 파일을 보관하지 않습니다.',
  sideLatestTitle: '신규 5개',
  sideSubmitTitle: '플러그인 등록하기',
  sideSubmitBody: '오디오 플러그인 작성자는 AI 에이전트에서 GitHub 저장소를 등록할 수 있습니다.',
  sideSubmitLink: '등록 방법 보기',
  submitNav: '플러그인 등록하기',
  translationNoteJa: '이 번역은 참고용이므로, 정확한 내용은 일본어판에서 확인해 주세요.',
  japaneseVersion: '일본어판',
  contactLabel: '개발자 연락처',
  sister: { before: '자매 서비스: ', name: '配信プラグイン倉庫くん', after: ' (OBS Studio 플러그인)' },
  cautionLabel: '주의',
  showContact: '연락처 표시',
  contactHint: '메일을 보낼 때는 [at]을 @로 바꿔 주세요.',
  contactUnavailable: '개발자 연락처는 준비 중입니다.',
  imageAlt: '{name} 설명 이미지',
  playAnimation: '애니메이션 재생',
  downloadsLabel: '다운로드 수 (GitHub)',
  downloadsShort: '다운로드 수',
  downloadsAsOf: '{date} 기준',
  downloadsNote: 'GitHub에서의 다운로드 수이며, 이 사이트를 거친 다운로드에 한정되지 않습니다.',
  sideWeeklyTitle: '주간 다운로드 순위 5위',
  formatLabel: '규격',
  formatAll: '전체',
  vstListNote: 'VST® 3 태그는 배포 파일을 검사하여 VST 3 번들을 확인한 플러그인에만 표시됩니다.',
  archLabel: '아키텍처',
  macosNotGuided: '이 플랫폼은 이 버전의 macOS용 배포 파일을 안내하지 않습니다. 여기에 표시된 파일만 안내합니다.',
  attestationLabel: '빌드 출처 증명',
  attestationVerified: '검증됨',
  macosSigningLabel: 'macOS 서명과 공증',
  macosSigningPassed: 'Developer ID 서명과 공증 확인됨',
  pricing: {
    heading: '라이선스와 작성자의 신고',
    checkedTitle: '이 플랫폼이 확인한 항목',
    licenseChecked: 'OSI 승인 또는 FSF의 자유 라이선스 인정을 확인함',
    declaredTitle: '작성자의 신고',
    declaredNote:
      '아래 항목은 작성자가 .audio-soko-kun/config.json에서 신고한 내용이며, 이 플랫폼은 확인하지 않습니다. 배포 파일은 GitHub의 공개 릴리스에서 언제나 무료로 다운로드할 수 있습니다.',
    paidFeatures: '결제로 잠금 해제되는 기능',
    paidServices: '별도로 계약하는 유료 서비스',
    restrictedAssets: '이용 제한이 있는 동봉 소재',
    supportUrl: '후원·구매 페이지',
    yes: '있음',
    no: '없음',
    none: '없음 (신고함)',
    notDeclared: '작성자의 신고 없음',
    tagPaidFeatures: '유료 기능',
    tagPaidServices: '유료 서비스',
    tagRestrictedAssets: '소재에 상업적 이용 제한 있음',
    commercialUse: '상업적 이용',
    commercialAllowed:
      '라이선스 조건에 따라 상업적으로 이용할 수 있습니다. 코드의 라이선스는 이 플랫폼이 확인했으며, 동봉된 소재에 이용 제한이 없다는 것은 작성자가 신고했습니다.',
    commercialRestrictedAssets:
      '코드는 라이선스 조건에 따라 상업적으로 이용할 수 있습니다(이 플랫폼이 확인). 동봉된 소재에는 상업적 이용 등의 제한이 있다고 작성자가 신고했습니다. 자세한 내용은 README를 확인해 주세요.',
    commercialUndeclared:
      '코드는 라이선스 조건에 따라 상업적으로 이용할 수 있습니다(이 플랫폼이 확인). 동봉된 소재의 제한 여부는 작성자가 신고하지 않았습니다.',
    commercialServices: '이용하는 외부 서비스의 약관도 확인해 주세요.',
    tagFree: '무료',
    tagCommercialOk: '상업적 이용 가능',
  },
};

const ptBR: Dict = {
  tagline: 'Um depósito de plugins de áudio de código aberto, com download gratuito',
  siteDescription:
    'Um registro de plugins de áudio de código aberto que você pode pesquisar pela web ou por agentes de IA como Claude Code e Codex. Cada arquivo listado tem a atestação de procedência da build verificada e é comparado com um banco de dados de malware conhecido.',
  notice:
    'Esta plataforma é um serviço não oficial, sem vínculo com os criadores dos formatos de plugin nem com os desenvolvedores de DAWs. Ela não garante a segurança de nenhum plugin; por isso, use os plugins com cuidado e por sua conta e risco.',
  noticeShort: 'Esta plataforma não é oficial e não garante a segurança dos plugins; por isso, use-os com cuidado.',
  searchHeading: 'Encontre plugins de áudio',
  searchPlaceholder: 'Palavra-chave (ex.: pitch shift)',
  searchButton: 'Buscar',
  osAll: 'Todos',
  osLabel: 'SO',
  os: { windows: 'Windows', macos: 'macOS', linux: 'Linux' },
  commit: 'Commit',
  categoryLabel: 'Categoria',
  categoryAll: 'Todas',
  latest: 'Novos e atualizados',
  resultsFor: (q, n) => `Resultados para "${q}": ${n}`,
  results: (n) => `${n} plugins`,
  noResults: 'Nenhum plugin corresponde. Tente outra palavra-chave.',
  prev: 'Anterior',
  next: 'Próxima',
  summaryOriginal: 'Este resumo é o texto original do autor no GitHub.',
  updated: 'Atualizado',
  status: { listed: 'Listado', pending: 'Em verificação', suspended: 'Suspenso', removed: 'Removido' },
  categories: {
    instrument: 'Instrumentos',
    effect: 'Efeitos',
    analyzer: 'Análise e medidores',
    midi: 'MIDI',
    utility: 'Utilitários',
  },
  library: 'Biblioteca',
  author: 'Autor',
  license: 'Licença',
  supportedOs: 'Sistemas suportados',
  pluginTitleSuffix: 'Plugin de áudio',
  unknown: 'Não confirmado',
  version: 'Versão',
  source: 'Código-fonte',
  releases: 'Versões',
  repository: 'Repositório no GitHub',
  releaseList: 'Versões no GitHub',
  download: 'Baixar do GitHub',
  filesAndChecks: 'Arquivos e verificações',
  file: 'Arquivo',
  size: 'Tamanho',
  checks: 'Verificações',
  check: {
    malicious: 'Detectado',
    not_found: 'Fora da base',
    pending: 'Aguardando',
    error: 'Falha na verificação',
  },
  malwarebazaarNotFound: 'Não é uma amostra de malware conhecida',
  noDetectionNotSafe: 'Um arquivo sem detecções não é necessariamente seguro; por isso, use-o com cuidado.',
  cautions: 'Observações',
  cautionItems: [
    'O autor publicou estes arquivos no GitHub; por isso, leia as instruções do autor antes de instalar.',
    'Extraia o arquivo compactado e coloque cada bundle de plugin na pasta de plugins do formato correspondente, conforme as instruções do autor.',
    'Compare o SHA-256 do arquivo baixado com o valor mostrado aqui.',
  ],
  reportPlugin: 'Denunciar este plugin',
  suspendedDetail: 'Esta plataforma suspendeu este plugin e, por isso, não mostra links de download.',
  removedDetail: 'Este plugin não está mais público no GitHub e, por isso, não pode ser baixado.',
  reasonLabel: 'Motivo',
  suspendedReleasesTitle: 'Versões suspensas',
  suspendedReleaseLabel: (tag) => `Versão ${tag}`,
  suspendedReasons: { admin: 'Suspensa pelo operador', malicious: 'Malware detectado' },
  listedPeriod: (from, until) => `Listada aqui de ${from} até ${until ?? 'agora'}`,
  noticesTitle: 'Avisos',
  noticesIntro:
    'Estas são as versões que esta plataforma suspendeu. Se você baixou um destes arquivos durante o período listado, apague o plugin das suas pastas de plugins e verifique seu PC.',
  noticesEmpty: 'Não há avisos.',
  sideAgentTitle: 'Use com agentes de IA',
  sideAgentBody:
    'Conecte o Claude Code ou o Codex via MCP para buscar plugins conversando. Os autores de plugins de áudio também podem enviar seus plugins conversando.',
  sideAgentExample: 'Exemplo: "Encontre um plugin de pitch shift que funcione no Windows"',
  sideAgentLink: 'Como conectar',
  sideListingTitle: 'Sobre listagens e verificações',
  sideListingItems: [
    'Os autores enviam os próprios repositórios públicos do GitHub.',
    'Esta plataforma verifica a procedência da build de cada arquivo e inspeciona os bundles de plugin dentro de cada arquivo compactado.',
    'Esta plataforma compara os arquivos com um banco de dados de malware conhecido.',
    'Um arquivo sem detecções não é necessariamente seguro; use-o com cuidado.',
  ],
  sidePolicy: 'Política de listagem',
  sideReport: 'Denunciar',
  sideStatsTitle: 'Status do depósito',
  sideStatsListed: (n) => `${n} plugins listados`,
  sideStatsSynced: 'Informações do GitHub verificadas em',
  sameAuthor: 'Mais deste autor',
  sameCategory: 'Novos nesta categoria',
  nav: {
    about: 'O que é o Audio Plugin Soko-kun?',
    policy: 'Política de listagem',
    submit: 'Enviar um plugin',
    security: 'Segurança e isenção',
    report: 'Denunciar',
    privacy: 'Política de privacidade',
    terms: 'Termos de uso',
    source: 'Código-fonte no GitHub',
    sponsor: 'Apoiar o desenvolvimento',
    notices: 'Avisos',
  },
  translationNote: 'Esta tradução é apenas uma referência; por isso, confira o conteúdo exato na versão em inglês.',
  englishVersion: 'Versão em inglês',
  languageLabel: 'Idioma',
  notFound: 'A página que você procura não foi encontrada.',
  machineTranslated: 'Este resumo foi traduzido automaticamente do original.',
  showOriginal: 'Mostrar o original',
  showTranslation: 'Mostrar a tradução automática',
  machineTranslatedShort: 'Tradução automática',
  downloadNote: 'O arquivo é baixado diretamente do GitHub. Esta plataforma não hospeda arquivos.',
  sideLatestTitle: '5 plugins mais recentes',
  sideSubmitTitle: 'Envie seu plugin',
  sideSubmitBody: 'Autores de plugins de áudio podem enviar seus repositórios do GitHub por um agente de IA.',
  sideSubmitLink: 'Como enviar',
  submitNav: 'Enviar um plugin',
  translationNoteJa: 'Esta tradução é apenas uma referência; por isso, confira o conteúdo exato na versão em japonês.',
  japaneseVersion: 'Versão em japonês',
  contactLabel: 'Contato do desenvolvedor',
  sister: { before: 'Serviço irmão: ', name: 'Plugin Soko-kun', after: ' (plugins para o OBS Studio)' },
  cautionLabel: 'Atenção',
  showContact: 'Mostrar contato',
  contactHint: 'Ao enviar o e-mail, substitua [at] por @.',
  contactUnavailable: 'O contato do desenvolvedor está em preparação.',
  imageAlt: 'Imagem de descrição de {name}',
  playAnimation: 'Reproduzir animação',
  downloadsLabel: 'Downloads (GitHub)',
  downloadsShort: 'Downloads',
  downloadsAsOf: 'em {date}',
  downloadsNote: 'É o número de downloads no GitHub, sem se limitar aos feitos por este site.',
  sideWeeklyTitle: 'Top 5 de downloads semanais',
  formatLabel: 'Formato',
  formatAll: 'Todos',
  vstListNote:
    'A etiqueta VST® 3 aparece apenas em plugins cujos arquivos de distribuição foram inspecionados e contêm um pacote VST 3.',
  archLabel: 'Arquitetura',
  macosNotGuided:
    'Esta plataforma não lista os arquivos para macOS desta versão. Apenas os arquivos mostrados aqui são indicados.',
  attestationLabel: 'Procedência da build',
  attestationVerified: 'Verificada',
  macosSigningLabel: 'Assinatura e notarização no macOS',
  macosSigningPassed: 'Assinatura Developer ID e notarização confirmadas',
  pricing: {
    heading: 'Licença e declarações do autor',
    checkedTitle: 'Verificado por esta plataforma',
    licenseChecked: 'Aprovada pela OSI ou reconhecida como livre pela FSF',
    declaredTitle: 'Declarado pelo autor',
    declaredNote:
      'O autor declarou estes itens em .audio-soko-kun/config.json. Esta plataforma não os verifica. Os arquivos podem sempre ser baixados gratuitamente das versões públicas no GitHub.',
    paidFeatures: 'Recursos liberados por pagamento',
    paidServices: 'Serviços pagos contratados à parte',
    restrictedAssets: 'Materiais incluídos com restrições de uso',
    supportUrl: 'Página de apoio ou compra',
    yes: 'Sim',
    no: 'Não',
    none: 'Nenhum (declarado)',
    notDeclared: 'Não declarado pelo autor',
    tagPaidFeatures: 'Recursos pagos',
    tagPaidServices: 'Serviços pagos',
    tagRestrictedAssets: 'Restrições de uso comercial em materiais',
    commercialUse: 'Uso comercial',
    commercialAllowed:
      'Permitido nos termos da licença. Esta plataforma verificou a licença do código, e o autor declara que os materiais incluídos não têm restrições de uso.',
    commercialRestrictedAssets:
      'O código pode ser usado comercialmente nos termos da licença (verificado por esta plataforma). O autor declara que os materiais incluídos têm restrições, como de uso comercial. Consulte o README para mais detalhes.',
    commercialUndeclared:
      'O código pode ser usado comercialmente nos termos da licença (verificado por esta plataforma). O autor não declarou se os materiais incluídos têm restrições.',
    commercialServices: 'Confira também os termos dos serviços externos utilizados.',
    tagFree: 'Grátis',
    tagCommercialOk: 'Uso comercial permitido',
  },
};

const es419: Dict = {
  tagline: 'Un depósito de plugins de audio de código abierto, con descarga gratuita',
  siteDescription:
    'Un registro de plugins de audio de código abierto que puedes buscar desde la web o desde agentes de IA como Claude Code y Codex. Cada archivo listado tiene verificada la atestación de procedencia de la compilación y se compara con una base de datos de malware conocido.',
  notice:
    'Esta plataforma es un servicio no oficial, sin relación con los creadores de los formatos de plugin ni con los desarrolladores de DAW. No garantiza la seguridad de ningún plugin; por eso, usa los plugins con cuidado y bajo tu propia responsabilidad.',
  noticeShort: 'Esta plataforma no es oficial y no garantiza la seguridad de los plugins; por eso, úsalos con cuidado.',
  searchHeading: 'Encuentra plugins de audio',
  searchPlaceholder: 'Palabra clave (p. ej., pitch shift)',
  searchButton: 'Buscar',
  osAll: 'Todos',
  osLabel: 'SO',
  os: { windows: 'Windows', macos: 'macOS', linux: 'Linux' },
  commit: 'Commit',
  categoryLabel: 'Categoría',
  categoryAll: 'Todas',
  latest: 'Nuevos y actualizados',
  resultsFor: (q, n) => `Resultados para "${q}": ${n}`,
  results: (n) => `${n} plugins`,
  noResults: 'Ningún plugin coincide. Prueba con otra palabra clave.',
  prev: 'Anterior',
  next: 'Siguiente',
  summaryOriginal: 'Este resumen es el texto original del autor en GitHub.',
  updated: 'Actualizado',
  status: { listed: 'En la lista', pending: 'En revisión', suspended: 'Suspendido', removed: 'Retirado' },
  categories: {
    instrument: 'Instrumentos',
    effect: 'Efectos',
    analyzer: 'Análisis y medidores',
    midi: 'MIDI',
    utility: 'Utilidades',
  },
  library: 'Biblioteca',
  author: 'Autor',
  license: 'Licencia',
  supportedOs: 'Sistemas compatibles',
  pluginTitleSuffix: 'Plugin de audio',
  unknown: 'Sin confirmar',
  version: 'Versión',
  source: 'Código fuente',
  releases: 'Versiones',
  repository: 'Repositorio en GitHub',
  releaseList: 'Versiones en GitHub',
  download: 'Descargar de GitHub',
  filesAndChecks: 'Archivos y revisiones',
  file: 'Archivo',
  size: 'Tamaño',
  checks: 'Revisiones',
  check: {
    malicious: 'Detectado',
    not_found: 'No registrado',
    pending: 'En espera',
    error: 'Falló la revisión',
  },
  malwarebazaarNotFound: 'No es una muestra de malware conocida',
  noDetectionNotSafe: 'Un archivo sin detecciones no es necesariamente seguro; por eso, úsalo con cuidado.',
  cautions: 'Notas',
  cautionItems: [
    'El autor publicó estos archivos en GitHub; por eso, lee las instrucciones del autor antes de instalar.',
    'Extrae el archivo comprimido y coloca cada bundle de plugin en la carpeta de plugins de su formato, según las instrucciones del autor.',
    'Compara el SHA-256 del archivo descargado con el valor que se muestra aquí.',
  ],
  reportPlugin: 'Reportar este plugin',
  suspendedDetail: 'Esta plataforma suspendió este plugin y, por eso, no muestra enlaces de descarga.',
  removedDetail: 'Este plugin ya no es público en GitHub y, por eso, no se puede descargar.',
  reasonLabel: 'Motivo',
  suspendedReleasesTitle: 'Versiones suspendidas',
  suspendedReleaseLabel: (tag) => `Versión ${tag}`,
  suspendedReasons: { admin: 'Suspendida por el operador', malicious: 'Se detectó malware' },
  listedPeriod: (from, until) => `En la lista de esta plataforma desde ${from} hasta ${until ?? 'ahora'}`,
  noticesTitle: 'Avisos',
  noticesIntro:
    'Estas son las versiones que esta plataforma suspendió. Si descargaste uno de estos archivos durante el período indicado, borra el plugin de tus carpetas de plugins y analiza tu PC.',
  noticesEmpty: 'No hay avisos.',
  sideAgentTitle: 'Úsalo con agentes de IA',
  sideAgentBody:
    'Conecta Claude Code o Codex por MCP para buscar plugins conversando. Los autores de plugins de audio también pueden enviar sus plugins conversando.',
  sideAgentExample: 'Ejemplo: "Busca un plugin de pitch shift que funcione en Windows"',
  sideAgentLink: 'Cómo conectar',
  sideListingTitle: 'Sobre la lista y las revisiones',
  sideListingItems: [
    'Los autores envían sus propios repositorios públicos de GitHub.',
    'Esta plataforma verifica la procedencia de la compilación de cada archivo e inspecciona los bundles de plugin de cada archivo comprimido.',
    'Esta plataforma compara los archivos con una base de datos de malware conocido.',
    'Un archivo sin detecciones no es necesariamente seguro; úsalo con cuidado.',
  ],
  sidePolicy: 'Política de la lista',
  sideReport: 'Reportar',
  sideStatsTitle: 'Estado del depósito',
  sideStatsListed: (n) => `${n} plugins en la lista`,
  sideStatsSynced: 'Información de GitHub verificada el',
  sameAuthor: 'Más de este autor',
  sameCategory: 'Nuevos en esta categoría',
  nav: {
    about: '¿Qué es Audio Plugin Soko-kun?',
    policy: 'Política de la lista',
    submit: 'Enviar un plugin',
    security: 'Seguridad y descargo',
    report: 'Reportar',
    privacy: 'Política de privacidad',
    terms: 'Términos de uso',
    source: 'Código fuente en GitHub',
    sponsor: 'Apoyar el desarrollo',
    notices: 'Avisos',
  },
  translationNote:
    'Esta traducción es solo de referencia; por eso, consulta el contenido exacto en la versión en inglés.',
  englishVersion: 'Versión en inglés',
  languageLabel: 'Idioma',
  notFound: 'No se encontró la página que buscas.',
  machineTranslated: 'Este resumen se tradujo automáticamente del original.',
  showOriginal: 'Mostrar el original',
  showTranslation: 'Mostrar la traducción automática',
  machineTranslatedShort: 'Traducción automática',
  downloadNote: 'El archivo se descarga directamente de GitHub. Esta plataforma no aloja archivos.',
  sideLatestTitle: 'Los 5 plugins más recientes',
  sideSubmitTitle: 'Envía tu plugin',
  sideSubmitBody: 'Los autores de plugins de audio pueden enviar sus repositorios de GitHub desde un agente de IA.',
  sideSubmitLink: 'Cómo enviar',
  submitNav: 'Enviar un plugin',
  translationNoteJa:
    'Esta traducción es solo de referencia; por eso, consulta el contenido exacto en la versión en japonés.',
  japaneseVersion: 'Versión en japonés',
  contactLabel: 'Contacto del desarrollador',
  sister: { before: 'Servicio hermano: ', name: 'Plugin Soko-kun', after: ' (plugins para OBS Studio)' },
  cautionLabel: 'Atención',
  showContact: 'Mostrar contacto',
  contactHint: 'Al enviar el correo, reemplaza [at] por @.',
  contactUnavailable: 'El contacto del desarrollador está en preparación.',
  imageAlt: 'Imagen descriptiva de {name}',
  playAnimation: 'Reproducir animación',
  downloadsLabel: 'Descargas (GitHub)',
  downloadsShort: 'Descargas',
  downloadsAsOf: 'al {date}',
  downloadsNote: 'Es el número de descargas en GitHub, sin limitarse a las hechas desde este sitio.',
  sideWeeklyTitle: 'Top 5 de descargas semanales',
  formatLabel: 'Formato',
  formatAll: 'Todos',
  vstListNote:
    'La etiqueta VST® 3 solo aparece en plugins cuyos archivos de distribución se inspeccionaron y contienen un paquete VST 3.',
  archLabel: 'Arquitectura',
  macosNotGuided:
    'Esta plataforma no lista los archivos para macOS de esta versión. Solo se indican los archivos que se muestran aquí.',
  attestationLabel: 'Procedencia de la compilación',
  attestationVerified: 'Verificada',
  macosSigningLabel: 'Firma y notarización en macOS',
  macosSigningPassed: 'Firma Developer ID y notarización confirmadas',
  pricing: {
    heading: 'Licencia y declaraciones del autor',
    checkedTitle: 'Verificado por esta plataforma',
    licenseChecked: 'Aprobada por la OSI o reconocida como libre por la FSF',
    declaredTitle: 'Declarado por el autor',
    declaredNote:
      'El autor declaró estos datos en .audio-soko-kun/config.json. Esta plataforma no los verifica. Los archivos siempre se pueden descargar gratis desde las versiones públicas en GitHub.',
    paidFeatures: 'Funciones que se desbloquean con un pago',
    paidServices: 'Servicios de pago que se contratan aparte',
    restrictedAssets: 'Materiales incluidos con restricciones de uso',
    supportUrl: 'Página de apoyo o compra',
    yes: 'Sí',
    no: 'No',
    none: 'Ninguno (declarado)',
    notDeclared: 'No declarado por el autor',
    tagPaidFeatures: 'Funciones de pago',
    tagPaidServices: 'Servicios de pago',
    tagRestrictedAssets: 'Restricciones de uso comercial en materiales',
    commercialUse: 'Uso comercial',
    commercialAllowed:
      'Permitido según los términos de la licencia. Esta plataforma verificó la licencia del código, y el autor declara que los materiales incluidos no tienen restricciones de uso.',
    commercialRestrictedAssets:
      'El código puede usarse comercialmente según los términos de la licencia (verificado por esta plataforma). El autor declara que los materiales incluidos tienen restricciones, como de uso comercial. Consulta el README para más detalles.',
    commercialUndeclared:
      'El código puede usarse comercialmente según los términos de la licencia (verificado por esta plataforma). El autor no declaró si los materiales incluidos tienen restricciones.',
    commercialServices: 'Revisa también los términos de los servicios externos que usa.',
    tagFree: 'Gratis',
    tagCommercialOk: 'Uso comercial permitido',
  },
};

export const DICTS: Record<Lang, Dict> = {
  ja,
  en,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  ko,
  'pt-BR': ptBR,
  'es-419': es419,
};
