import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { checkoutHeaders, checkoutHref } from '../src/data/purchase.js';

const environment = {
  PURCHASE_ENABLED: 'true',
  DODO_PRODUCT_ID: 'pdt_fixture',
  DODO_PAYMENT_LINK: 'https://checkout.fixture.test/buy/pdt_fixture',
  SITE_URL: 'https://youngluo.github.io/',
};

test('privacy copy discloses automatic verification without exposing check timing', async () => {
  const checkTiming = /七天|7\s*天|seven days|7 days|每日|daily|24\s*(小时|hours)/i;
  for (const locale of ['zh-CN', 'en']) {
    const copy = JSON.parse(await readFile(new URL(`../src/locales/${locale}.json`, import.meta.url), 'utf8'));
    assert.doesNotMatch(JSON.stringify(copy.index), checkTiming);
    assert.doesNotMatch(JSON.stringify(copy.terms), checkTiming);
    assert.doesNotMatch(JSON.stringify(copy.privacy), checkTiming);
    assert.match(copy.privacy.licenseBody, /定期自动联网验证|automatic online license checks at regular intervals/i);
  }
});

test('purchases default closed and require complete inputs when enabled', () => {
  assert.equal(checkoutHref('en', {}), null);
  assert.equal(checkoutHref('en', { PURCHASE_ENABLED: 'false' }), null);
  assert.throws(() => checkoutHref('en', { PURCHASE_ENABLED: 'yes' }), /true or false/);
  for (const key of ['DODO_PRODUCT_ID', 'DODO_PAYMENT_LINK', 'SITE_URL']) {
    assert.throws(() => checkoutHref('en', { ...environment, [key]: '' }));
  }
});

