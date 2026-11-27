import assert from 'node:assert/strict';
import test from 'node:test';
import chinese from '../src/locales/zh-CN.json' with { type: 'json' };
import english from '../src/locales/en.json' with { type: 'json' };
import { baseNodes, faqNode, serializeStructuredData, softwareNode } from '../src/data/structured-data.js';
import { pageUrlFor, robotsText, sitemapXml } from '../src/data/sitemaps.js';

const urls = {
  page: (locale, page) => `https://cleanu.test/${locale}/${page}`,
  asset: (path) => `https://cleanu.test/assets/${path}`,
};

test('page nodes mirror the visible page copy', () => {
  const nodes = baseNodes({ locale: 'zh-CN', page: 'index', translations: chinese, urls });
  assert.deepEqual(nodes.map((node) => node['@type']), ['Organization', 'WebSite', 'WebPage']);
  const webPage = nodes[2];
  assert.equal(webPage.url, 'https://cleanu.test/zh-CN/index');
  assert.equal(webPage.name, chinese.index.title);
  assert.equal(webPage.description, chinese.index.description);
  assert.equal(webPage.inLanguage, 'zh-CN');
});

test('page nodes are omitted without a site URL and on hidden pages', () => {
  assert.deepEqual(baseNodes({ locale: 'en', page: 'index', translations: english, urls: null }), []);
  assert.deepEqual(baseNodes({ locale: 'en', page: 'checkout', translations: english, urls }), []);
  assert.deepEqual(baseNodes({ locale: 'en', page: 'notFound', translations: english, urls }), []);
});

test('software node only publishes visible facts', () => {
  const context = { locale: 'zh-CN', translations: chinese, urls };
  const release = { version: '9.9.9', asset: { name: 'CleanU-9.9.9.dmg' }, published_at: '2026-01-01T00:00:00.000Z', notes: {} };
  const node = softwareNode(context, release);
  assert.equal(node.name, 'CleanU');
  assert.equal(node.operatingSystem, chinese.index.systemRequirement);
  assert.equal(node.description, chinese.common.tagline);
  assert.equal(node.softwareVersion, '9.9.9');
  assert.equal(node.downloadUrl, 'https://cleanu.test/assets/downloads/9.9.9/CleanU-9.9.9.dmg');
  assert.ok(!('offers' in node) && !('aggregateRating' in node));

  const withoutRelease = softwareNode(context, undefined);
  assert.ok(!('softwareVersion' in withoutRelease) && !('downloadUrl' in withoutRelease));
});

test('FAQ node pairs the four visible questions', () => {
  const node = faqNode({ locale: 'en', translations: english, urls });
  assert.equal(node.mainEntity.length, 4);
  assert.equal(node.mainEntity[0].name, english.index.faqStorage);
  assert.equal(node.mainEntity[0].acceptedAnswer.text, english.index.faqStorageBody);
  const deletion = node.mainEntity[2];
  assert.equal(deletion.acceptedAnswer.text, `${english.index.faqDeletionBefore}node_modules${english.index.faqDeletionAfter}`);
});

test('serialized graph escapes markup and stays valid JSON', () => {
  const serialized = serializeStructuredData([{ '@type': 'Thing', name: '</script><b>' }]);
  assert.ok(!serialized.includes('</script>'));
  assert.equal(JSON.parse(serialized)['@graph'][0].name, '</script><b>');
});

test('page URLs mirror locale routing with and without a deployment base', () => {
  const root = pageUrlFor(new URL('https://cleanu.test/'));
  assert.equal(root('zh-CN', 'index'), 'https://cleanu.test/');
  assert.equal(root('en', 'index'), 'https://cleanu.test/en');
  assert.equal(root('zh-CN', 'changelog'), 'https://cleanu.test/changelog');
  assert.equal(root('en', 'terms'), 'https://cleanu.test/en/purchase-terms');

  const subpath = pageUrlFor(new URL('https://cleanu.test/site/'));
  assert.equal(subpath('zh-CN', 'index'), 'https://cleanu.test/site');
  assert.equal(subpath('en', 'index'), 'https://cleanu.test/site/en');
  assert.equal(subpath('en', 'changelog'), 'https://cleanu.test/site/en/changelog');
});

test('sitemap lists both languages of every indexable page', () => {
  const urlFor = pageUrlFor(new URL('https://cleanu.test/site/'));
  const xml = sitemapXml(urlFor);
  assert.equal((xml.match(/<url>/g) ?? []).length, 10);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc);
  assert.deepEqual(locs.sort(), ['index', 'changelog', 'privacy', 'support', 'terms']
    .flatMap((page) => ['zh-CN', 'en'].map((locale) => urlFor(locale, page)))
    .sort());
  assert.ok(!xml.includes('purchase/complete') && !xml.includes('404'));
  assert.equal((xml.match(/hreflang="x-default"/g) ?? []).length, 10);
  assert.ok(!/<lastmod>|<changefreq>|<priority>/.test(xml));
});

test('robots text allows crawling and optionally points at the sitemap', () => {
  assert.equal(robotsText(), 'User-agent: *\nAllow: /\n');
  assert.equal(
    robotsText('https://cleanu.test/site/sitemap.xml'),
    'User-agent: *\nAllow: /\n\nSitemap: https://cleanu.test/site/sitemap.xml\n',
  );
});
