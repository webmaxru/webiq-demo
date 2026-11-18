import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AutoResults } from '../../web/src/components/results/AutoResults';
import { CommerceResults, commercePrice } from '../../web/src/components/results/CommerceResults';
import { PlaceResults } from '../../web/src/components/results/PlaceResults';
import { ResultsPanel } from '../../web/src/components/ResultsPanel';
import { toMeta } from '../src/endpoints/types';
import { webEndpoint } from '../src/endpoints/web';

test('Auto renders per-evidence citations, zero temperatures, returned units and alerts', () => {
  const html = renderToStaticMarkup(createElement(AutoResults, { data: {
    results: [
      { evidence: { type: 'text', content: 'Grounded passage' }, citations: [{ title: 'Source one', url: 'https://example.com/one' }] },
      {
        evidence: { type: 'structured/weather', content: {
          location: 'Oslo',
          units: { temperature: 'C' },
          currentWeather: { temperature: 0 },
          alerts: [{ name: 'Frost', issuingAuthority: 'Weather Authority', url: 'https://example.com/alert' }],
        } },
        citations: [{ title: 'Weather source', url: 'https://example.com/weather' }],
      },
      { evidence: { type: 'structured/timeZone', content: { timeZones: [{ utcOffset: 5.5, localTime: 'Wednesday, 2026-11-18T10:00:00+05:30' }] } } },
    ],
  } }));
  assert.match(html, /Grounded passage/);
  assert.match(html, /href="https:\/\/example.com\/one"/);
  assert.match(html, />0 C</);
  assert.match(html, /Weather Authority/);
  assert.match(html, /5\.5/);
  assert.match(html, /Wednesday, 2026/);
  assert.doesNotMatch(html, /Feels like 0/);
});

test('Commerce preserves exact clickUrl attribution, suppresses offers without it and handles currency minor units', () => {
  const clickUrl = 'https://example.com/redirect?attribution=a%2Fb&item=12';
  const html = renderToStaticMarkup(createElement(CommerceResults, { data: { offers: [
    { name: 'Eligible headphones', clickUrl, displayUrl: 'https://merchant.example/item', price: { offeredPrice: 12345, currency: 'USD' } },
    { name: 'Missing click URL', displayUrl: 'https://merchant.example/hidden' },
    { name: 'Unsafe click URL', clickUrl: 'javascript:alert(1)' },
  ] } }));
  assert.match(html, /href="https:\/\/example.com\/redirect\?attribution=a%2Fb&amp;item=12"/);
  assert.doesNotMatch(html, /href="https:\/\/merchant/);
  assert.doesNotMatch(html, /Missing click URL|Unsafe click URL/);
  assert.match(html, /\$123\.45/);
  assert.equal(commercePrice({ offeredPrice: 0, currency: 'USD' }), '$0.00');
  assert.equal(commercePrice({ offeredPrice: 1000, currency: 'JPY' }), '¥1,000');
  assert.equal(commercePrice({ offeredPrice: 1234, currency: 'KWD' }), 'KWD\u00a01.234');
});

test('Places handles missing optional lists and preserves provider attribution and hours', () => {
  const html = renderToStaticMarkup(createElement(PlaceResults, { data: { placeResults: [
    { name: 'Cafe', openHours: { standard: { mon: ['09:00-17:00'] } }, reviews: [{ ratingScore: 4.5, providerName: 'Review source', providerUrl: 'https://example.com/review' }] },
    { name: 'Sparse place' },
  ] } }));
  assert.match(html, /09:00-17:00/);
  assert.match(html, /Review source/);
  assert.match(html, /Sparse place/);
  assert.doesNotMatch(html, /undefined|null/);
});

test('scope fallback is visibly flagged and Web links preserve the attributed click destination', () => {
  const html = renderToStaticMarkup(createElement(ResultsPanel, {
    endpoint: toMeta(webEndpoint),
    response: {
      ok: true,
      endpointId: 'web',
      telemetry: { elapsedMs: 1 },
      snippet: '',
      data: {
        scopeApplied: false,
        webResults: [{ title: 'Source', url: 'https://example.com/original', clickUrl: 'https://example.com/click?id=a%2Fb', content: 'Passage' }],
      },
    },
  }));
  assert.match(html, /scope was NOT applied/);
  assert.match(html, /href="https:\/\/example.com\/click\?id=a%2Fb"/);
  assert.doesNotMatch(html, /href="https:\/\/example.com\/original"/);
});
