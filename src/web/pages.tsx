import type { Child, FC } from 'hono/jsx';
import type { ImageView, PluginView, SuspendedReleaseView } from '../domain/catalog';
import type { Arch, Category, Format, Os } from '../domain/metadata';
import type { ScanResult } from '../domain/status';
import type { Block, PageContent } from './content';
import type { Dict, Lang } from './i18n';
import { ContactButton, SearchButton, VstLogo, withLang } from './layout';

const formatDate = (iso: string | null | undefined, lang: Lang) =>
  iso ? new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(iso)) : '-';
const formatDateTime = (iso: string | null | undefined, lang: Lang) =>
  iso
    ? `${new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(
        new Date(iso),
      )} UTC`
    : '-';
const formatSize = (bytes: number, lang: Lang) =>
  new Intl.NumberFormat(lang, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }).format(bytes / 1_000_000);

// 規格名は翻訳しない。VST の語には、ページの中の初出にだけ ® を付ける (docs/design/ui.md の「VST の語の表示」)。
const FORMAT_NAMES: Record<Format, string> = { vst3: 'VST 3', clap: 'CLAP', lv2: 'LV2', au: 'Audio Unit' };
export const formatName = (format: Format, firstOnPage = false) =>
  format === 'vst3' && firstOnPage ? 'VST® 3' : FORMAT_NAMES[format];
const formatList = (formats: Format[]) => formats.map((format) => FORMAT_NAMES[format]).join(', ');
const osList = (t: Dict, os: Os[]) => os.map((value) => t.os[value]).join(', ');
const archList = (arches: Arch[]) => arches.join(', ');

export const CategoryTag: FC<{ category: Category; t: Dict; lang: Lang }> = ({ category, t, lang }) => (
  <a class={`tag ${category}`} href={withLang(`/?category=${category}`, lang)}>
    {t.categories[category]}
  </a>
);

export const StatusBadge: FC<{ view: PluginView; t: Dict }> = ({ view, t }) => (
  <span class={`status ${view.status}`}>{t.status[view.status]}</span>
);

// 概要は画面の言語の機械翻訳を表示し、自動翻訳である旨と原文へのリンクを添える。翻訳も外部データとしてエスケープする。
export function summaryFor(view: PluginView, lang: Lang, showOriginal: boolean) {
  if (!view.summary) return null;
  const translated = view.summaryLang !== lang ? view.translations[lang] : undefined;
  if (!translated || showOriginal) return { text: view.summary, translated: false, available: Boolean(translated) };
  return { text: translated, translated: true, available: true };
}

export const Summary: FC<{ view: PluginView; t: Dict; lang: Lang; showOriginal: boolean; path?: string }> = ({
  view,
  t,
  lang,
  showOriginal,
  path,
}) => {
  const summary = summaryFor(view, lang, showOriginal);
  if (!summary) return null;
  return (
    <>
      <p class="summary" lang={summary.translated ? lang : 'und'}>
        {summary.text}
      </p>
      {path ? (
        summary.translated ? (
          <p class="untrusted-note">
            {t.machineTranslated} <a href={withLang(`${path}?orig=1`, lang)}>{t.showOriginal}</a>
          </p>
        ) : summary.available ? (
          <p class="untrusted-note">
            {t.summaryOriginal} <a href={withLang(path, lang)}>{t.showTranslation}</a>
          </p>
        ) : (
          <p class="untrusted-note">{t.summaryOriginal}</p>
        )
      ) : summary.translated ? (
        <p class="untrusted-note">{t.machineTranslatedShort}</p>
      ) : null}
    </>
  );
};

// 固定ページの本文の URL をリンクにする。本文はこのプラットフォームが書いた文に限る。
// <owner> のような置き換え用の語を含む例の URL はリンクにしない。
const URL_TOKEN = /https?:\/\/[^\s「」"()]+/g;
const TRAILING = /[.,、。:;!?」』）)]+$/;
export const Linkified: FC<{ text: string }> = ({ text }) => {
  const parts: Array<string | { href: string }> = [];
  let last = 0;
  for (const match of text.matchAll(URL_TOKEN)) {
    const start = match.index ?? 0;
    const token = match[0];
    const url = token.replace(TRAILING, '');
    if (url.includes('<') || url.includes('>')) continue;
    parts.push(text.slice(last, start), { href: url });
    last = start + url.length;
  }
  parts.push(text.slice(last));
  return (
    <>
      {parts.map((part) =>
        typeof part === 'string' ? (
          part
        ) : (
          <a href={part.href} rel="noopener noreferrer">
            {part.href}
          </a>
        ),
      )}
    </>
  );
};

