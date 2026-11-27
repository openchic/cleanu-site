import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetHref, hasHreflang, isIndexablePage, localizedRoute, pageNames, siteLocales } from '../src/i18n/routes.js';
import { pageUrlFor } from '../src/data/sitemaps.js';
import { resolveSiteUrl } from './localization.js';
import { checkoutHeaders } from '../src/data/purchase.js';
import { downloadPath, loadReleases, releaseId } from '../src/data/releases.js';

const directory = fileURLToPath(new URL('../dist/', import.meta.url));
const site = resolveSiteUrl(process.env.SITE_URL);
const base = site?.pathname.replace(/\/$/, '') ?? '';
const expectedUrl = site ? pageUrlFor(site) : null;
// URL resolution needs an origin even when checking a build without a public site URL.
const linkOrigin = site?.origin ?? 'https://site-check.invalid';
const releases = await loadReleases();
const expectedReleaseIds = releases.map(({ version }) => releaseId(version));
const latestRelease = releases[0];
const latestDownload = latestRelease ? assetHref(downloadPath(latestRelease), base) : null;
const indexableAlternates = new Map();

function pageLocation(route) {
  const path = route ? `${base}/${route}` : base || '/';
  return new URL(path, linkOrigin);
}

async function checkLinks(html, label, current) {
  for (const match of html.matchAll(/\b(?:href|src)="([^"<>]+)"/g)) {
    const raw = decodeMarkup(match[1]);
    if (raw.startsWith('#')) continue;
    const target = new URL(raw, current);
    if (target.origin !== current.origin || !['http:', 'https:'].includes(target.protocol)) continue;
    if (target.search) throw new Error(`Unexpected internal query: ${label}`);
    if (target.pathname !== base && !target.pathname.startsWith(`${base}/`)) throw new Error(`Link lost deployment path: ${label}`);
    const relative = decodeURIComponent(target.pathname.slice(base.length + 1));
    // Release assets are restored and checked by the existing dedicated release steps.
    if (relative.startsWith('downloads/')) continue;
    const file = resolve(directory, relative ? (extname(relative) ? relative : `${relative}.html`) : 'index.html');
    await access(file);
  }
}

function decodeMarkup(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#x27': "'" };
  return value.replace(/&(amp|lt|gt|quot|apos|#39|#x27);/g, (_, entity) => entities[entity]);
}

function headLinks(html) {
  const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  return {
    canonical: canonical ? decodeMarkup(canonical) : null,
    alternates: [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)]
      .map(([, hreflang, href]) => ({ hreflang, href: decodeMarkup(href) })),
    jsonLd: [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map(([, body]) => JSON.parse(body)),
  };
}

function checkReleaseData(html, route, page, locale) {
  if (page === 'index') {
    const version = html.match(/data-release-version="([^"]+)"/)?.[1];
    if (version !== latestRelease?.version) {
      throw new Error(`Home version differs from the release catalog: ${route}`);
    }
    const download = html.match(/href="([^"]+)" data-download/)?.[1];
    const expectedDownload = latestDownload ?? pageLocation(localizedRoute(locale, 'changelog')).pathname;
    if (!download || decodeMarkup(download) !== expectedDownload) {
      throw new Error(`Home download differs from the release catalog: ${route}`);
    }
  } else if (page === 'changelog') {
    const ids = [...html.matchAll(/<li class="log__item" id="([^"]+)">/g)].map(([, id]) => id);
    if (ids.join() !== expectedReleaseIds.join()) throw new Error(`Changelog versions differ from the release catalog: ${route}`);
  }
}

function checkIndexableData(route, page, data) {
  const nodes = data['@graph'];
  const types = nodes.map((node) => node['@type']);
  for (const type of ['Organization', 'WebSite', 'WebPage']) {
    if (!types.includes(type)) throw new Error(`Missing ${type}: ${route}`);
  }
  if (/"offers"|"aggregateRating"|"price"|dodopayments|\/buy\//.test(JSON.stringify(data))) {
    throw new Error(`Private purchase data leaked: ${route}`);
  }
  if (page !== 'index') return;
  const software = nodes.find((node) => node['@type'] === 'SoftwareApplication');
  const faq = nodes.find((node) => node['@type'] === 'FAQPage');
  if (!software || !faq) throw new Error(`Missing product nodes: ${route}`);
  if (faq.mainEntity.length !== 4) throw new Error(`Unexpected FAQ entries: ${route}`);
  const downloadUrl = latestDownload ? new URL(latestDownload, linkOrigin).href : undefined;
  if (software.softwareVersion !== latestRelease?.version || software.downloadUrl !== downloadUrl) {
    throw new Error(`Software release metadata differs from the release catalog: ${route}`);
  }
}

function checkAlternates(actual, expected, label) {
  if (actual.length !== expected.length) throw new Error(`Unexpected number of hreflang links: ${label}`);
  for (const { hreflang, href } of expected) {
    if (!actual.some((link) => link.hreflang === hreflang && link.href === href)) {
      throw new Error(`Missing hreflang ${hreflang} for ${href}: ${label}`);
    }
  }
}