test('missing-email guidance has official entry points and trial copy matches explicit opt-in', async () => {
  const support = await readFile(new URL('../src/components/PurchaseSupportLinks/index.astro', import.meta.url), 'utf8');
  assert.match(support, /https:\/\/customer\.dodopayments\.com\//);
  assert.match(support, /https:\/\/dodopayments\.com\/contact/);
  assert.doesNotMatch(support, /mailto:|license_key|email=/);
  const checkout = await readFile(new URL('../src/components/CheckoutPage/index.astro', import.meta.url), 'utf8');
  assert.match(checkout, /<PurchaseSupportLinks/);
  const supportPage = await readFile(new URL('../src/components/SupportPage/index.astro', import.meta.url), 'utf8');
  assert.match(supportPage, /https:\/\/customer\.dodopayments\.com\//);
  assert.match(supportPage, /translations\.support\.officialEmail/);
  const termsPage = await readFile(new URL('../src/components/PurchaseTermsPage/index.astro', import.meta.url), 'utf8');
  assert.match(termsPage, /pageHref\('support'/);
  for (const locale of ['zh-CN', 'en']) {
    const copy = JSON.parse(await readFile(new URL(`../src/locales/${locale}.json`, import.meta.url), 'utf8'));
    assert.match(copy.terms.trialBody, /点击|click/i);
    assert.doesNotMatch(copy.terms.trialBody, /首次运行|first saves/);
    assert.match(copy.support.purchaseBodyAfterPortal, /无法登录|cannot sign in/);
    assert.ok(copy.support.contactLink && copy.support.portalLink);
  }
});

test('checkout support is hosted by Dodo and the official email stays on the support page', async () => {
  const checkout = await readFile(new URL('../src/components/CheckoutPage/index.astro', import.meta.url), 'utf8');
  assert.doesNotMatch(checkout, /mailto:/);
  for (const locale of ['zh-CN', 'en']) {
    const copy = JSON.parse(await readFile(new URL(`../src/locales/${locale}.json`, import.meta.url), 'utf8'));
    assert.match(copy.support.officialEmail, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  }
  const supportPage = await readFile(new URL('../src/components/SupportPage/index.astro', import.meta.url), 'utf8');
  assert.match(supportPage, /translations\.support\.officialEmail/);
  const workflow = await readFile(new URL('../.github/workflows/publish.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(workflow, /PURCHASE_SUPPORT_EMAIL/);
});

test('checkout uses the configured link and localized return route on every deployment', () => {
  for (const SITE_URL of ['https://youngluo.github.io/', 'https://youngluo.github.io/site/', 'http://localhost:4321/site/']) {
    for (const host of ['checkout.fixture.test', 'sandbox.fixture.test']) {
      const DODO_PAYMENT_LINK = `https://${host}/buy/pdt_fixture?quantity=1`;
      for (const locale of ['zh-CN', 'en']) {
        const link = new URL(checkoutHref(locale, { ...environment, SITE_URL, DODO_PAYMENT_LINK }));
        assert.equal(link.origin, `https://${host}`);
        assert.equal(link.pathname, '/buy/pdt_fixture');
        assert.deepEqual([...link.searchParams], [
          ['quantity', '1'],
          ['redirect_url', `${SITE_URL}${locale === 'en' ? 'en/' : ''}purchase/complete`],
        ]);
      }
    }
  }
});

test('checkout accepts an existing localized callback including the old trailing slash', () => {
  const previous = new URL(environment.DODO_PAYMENT_LINK);
  previous.searchParams.set('redirect_url', new URL('purchase/complete/', environment.SITE_URL).href);
  const link = new URL(checkoutHref('en', { ...environment, DODO_PAYMENT_LINK: previous.href }));
  assert.equal(link.searchParams.get('redirect_url'), new URL('en/purchase/complete', environment.SITE_URL).href);
});

test('checkout rejects malformed links, wrong products and unexpected parameters', () => {
  for (const DODO_PAYMENT_LINK of [
    'http://checkout.fixture.test/buy/pdt_fixture',
    'https://user@checkout.fixture.test/buy/pdt_fixture',
    'https://checkout.fixture.test/buy/pdt_other',
    ...['?quantity=2', '?email=private', '?redirect_url=https://elsewhere.invalid/', '#secret']
      .map((suffix) => environment.DODO_PAYMENT_LINK + suffix),
  ]) assert.throws(() => checkoutHref('en', { ...environment, DODO_PAYMENT_LINK }));
  assert.throws(() => checkoutHref('en', { ...environment, DODO_PRODUCT_ID: 'pdt_example' }), /DODO_PRODUCT_ID/);
  assert.throws(() => checkoutHref('fr', environment), /Unsupported site locale/);
});

test('return initialization keeps only a status enum, clears query, fragment and history state', async () => {
  const source = await readFile(new URL('../src/layouts/SiteLayout.astro', import.meta.url), 'utf8');
  const script = [...source.matchAll(/<script is:inline>([\s\S]*?)<\/script>/g)].map((match) => match[1])
    .find((value) => value.includes('URLSearchParams'));
  for (const status of ['succeeded', 'processing', 'failed', 'cancelled', 'unknown', '<script>alert(1)</script>', '']) {
    const dataset = {};
    const historyCalls = [];
    vm.runInNewContext(script, {
      URLSearchParams, document: { documentElement: { dataset } },
      location: { pathname: '/en/purchase/complete/', search: `?status=${encodeURIComponent(status)}&email=private%40example.com&license_key=SECRET&payment_id=ORDER`, hash: '#SECRET' },
      history: { replaceState: (...args) => historyCalls.push(args) },
    });
    assert.equal(dataset.checkoutStatus, ['succeeded', 'processing', 'failed', 'cancelled'].includes(status) ? status : 'unknown');
    assert.deepEqual(historyCalls, [[null, '', '/en/purchase/complete/']]);
    assert.equal(JSON.stringify(dataset).includes('SECRET'), false);
  }
  assert.ok(source.indexOf('URLSearchParams') < source.indexOf('<link rel="icon"'));
  assert.match(source, /name="referrer" content="no-referrer"/);
});

test('Cloudflare response rules cover both languages including deployment subpaths', () => {
  for (const base of ['/', '/cleanu-site/']) {
    const headers = checkoutHeaders(base);
    for (const path of ['purchase/complete', 'en/purchase/complete']) {
      assert.ok(headers.includes(`${base}${path}/\n`));
      assert.ok(headers.includes(`${base}${path}/*\n`));
    }
    assert.equal((headers.match(/Referrer-Policy: no-referrer/g) || []).length, 6);
  }
});
