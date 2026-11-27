import { downloadPath } from './releases.js';
import { isIndexablePage } from '../i18n/routes.js';

const faqEntries = ['faqStorage', 'faqAccess', 'faqDeletion', 'faqUpload'];

export function baseNodes({ locale, page, translations, urls }) {
  if (!urls || !isIndexablePage(page)) return [];
  const url = urls.page(locale, page);
  const root = urls.page('zh-CN', 'index');
  return [
    {
      '@type': 'Organization',
      '@id': `${root}#organization`,
      name: 'CleanU',
      url: root,
      logo: urls.asset('assets/icon.webp'),
    },
    {
      '@type': 'WebSite',
      '@id': `${root}#website`,
      url: root,
      name: 'CleanU',
      inLanguage: ['zh-CN', 'en'],
      publisher: { '@id': `${root}#organization` },
    },
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: translations[page].title,
      description: translations[page].description,
      inLanguage: locale,
      isPartOf: { '@id': `${root}#website` },
    },
  ];
}

export function softwareNode({ locale, translations, urls }, release) {
  if (!urls) return null;
  const url = urls.page(locale, 'index');
  return {
    '@type': 'SoftwareApplication',
    '@id': `${url}#software`,
    url,
    name: 'CleanU',
    description: translations.common.tagline,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: translations.index.systemRequirement,
    inLanguage: locale,
    screenshot: [urls.asset('assets/shot-idle.webp')],
    publisher: { '@id': `${urls.page('zh-CN', 'index')}#organization` },
    subjectOf: { '@id': `${url}#webpage` },
    ...(release ? { softwareVersion: release.version, downloadUrl: urls.asset(downloadPath(release)) } : {}),
  };
}

export function faqNode({ locale, translations, urls }) {
  if (!urls) return null;
  const url = urls.page(locale, 'index');
  return {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    isPartOf: { '@id': `${url}#webpage` },
    mainEntity: faqEntries.map((key) => ({
      '@type': 'Question',
      name: translations.index[key],
      acceptedAnswer: {
        '@type': 'Answer',
        text: key === 'faqDeletion'
          ? `${translations.index.faqDeletionBefore}node_modules${translations.index.faqDeletionAfter}`
          : translations.index[`${key}Body`],
      },
    })),
  };
}

export function serializeStructuredData(nodes) {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes })
    .replace(/</g, '\\u003c');
}
