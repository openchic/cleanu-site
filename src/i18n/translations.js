import { getAbsoluteLocaleUrl, getRelativeLocaleUrl } from 'astro:i18n';
import english from '../locales/en.json';
import chinese from '../locales/zh-CN.json';
import { assetHref as createAssetHref, pageRoute } from './routes.js';

const site = import.meta.env.SITE;

const translationsByLocale = {
  'zh-CN': chinese,
  en: english,
};

const locales = new Set(Object.keys(translationsByLocale));

export { pageRoute };

export function translationsFor(locale) {
  const translations = translationsByLocale[locale];
  if (!translations) throw new Error(`Unsupported site locale: ${locale}`);
  return translations;
}

export function pageHref(page, locale) {
  if (!locales.has(locale)) throw new Error(`Unsupported site locale: ${locale}`);
  return getRelativeLocaleUrl(locale, pageRoute(page));
}

export function assetHref(path) {
  return createAssetHref(path, import.meta.env.BASE_URL);
}

/** Public addresses exist only when the build knows its site URL. */
export function absoluteUrls() {
  if (!site) return null;
  return {
    page: (locale, page) => getAbsoluteLocaleUrl(locale, pageRoute(page)),
    asset: (path) => new URL(assetHref(path), site).href,
  };
}

export function runtimeTranslationsFor(translations) {
  const runtime = { theme: translations.runtime.theme };
  return JSON.stringify(runtime).replace(/</g, '\\u003c');
}