function checkMetadata(html, route, locale, page) {
  const { canonical, alternates, jsonLd } = headLinks(html);
  if (!expectedUrl || !hasHreflang(page)) {
    if (canonical || alternates.length || jsonLd.length) throw new Error(`Unexpected search metadata: ${route}`);
    return;
  }
  const isIndexable = isIndexablePage(page);
  if (!isIndexable) {
    if (canonical || jsonLd.length) throw new Error(`Indexable metadata on the return page: ${route}`);
  } else {
    if (canonical !== expectedUrl(locale, page)) throw new Error(`Canonical does not match the published address: ${route}`);
    if (jsonLd.length !== 1) throw new Error(`Expected one structured data block: ${route}`);
    const [data] = jsonLd;
    if (data['@context'] !== 'https://schema.org' || !Array.isArray(data['@graph'])) throw new Error(`Invalid structured data graph: ${route}`);
    if (data['@graph'].find((node) => node['@type'] === 'WebPage')?.url !== canonical) throw new Error(`WebPage node lost its address: ${route}`);
    checkIndexableData(route, page, data);
  }
  const expectedAlternates = [
    { hreflang: 'zh-CN', href: expectedUrl('zh-CN', page) },
    { hreflang: 'en', href: expectedUrl('en', page) },
  ];
  if (isIndexable) {
    expectedAlternates.push({ hreflang: 'x-default', href: expectedUrl('zh-CN', page) });
  }
  checkAlternates(alternates, expectedAlternates, route);
  if (isIndexable) indexableAlternates.set(canonical, alternates);
}

let checked = 0;
for (const locale of siteLocales) {
  for (const page of pageNames) {
    const route = localizedRoute(locale, page);
    const html = await readFile(join(directory, route ? `${route}.html` : 'index.html'), 'utf8');
    const current = pageLocation(route);
    if (!html.includes(`<html lang="${locale}">`)) throw new Error(`Incorrect page language: ${current.pathname}`);
    const otherLocale = locale === 'en' ? 'zh-CN' : 'en';
    const languageHref = html.match(/data-language-link href="([^"]+)"/)?.[1];
    const expectedHref = pageLocation(localizedRoute(otherLocale, page)).pathname;
    if (!languageHref || decodeMarkup(languageHref) !== expectedHref) {
      throw new Error(`Language link must point to ${expectedHref}: ${current.pathname}`);
    }
    if (page === 'checkout') {
      if (!html.includes('name="robots" content="noindex, noarchive"') || !html.includes('name="referrer" content="no-referrer"')) throw new Error(`Missing return privacy metadata: ${route}`);
      if (!html.includes('URLSearchParams') || !html.includes('data-checkout-message="neutral"')) throw new Error(`Missing safe return guidance: ${route}`);
      const sanitizer = html.indexOf('URLSearchParams');
      if (sanitizer > html.indexOf('rel="icon"')) throw new Error(`Return sanitizer is too late: ${route}`);
    }
    await checkLinks(html, route, current);
    checkReleaseData(html, route, page, locale);
    checkMetadata(html, route, locale, page);
    checked += 1;
  }
}

const robots = await readFile(join(directory, 'robots.txt'), 'utf8');
if (!robots.startsWith('User-agent: *\nAllow: /\n')) throw new Error('robots.txt must allow all crawlers');
if (expectedUrl) {
  const expectedSitemap = new URL('sitemap.xml', site).href;
  if (!robots.includes(`Sitemap: ${expectedSitemap}\n`)) throw new Error('robots.txt must point at the published sitemap');
  const sitemap = await readFile(join(directory, 'sitemap.xml'), 'utf8');
  const seen = new Set();
  for (const [, entry] of sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = decodeMarkup(entry.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? '');
    const expected = indexableAlternates.get(loc);
    if (!expected || seen.has(loc)) throw new Error(`Unexpected sitemap.xml entry: ${loc}`);
    seen.add(loc);
    const alternates = [...entry.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/>/g)]
      .map(([, hreflang, href]) => ({ hreflang, href: decodeMarkup(href) }));
    checkAlternates(alternates, expected, `sitemap.xml (${loc})`);
  }
  if (seen.size !== indexableAlternates.size) throw new Error('sitemap.xml is missing indexable pages');
  if (/<lastmod>|<changefreq>|<priority>/.test(sitemap)) throw new Error('sitemap.xml must not include unverified hints');
} else if (robots.includes('Sitemap:') || (await readdir(directory)).includes('sitemap.xml')) {
  throw new Error('A build without SITE_URL must omit its sitemap');
}

const headers = await readFile(join(directory, '_headers'), 'utf8');
if (headers !== checkoutHeaders(base)) throw new Error('Purchase return response headers do not match deployment base');
console.log(`Verified ${checked} static pages, local references, crawler metadata, return privacy and response headers`);
