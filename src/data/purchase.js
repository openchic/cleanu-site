import { resolveSiteUrl } from '../../scripts/localization.js';
import { localizedRoute, siteLocales } from '../i18n/routes.js';

/** Build a localized checkout from the payment link supplied by the deployment. */
export function checkoutHref(locale, environment = process.env) {
  const { PURCHASE_ENABLED, DODO_PRODUCT_ID, DODO_PAYMENT_LINK, SITE_URL } = environment;
  if (!PURCHASE_ENABLED || PURCHASE_ENABLED === 'false') return null;
  if (PURCHASE_ENABLED !== 'true') throw new Error('PURCHASE_ENABLED must be true or false');
  if (!/^pdt_[A-Za-z0-9_-]{1,124}$/.test(DODO_PRODUCT_ID) || /example|placeholder|change-me/i.test(DODO_PRODUCT_ID)) {
    throw new Error('Invalid DODO_PRODUCT_ID');
  }

  const link = new URL(DODO_PAYMENT_LINK);
  if (link.protocol !== 'https:' || link.username || link.password || link.hash
    || link.pathname.replace(/\/$/, '') !== `/buy/${DODO_PRODUCT_ID}`) {
    throw new Error('DODO_PAYMENT_LINK must be an HTTPS checkout for the configured product');
  }

  const site = resolveSiteUrl(SITE_URL, true, { allowLoopback: true });
  const callback = (language) => new URL(localizedRoute(language, 'checkout'), site).href;
  for (const [key, value] of link.searchParams) {
    if (key === 'quantity' && value === '1') continue;
    if (key === 'redirect_url' && siteLocales.some((language) => callback(language) === value.replace(/\/$/, ''))) continue;
    throw new Error('DODO_PAYMENT_LINK contains unexpected query parameters');
  }
  link.searchParams.set('quantity', '1');
  link.searchParams.set('redirect_url', callback(locale));
  return link.href;
}

export function checkoutHeaders(base = '/') {
  const prefix = base.replace(/\/$/, '');
  return siteLocales.flatMap((locale) => ['', '/', '/*'].map((suffix) =>
    `${prefix}/${localizedRoute(locale, 'checkout')}${suffix}\n  Referrer-Policy: no-referrer\n  X-Robots-Tag: noindex, noarchive\n`
  )).join('\n');
}
