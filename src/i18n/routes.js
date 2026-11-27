const pageRoutes = {
  index: '',
  changelog: 'changelog',
  privacy: 'privacy',
  support: 'support',
  checkout: 'purchase/complete',
  terms: 'purchase-terms',
  notFound: '404',
};

export const siteLocales = ['zh-CN', 'en'];
export const pageNames = Object.keys(pageRoutes);

/** Error pages have language navigation but no alternate links in the document head. */
export function hasHreflang(page) {
  return Object.hasOwn(pageRoutes, page) && page !== 'notFound';
}

/** Only localized content pages belong in search metadata and the sitemap. */
export function isIndexablePage(page) {
  return hasHreflang(page) && page !== 'checkout';
}

export function pageRoute(page) {
  if (!Object.hasOwn(pageRoutes, page)) throw new Error(`Unknown site page: ${page}`);
  return pageRoutes[page];
}

export function localizedRoute(locale, page) {
  if (!siteLocales.includes(locale)) throw new Error(`Unsupported site locale: ${locale}`);
  return [locale === 'en' ? 'en' : '', pageRoute(page)].filter(Boolean).join('/');
}

export function normalizeBasePath(base = '/') {
  const path = String(base || '/').trim();
  if (!path.startsWith('/') || path.startsWith('//') || /[?#]/.test(path)) {
    throw new Error(`Invalid site base path: ${base}`);
  }
  return path.replace(/\/+$/, '');
}

export function assetHref(path, base = '/') {
  const assetPath = String(path).replace(/^\/+/, '');
  if (!assetPath || assetPath.split('/').includes('..')) throw new Error(`Invalid site asset path: ${path}`);
  return `${normalizeBasePath(base)}/${assetPath}`;
}
