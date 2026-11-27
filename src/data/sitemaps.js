import { isIndexablePage, localizedRoute, pageNames, siteLocales } from '../i18n/routes.js';

const indexablePages = pageNames.filter(isIndexablePage);

/** Mirrors `getAbsoluteLocaleUrl` for builds whose Astro site URL includes the deployment base. */
export function pageUrlFor(siteUrl) {
  const base = siteUrl.pathname.replace(/\/+$/, '');
  return (locale, page) => {
    const route = localizedRoute(locale, page);
    const path = `${base}/${route}`.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
    return new URL(path, siteUrl.origin).href;
  };
}

function escapeXml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** `urlFor` returns the public address of one language version of a page. */
export function sitemapXml(urlFor) {
  const urls = indexablePages.flatMap((page) => siteLocales.map((locale) => {
    const links = siteLocales.map((language) => ({ hreflang: language, href: urlFor(language, page) }));
    return { loc: urlFor(locale, page), links: [...links, { hreflang: 'x-default', href: urlFor('zh-CN', page) }] };
  }));
  const body = urls.map(({ loc, links }) => [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    ...links.map(({ hreflang, href }) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}" />`),
    '  </url>',
  ].join('\n')).join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    body,
    '</urlset>',
    '',
  ].join('\n');
}

export function robotsText(sitemapUrl = null) {
  const lines = ['User-agent: *', 'Allow: /'];
  if (sitemapUrl) lines.push('', `Sitemap: ${sitemapUrl}`);
  return `${lines.join('\n')}\n`;
}