// 一覧の申告のタグ。有料の機能・有料サービス・素材の制限があると申告したものだけに付け、申告なし (null) には付けない。
const PricingTags: FC<{ view: PluginView; t: Dict }> = ({ view, t }) => {
  const { paidFeatures, paidServices, restrictedAssets } = view.pricing;
  const tags = [
    paidFeatures === true ? t.pricing.tagPaidFeatures : null,
    paidServices && paidServices.length > 0 ? t.pricing.tagPaidServices : null,
    restrictedAssets === true ? t.pricing.tagRestrictedAssets : null,
  ].filter((tag): tag is string => tag !== null);
  return (
    <>
      {tags.map((tag) => (
        <li>
          <span class="pill declared">{tag}</span>
        </li>
      ))}
    </>
  );
};

// 作者の申告の値。null は申告なしで、「なし」と区別して表示する。
const declaredFlag = (t: Dict, value: boolean | null) =>
  value === null ? t.pricing.notDeclared : value ? t.pricing.yes : t.pricing.no;

// ライセンスと作者の申告の区画。このプラットフォームが確かめたライセンスと、確かめていない作者の申告を分けて示す。
// 申告の文字列と URL は作者の書いた外部データなので、JSX のエスケープに任せ、属性以外に生の HTML を出さない。
const PricingSection: FC<{ view: PluginView; t: Dict }> = ({ view, t }) => {
  const { paidFeatures, paidServices, restrictedAssets, supportUrl } = view.pricing;
  return (
    <>
      <h2 class="bar">{t.pricing.heading}</h2>
      <h3 class="sub">{t.pricing.checkedTitle}</h3>
      <table class="info">
        <tbody>
          <tr>
            <th scope="row">{t.license}</th>
            <td>
              {/* 単一の SPDX 識別子は、再配布の条件を本文で確かめられるよう SPDX のライセンスの一覧へリンクする。 */}
              {/^[A-Za-z0-9.+-]+$/.test(view.license) ? (
                <a href={`https://spdx.org/licenses/${view.license}.html`} rel="noopener noreferrer">
                  <span translate="no">{view.license}</span>
                </a>
              ) : (
                <span translate="no">{view.license}</span>
              )}{' '}
              <span class="note">{t.pricing.licenseChecked}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <h3 class="sub">{t.pricing.declaredTitle}</h3>
      <p class="untrusted-note">{t.pricing.declaredNote}</p>
      <table class="info declared">
        <tbody>
          <tr>
            <th scope="row">{t.pricing.paidFeatures}</th>
            <td>{declaredFlag(t, paidFeatures)}</td>
          </tr>
          <tr>
            <th scope="row">{t.pricing.paidServices}</th>
            <td>
              {paidServices === null ? (
                t.pricing.notDeclared
              ) : paidServices.length === 0 ? (
                t.pricing.none
              ) : (
                <span lang="und" translate="no">
                  {paidServices.join(', ')}
                </span>
              )}
            </td>
          </tr>
          <tr>
            <th scope="row">{t.pricing.restrictedAssets}</th>
            <td>{declaredFlag(t, restrictedAssets)}</td>
          </tr>
          <tr>
            <th scope="row">{t.pricing.supportUrl}</th>
            <td>
              {supportUrl === null ? (
                t.pricing.notDeclared
              ) : (
                <a href={supportUrl} rel="noopener noreferrer nofollow" target="_blank" translate="no">
                  {supportUrl}
                </a>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
};

export const PluginCards: FC<{ items: PluginView[]; t: Dict; lang: Lang }> = ({ items, t, lang }) =>
  items.length === 0 ? (
    <p>{t.noResults}</p>
  ) : (
    <ol class="cards">
      {items.map((view) => (
        <li>
          <div class="card-head">
            {view.images.logo ? (
              <img
                class="logo"
                src={`/plugins/${view.id}/logo?v=${view.images.logo.sha}`}
                width={view.images.logo.width}
                height={view.images.logo.height}
                alt=""
                loading="lazy"
              />
            ) : null}
            <a href={withLang(`/plugins/${view.id}`, lang)} translate="no">
              {view.name}
            </a>
            <span class="ver">{view.listedRelease?.tag}</span>
          </div>
          <ul class="tags">
            <li>
              <CategoryTag category={view.category} t={t} lang={lang} />
            </li>
            {view.formats.map((format) => (
              <li>
                <span class="pill format">{formatName(format)}</span>
              </li>
            ))}
            {view.os.map((os) => (
              <li>
                <span class="pill">{t.os[os]}</span>
              </li>
            ))}
            {view.arches.map((arch) => (
              <li>
                <span class="pill" translate="no">
                  {arch}
                </span>
              </li>
            ))}
            <PricingTags view={view} t={t} />
          </ul>
          <Summary view={view} t={t} lang={lang} showOriginal={false} />
          <p class="meta">
            <span translate="no">{view.owner}</span> | {t.updated} {formatDate(view.listedRelease?.publishedAt, lang)}
            {view.downloads
              ? ` | ${t.downloadsShort} ${new Intl.NumberFormat(lang).format(view.downloads.total)}`
              : null}
          </p>
        </li>
      ))}
    </ol>
  );

// 一覧のページの VST Compatible ロゴ。規格の絞り込みに VST® 3 を出すため、ロゴが要る。
// ロゴだけでは閲覧者に意味が伝わらないため、VST® 3 のタグを付ける条件の説明の文と組にする。
export const VstListNote: FC<{ t: Dict }> = ({ t }) => (
  <p class="vst-note">
    <VstLogo />
    <span>{t.vstListNote}</span>
  </p>
);

export const SearchForm: FC<{
  t: Dict;
  lang: Lang;
  keyword?: string;
  os?: string;
  format?: string;
  category?: string;
  categories: readonly Category[];
  formats: readonly Format[];
}> = ({ t, lang, keyword, os, format, category, categories, formats }) => (
  <search>
    <form class="search" method="get" action="/">
      <input type="hidden" name="lang" value={lang} />
      <div class="row">
        <input
          type="search"
          name="q"
          value={keyword ?? ''}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          maxlength={100}
        />
        <SearchButton label={t.searchButton} />
      </div>
      <div class="row">
        <label>
          {t.formatLabel}{' '}
          <select name="format">
            <option value="">{t.formatAll}</option>
            {formats.map((value) => (
              <option value={value} selected={format === value}>
                {formatName(value, true)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div class="row">
        <label>
          {t.osLabel}{' '}
          <select name="os">
            <option value="">{t.osAll}</option>
            {(['windows', 'macos', 'linux'] as const).map((value) => (
              <option value={value} selected={os === value}>
                {t.os[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.categoryLabel}{' '}
          <select name="category">
            <option value="">{t.categoryAll}</option>
            {categories.map((value) => (
              <option value={value} selected={category === value}>
                {t.categories[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </form>
  </search>
);

// 右の列の区画。幅の狭い画面用では、見出しを押すと開く部品にして、閉じた状態で表示する。
const SideSection: FC<{ title: string; collapsible: boolean; children?: Child }> = ({
  title,
  collapsible,
  children,
}) =>
  collapsible ? (
    <details class="side-box">
      <summary>{title}</summary>
      <div class="side-body">{children}</div>
    </details>
  ) : (
    <section class="side-box">
      <h2>{title}</h2>
      {children}
    </section>
  );

export const SideCommon: FC<{
  t: Dict;
  lang: Lang;
  listed: number;
  lastSyncedAt: string | null;
  latest: PluginView[];
  weekly: PluginView[];
  collapsible: boolean;
}> = ({ t, lang, listed, lastSyncedAt, latest, weekly, collapsible }) => (
  <>
    {latest.length > 0 ? (
      <SideSection title={t.sideLatestTitle} collapsible={collapsible}>
        <ul class="latest">
          {latest.map((view) => (
            <li>
              <a href={withLang(`/plugins/${view.id}`, lang)} translate="no">
                {view.name}
              </a>
              <span class="meta">
                {t.categories[view.category]} | {formatDate(view.createdAt, lang)}
              </span>
            </li>
          ))}
        </ul>
      </SideSection>
    ) : null}
    {weekly.length > 0 ? (
      <SideSection title={t.sideWeeklyTitle} collapsible={collapsible}>
        <ol class="weekly">
          {weekly.map((view) => (
            <li>
              <a href={withLang(`/plugins/${view.id}`, lang)} translate="no">
                {view.name}
              </a>
              <span class="meta">{new Intl.NumberFormat(lang).format(view.downloads?.weekly ?? 0)}</span>
            </li>
          ))}
        </ol>
        <p class="note">{t.downloadsNote}</p>
      </SideSection>
    ) : null}
    <SideSection title={t.sideAgentTitle} collapsible={collapsible}>
      <p>{t.sideAgentBody}</p>
      <p class="example">{t.sideAgentExample}</p>
      <p>
        <a href={withLang('/about#mcp', lang)}>{t.sideAgentLink}</a>
      </p>
    </SideSection>
    <SideSection title={t.sideListingTitle} collapsible={collapsible}>
      <ul>
        {t.sideListingItems.map((item) => (
          <li>{item}</li>
        ))}
      </ul>
      <p>
        <a href={withLang('/policy', lang)}>{t.sidePolicy}</a> | <a href={withLang('/report', lang)}>{t.sideReport}</a>
      </p>
    </SideSection>
    <SideSection title={t.sideSubmitTitle} collapsible={collapsible}>
      <p>{t.sideSubmitBody}</p>
      <p>
        <a href={withLang('/submit', lang)}>{t.sideSubmitLink}</a>
      </p>
    </SideSection>
    <SideSection title={t.sideStatsTitle} collapsible={collapsible}>
      <p>
        {t.sideStatsListed(listed)}
        <br />
        {t.sideStatsSynced} {formatDateTime(lastSyncedAt, lang)}
      </p>
    </SideSection>
  </>
);

export const SideRelated: FC<{
  t: Dict;
  lang: Lang;
  sameAuthor: PluginView[];
  sameCategory: PluginView[];
  collapsible: boolean;
}> = ({ t, lang, sameAuthor, sameCategory, collapsible }) => (
  <>
    {sameAuthor.length > 0 ? (
      <SideSection title={t.sameAuthor} collapsible={collapsible}>
        <ul>
          {sameAuthor.map((view) => (
            <li>
              <a href={withLang(`/plugins/${view.id}`, lang)} translate="no">
                {view.name}
              </a>
            </li>
          ))}
        </ul>
      </SideSection>
    ) : null}
    {sameCategory.length > 0 ? (
      <SideSection title={t.sameCategory} collapsible={collapsible}>
        <ul>
          {sameCategory.map((view) => (
            <li>
              <a href={withLang(`/plugins/${view.id}`, lang)} translate="no">
                {view.name}
              </a>
            </li>
          ))}
        </ul>
      </SideSection>
    ) : null}
  </>
);

const checkLabel = (t: Dict, result: ScanResult | undefined) => {
  if (!result) return t.check.pending;
  if (result === 'not_found') return t.malwarebazaarNotFound;
  return t.check[result];
};

// 説明の画像は表示用の WebP で出し、詳細ページを軽くする。GIF は閉じた details の中に置き、開いたときだけ読み込ませる。
// 閉じた details の中の img は loading="lazy" のときだけ読み込まれないため、GIF には必ず付ける。
const Shot: FC<{ view: PluginView; image: ImageView; t: Dict }> = ({ view, image, t }) => {
  const alt = t.imageAlt.replace('{name}', view.name);
  const original = `/plugins/${view.id}/image?v=${image.sha}`;
  const preview = image.preview ? (
    <img
      src={`/plugins/${view.id}/preview?v=${image.sha}`}
      width={image.preview.width}
      height={image.preview.height}
      alt={alt}
    />
  ) : null;
  if (image.type !== 'image/gif') {
    return <p class="shot">{preview ?? <img src={original} width={image.width} height={image.height} alt={alt} />}</p>;
  }
  return (
    <details class="shot anim">
      <summary>
        {preview ?? (
          // CSP が style 属性を許さないため、縦横比は SVG の viewBox で保つ。
          <svg
            class="placeholder"
            viewBox={`0 0 ${image.width} ${image.height}`}
            width={image.width}
            height={image.height}
            role="img"
            aria-label={alt}
          />
        )}
        <span class="play">▶ {t.playAnimation}</span>
      </summary>
      <img src={original} width={image.width} height={image.height} alt={alt} loading="lazy" />
    </details>
  );
};

// 止めた版の警告。すでにダウンロードした人に、版と配布物と掲載の期間を知らせる。
export const SuspendedReleases: FC<{ releases: SuspendedReleaseView[]; t: Dict; lang: Lang }> = ({
  releases,
  t,
  lang,
}) =>
  releases.length === 0 ? null : (
    <section class="callout suspended-releases">
      <h2>{t.suspendedReleasesTitle}</h2>
      <ul>
        {releases.map((release) => (
          <SuspendedReleaseItem release={release} t={t} lang={lang} />
        ))}
      </ul>
    </section>
  );

const SuspendedReleaseItem: FC<{ release: SuspendedReleaseView; t: Dict; lang: Lang }> = ({ release, t, lang }) => (
  <li>
    <b translate="no">{t.suspendedReleaseLabel(release.tag)}</b>: {t.suspendedReasons[release.reason]}
    {release.note ? (
      <p>
        <span lang="und">{release.note}</span>
      </p>
    ) : null}
    {release.listedFrom ? (
      <p>
        {t.listedPeriod(
          formatDateTime(release.listedFrom, lang),
          release.listedUntil ? formatDateTime(release.listedUntil, lang) : null,
        )}
      </p>
    ) : null}
    <ul>
      {release.assets.map((asset) => (
        <li>
          <span translate="no">{asset.name}</span>
          <div class="hash">SHA-256: {asset.digest.replace(/^sha256:/, '')}</div>
        </li>
      ))}
    </ul>
  </li>
);

// 告知ページ。止めた版を、止めた日時の新しい順に並べる。
export const NoticesPage: FC<{
  items: Array<{ view: PluginView; release: SuspendedReleaseView }>;
  t: Dict;
  lang: Lang;
}> = ({ items, t, lang }) => (
  <>
    <h1>{t.noticesTitle}</h1>
    <p>{t.noticesIntro}</p>
    {items.length === 0 ? (
      <p>{t.noticesEmpty}</p>
    ) : (
      <ul class="notices">
        {items.map(({ view, release }) => (
          <li>
            <a href={withLang(`/plugins/${view.id}`, lang)} translate="no">
              {view.name}
            </a>
            <ul>
              <SuspendedReleaseItem release={release} t={t} lang={lang} />
            </ul>
          </li>
        ))}
      </ul>
    )}
  </>
);

export const PluginDetail: FC<{ view: PluginView; t: Dict; lang: Lang; showOriginal: boolean }> = ({
  view,
  t,
  lang,
  showOriginal,
}) => {
  const head = (
    <>
      <p class="breadcrumb">
        <a href={withLang('/', lang)}>{t.library}</a> &gt;{' '}
        <a href={withLang(`/?category=${view.category}`, lang)}>{t.categories[view.category]}</a>
      </p>
      <div class="title">
        {view.status === 'listed' && view.images.logo ? (
          <img
            class="logo"
            src={`/plugins/${view.id}/logo?v=${view.images.logo.sha}`}
            width={view.images.logo.width}
            height={view.images.logo.height}
            alt=""
          />
        ) : null}
        <h1 translate="no">{view.name}</h1>
      </div>
      <ul class="tags">
        <li>
          <CategoryTag category={view.category} t={t} lang={lang} />
        </li>
        {view.status === 'listed'
          ? view.formats.map((format) => (
              <li>
                {/* 見出しのタグがページの中の VST の語の初出になる。 */}
                <span class="pill format">{formatName(format, format === 'vst3')}</span>
              </li>
            ))
          : null}
        {/* VST Compatible ロゴはタグの間に挟まず、同じ行の最後に置く。タグの高さをそろえて並べるため。 */}
        {view.status === 'listed' && view.formats.includes('vst3') ? (
          <li class="vst-logo-item">
            <VstLogo />
          </li>
        ) : null}
        {view.status !== 'listed' ? (
          <li>
            <StatusBadge view={view} t={t} />
          </li>
        ) : null}
      </ul>
    </>
  );

  if (view.status !== 'listed' || !view.listedRelease) {
    // 検査待ちのプラグインは詳細ページを 404 にするため、ここに来るのは停止と掲載終了だけ。
    const message = view.status === 'removed' ? t.removedDetail : t.suspendedDetail;
    return (
      <>
        {head}
        <p class="callout">
          <span class="label">{t.cautionLabel}</span>
          {message}
        </p>
        {view.status === 'suspended' && view.suspendedReason ? (
          <p>
            {t.reasonLabel}: <span lang="und">{view.suspendedReason}</span>
          </p>
        ) : null}
        <SuspendedReleases releases={view.suspendedReleases} t={t} lang={lang} />
        <p>
          <a href={withLang('/report', lang)}>{t.reportPlugin}</a>
        </p>
      </>
    );
  }

  const release = view.listedRelease;
  return (
    <>
      {head}
      <Summary view={view} t={t} lang={lang} showOriginal={showOriginal} path={`/plugins/${view.id}`} />
      {view.images.image ? <Shot view={view} image={view.images.image} t={t} /> : null}
      <div class="download">
        {release.assets.map((asset) => (
          <div class="download-item">
            <a class="button" href={asset.downloadUrl} rel="noopener noreferrer">
              {t.download}
            </a>
            <p>
              {release.tag} / <span translate="no">{asset.name}</span> / {formatSize(asset.size, lang)}
            </p>
            <p>
              {[osList(t, asset.os), archList(asset.arches), formatList(asset.formats)]
                .filter((part) => part.length > 0)
                .join(' / ')}
            </p>
          </div>
        ))}
        <p>{t.downloadNote}</p>
      </div>
      {view.macosNotGuided ? (
        <p class="callout">
          <span class="label">{t.cautionLabel}</span>
          {t.macosNotGuided}
        </p>
      ) : null}

      <h2 class="bar">{t.version}</h2>
      <table class="info">
        <tbody>
          <tr>
            <th scope="row">{t.author}</th>
            <td translate="no">{view.owner}</td>
          </tr>
          <tr>
            <th scope="row">{t.formatLabel}</th>
            <td translate="no">{view.formats.length > 0 ? formatList(view.formats) : t.unknown}</td>
          </tr>
          <tr>
            <th scope="row">{t.supportedOs}</th>
            <td>{view.os.length > 0 ? osList(t, view.os) : t.unknown}</td>
          </tr>
          <tr>
            <th scope="row">{t.archLabel}</th>
            <td translate="no">{view.arches.length > 0 ? archList(view.arches) : t.unknown}</td>
          </tr>
          <tr>
            <th scope="row">{t.version}</th>
            <td>
              {release.tag} ({formatDate(release.publishedAt, lang)})
            </td>
          </tr>
          <tr>
            <th scope="row">{t.commit}</th>
            <td class="hash">{release.commitSha.slice(0, 12)}</td>
          </tr>
          <tr>
            <th scope="row">{t.source}</th>
            <td>
              <a href={view.githubUrl} rel="noopener noreferrer">
                {t.repository}
              </a>
            </td>
          </tr>
          <tr>
            <th scope="row">{t.releases}</th>
            <td>
              <a href={view.releasesUrl} rel="noopener noreferrer">
                {t.releaseList}
              </a>
            </td>
          </tr>
          {view.downloads ? (
            <tr>
              <th scope="row">{t.downloadsLabel}</th>
              <td>
                {new Intl.NumberFormat(lang).format(view.downloads.total)}{' '}
                <span class="note">{t.downloadsAsOf.replace('{date}', formatDate(view.downloads.day, lang))}</span>
                <br />
                <span class="note">{t.downloadsNote}</span>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <PricingSection view={view} t={t} />

      <h2 class="bar">{t.filesAndChecks}</h2>
      <ul class="files">
        {release.assets.map((asset) => (
          <li>
            <div class="name">
              <a href={asset.downloadUrl} rel="noopener noreferrer" translate="no">
                {asset.name}
              </a>{' '}
              <span class="meta">{formatSize(asset.size, lang)}</span>
            </div>
            <div class="hash">SHA-256: {asset.digest.replace(/^sha256:/, '')}</div>
            {/* 案内する配布物は、証明の検証と、macOS 向けなら署名と公証の判定に通ったものだけ。 */}
            <ul class="checks">
              <li>
                {t.attestationLabel}: {t.attestationVerified}
              </li>
              {asset.os.includes('macos') ? (
                <li>
                  {t.macosSigningLabel}: {t.macosSigningPassed}
                </li>
              ) : null}
              <li>
                MalwareBazaar: {checkLabel(t, asset.scans.malwarebazaar?.result)},{' '}
                {formatDateTime(asset.scans.malwarebazaar?.scannedAt, lang)}
              </li>
            </ul>
          </li>
        ))}
      </ul>
      <p>{t.noDetectionNotSafe}</p>
      <SuspendedReleases releases={view.suspendedReleases} t={t} lang={lang} />

      <h2 class="bar">{t.cautions}</h2>
      <ul>
        {t.cautionItems.map((item) => (
          <li>{item}</li>
        ))}
      </ul>
      <p>
        <a href={withLang('/report', lang)}>{t.reportPlugin}</a>
      </p>
    </>
  );
};

const BlockView: FC<{ block: Block; origin: string; t: Dict; lang: Lang }> = ({ block, origin, t, lang }) => {
  const fill = (text: string) => text.replaceAll('{{ORIGIN}}', origin);
  if (typeof block === 'string') {
    return (
      <p>
        <Linkified text={fill(block)} />
      </p>
    );
  }
  if ('contact' in block) return <ContactButton t={t} lang={lang} />;
  // 対象の規格の行。ページの中の VST の語の初出に ® を付け、隣に VST Compatible ロゴを置く。
  if ('formats' in block) {
    return (
      <p class="formats-line">
        {block.formats}: <span translate="no">{formatName('vst3', true)}</span> <VstLogo />{' '}
        <span translate="no">{(['clap', 'lv2', 'au'] as const).map((format) => formatName(format)).join(', ')}</span>
      </p>
    );
  }
  if ('code' in block) {
    return (
      <pre class="code">
        <code>{fill(block.code)}</code>
      </pre>
    );
  }
  return (
    <ul class="blocks">
      {block.list.map((item) => (
        <li>
          <Linkified text={fill(item)} />
        </li>
      ))}
    </ul>
  );
};

export const StaticPage: FC<{
  content: PageContent;
  t: Dict;
  lang: Lang;
  path: string;
  anchorMcp: boolean;
  origin: string;
  authoritative: Lang;
}> = ({ content, t, lang, path, anchorMcp, origin, authoritative }) => (
  <>
    <h1>{content.title}</h1>
    {lang !== authoritative ? (
      <p class="translation-note">
        {authoritative === 'ja' ? t.translationNoteJa : t.translationNote}{' '}
        <a href={withLang(path, authoritative)}>{authoritative === 'ja' ? t.japaneseVersion : t.englishVersion}</a>
      </p>
    ) : null}
    {content.sections.map((section, index) => (
      <section id={section.id ?? (anchorMcp && index === 1 ? 'mcp' : undefined)}>
        <h2 class="bar">{section.heading}</h2>
        {section.paragraphs.map((block) => (
          <BlockView block={block} origin={origin} t={t} lang={lang} />
        ))}
      </section>
    ))}
  </>
);
