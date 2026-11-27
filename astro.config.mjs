import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'astro/config';
import { isLoopbackHost, resolveSiteUrl, validateTranslations } from './scripts/localization.js';
import { siteLocales as locales } from './src/i18n/routes.js';
import { checkoutHeaders } from './src/data/purchase.js';
import { pageUrlFor, robotsText, sitemapXml } from './src/data/sitemaps.js';

const root = import.meta.dirname;
const requireSiteUrl = process.env.REQUIRE_SITE_URL === 'true';
const siteUrl = resolveSiteUrl(process.env.SITE_URL, requireSiteUrl, { allowLoopback: !requireSiteUrl });
const publicSite = siteUrl && !isLoopbackHost(siteUrl.hostname) ? siteUrl : null;
const translationsByLocale = Object.fromEntries(await Promise.all(locales.map(async (locale) => {
  const file = resolve(root, 'src/locales', `${locale}.json`);
  return [locale, JSON.parse(await readFile(file, 'utf8'))];
})));
validateTranslations(translationsByLocale);

const base = siteUrl ? siteUrl.pathname.replace(/\/+$/, '') || '/' : '/';
const urlFor = publicSite ? pageUrlFor(publicSite) : null;

export default defineConfig({
  site: publicSite ? `${publicSite.origin}/` : undefined,
  base,
  i18n: {
    defaultLocale: 'zh-CN',
    locales,
    routing: { prefixDefaultLocale: false },
  },
  trailingSlash: 'never',
  output: 'static',
  devToolbar: { enabled: false },
  outDir: './dist',
  build: { format: 'file' },
  integrations: [{
    name: 'static-site-files',
    hooks: {
      'astro:config:setup': ({ command }) => {
        if (command === 'build' && siteUrl && !publicSite) {
          throw new Error('SITE_URL must be a public HTTPS URL for a static build');
        }
      },
      'astro:build:done': async ({ dir }) => {
        await writeFile(new URL('_headers', dir), checkoutHeaders(base));
        await writeFile(new URL('robots.txt', dir), robotsText(publicSite && new URL('sitemap.xml', publicSite).href));
        if (urlFor) await writeFile(new URL('sitemap.xml', dir), sitemapXml(urlFor));
      },
    },
  }],
});
