// 固定ページの本文。言語ごとの本文は content/ に置く。利用規約とプライバシーポリシーは日本語版が正で、ほかのページは英語版が正。
// 段落は平文で持ち、表示のときにエスケープする。{{ORIGIN}} は表示のときにサイトの URL へ置き換える。
import { en } from './content/en';
import { es419 } from './content/es-419';
import { ja } from './content/ja';
import { ko } from './content/ko';
import { ptBR } from './content/pt-br';
import { zhHans } from './content/zh-hans';
import { zhHant } from './content/zh-hant';
import type { Lang } from './i18n';

export const PAGE_KEYS = ['about', 'policy', 'submit', 'security', 'report', 'terms', 'privacy'] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

// 本文の要素。文字列は段落、code はコードブロック、list は箇条書き。
// contact は「連絡先を表示」ボタン。アドレスは本文に書かない。
// formats は対象の規格の行で、値は行の見出し。VST の語を書くページでは、VST の語より前に置く (ADR 0004)。
// important は、作者向けの最重要の文 (掲載すると誰でも無料で入手でき、商用利用できる) を枠で囲んで置く位置。
// 文と枠の見出しは UI の辞書 (i18n.ts の pricing.authorImportant) から取り、本家と同じ文にそろえる。
export type Block =
  | string
  | { code: string }
  | { list: string[] }
  | { contact: true }
  | { formats: string }
  | { important: true };

export interface PageContent {
  title: string;
  // id は見出しのアンカー。MCP の説明やスキルから節へ直接リンクするときに付ける。
  sections: Array<{ id?: string; heading: string; paragraphs: Block[] }>;
}

// 本文に VST の語を含むページ。対象の規格の行も VST の語を表示する。下部に商標の注記を置く。
export const mentionsVst = (content: PageContent) =>
  JSON.stringify(content).includes('VST') ||
  content.sections.some((section) =>
    section.paragraphs.some((block) => typeof block === 'object' && 'formats' in block),
  );

// 正とする版。利用規約とプライバシーポリシーは日本語版、ほかは英語版。
export const AUTHORITATIVE: Record<PageKey, Lang> = {
  about: 'en',
  policy: 'en',
  submit: 'en',
  security: 'en',
  report: 'en',
  terms: 'ja',
  privacy: 'ja',
};

export const PAGES: Record<Lang, Record<PageKey, PageContent>> = {
  en,
  ja,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  ko,
  'pt-BR': ptBR,
  'es-419': es419,
};
