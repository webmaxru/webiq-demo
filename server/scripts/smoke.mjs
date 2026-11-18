import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const baseUrl = process.argv[2];
assert.ok(baseUrl, 'Usage: node server/scripts/smoke.mjs <API base URL>');
const sessionId = randomUUID();

async function commerceFollowUp(endpoint, identifier, params) {
  // The Commerce preview can throttle consecutive calls for 60 seconds.
  console.log(`Waiting 61s before ${endpoint} to respect the Commerce rate limit.`);
  await delay(61_000);
  return request(endpoint, identifier, params);
}

async function request(endpoint, input, params = {}) {
  const response = await fetch(new URL(`/api/search/${endpoint}`, baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webiq-session-id': sessionId,
      'x-webiq-analytics': 'off',
    },
    body: JSON.stringify({ input, params }),
    signal: AbortSignal.timeout(90_000),
  });
  const payload = await response.json();
  console.log(`${endpoint}: HTTP ${response.status}${payload.ok ? '' : ` ${payload.error?.class} ${payload.error?.errorCode ?? ''} ${payload.error?.message ?? ''}`}`);
  return { response, payload };
}

for (const [endpoint, input, params, key] of [
  ['auto', 'What is Microsoft Web IQ?', { maxCitations: 2 }, 'results'],
  ['auto', 'How do web grounding and retrieval augmented generation work together?', { mode: 'advanced', maxCitations: 2 }, 'results'],
  ['weather', 'Current weather and local time in Seattle', {}, 'results'],
  ['places', 'Cafe Flora Seattle', { maxResults: 1 }, 'placeResults'],
  ['web', 'Microsoft Web IQ', { maxResults: 1 }, 'webResults'],
  ['news', 'Microsoft AI', { maxResults: 1 }, 'newsResults'],
  ['images', 'Seattle skyline', { maxResults: 1 }, 'imageResults'],
  ['videos', 'Microsoft Azure tutorial', { maxResults: 1 }, 'videoResults'],
]) {
  const { response, payload } = await request(endpoint, input, params);
  assert.equal(response.status, 200, `${endpoint} failed: ${JSON.stringify(payload.error)}`);
  assert.equal(payload.ok, true);
  assert.ok(Array.isArray(payload.data[key]), `${endpoint} response must include ${key}`);
  assert.ok(payload.data[key].length, `${endpoint} known query returned no results`);
  assert.ok(payload.snippet.includes('client.'), `${endpoint} missing SDK example`);
  if (endpoint === 'auto' || endpoint === 'weather') {
    assert.ok(payload.data.results.every((item) => typeof item.evidence?.type === 'string'), 'Auto evidence type missing');
    assert.ok(payload.data.results.some((item) => item.citations?.length), 'No citations for Auto evidence');
    console.log(`  Evidence: ${payload.data.results.map((item) => item.evidence.type).join(', ')}`);
    if (endpoint === 'weather') {
      assert.ok(payload.data.results.some((item) => item.evidence.type === 'structured/weather'), 'Weather preset did not return structured weather');
    }
  }
}

const browse = await request('browse', 'https://en.wikipedia.org/wiki/Seattle', { query: 'Where is Seattle?', liveCrawl: 'fallback' });
if (browse.response.status === 404) {
  console.warn('::warning::Browse source is unavailable in the upstream index.');
} else {
  assert.equal(browse.payload.ok, true, `Browse failed: ${JSON.stringify(browse.payload.error)}`);
  assert.ok(typeof browse.payload.data.content === 'string' || typeof browse.payload.data.retryAfter === 'string');
}

const scoped = await request('auto', 'Microsoft Web IQ', {
  scopeName: `SandboxMissing-${randomUUID()}`,
  failOnMissingScope: true,
  responseFilter: ['web', 'news'],
});
assert.equal(scoped.payload.ok, false, 'A missing required scope must not silently return unscoped success');
assert.ok([400, 500].includes(scoped.response.status), 'Unexpected required-scope error status');

const commerce = await request('commerce', 'Wireless headphones', { maxResults: 1 });
if (commerce.response.status === 403) {
  console.warn('::warning::Commerce private preview is not enabled for the deployed AppID. The UI shows the upstream access error.');
} else {
  assert.equal(commerce.response.status, 200, `Commerce failed: ${JSON.stringify(commerce.payload.error)}`);
  assert.equal(commerce.payload.ok, true);
  const product = commerce.payload.data.products?.[0];
  if (product) {
    const offer = product.offers?.[0];
    const identifierType = product.id ? 'productId' : product.skuId ? 'skuId' : 'offerId';
    const identifier = product.id ?? product.skuId ?? offer?.id;
    if (identifier) {
      const offers = await commerceFollowUp('commerce-offers', identifier, {
        identifierType,
        productId: product.id,
        skuId: product.skuId,
        offerId: offer?.id,
      });
      assert.equal(offers.payload.ok, true, `Offers failed: ${JSON.stringify(offers.payload.error)}`);
    }
    if (product.id || product.skuId) {
      const details = await commerceFollowUp('commerce-details', product.id ?? product.skuId, {
        identifierType: product.id ? 'productId' : 'skuId',
        skuId: product.skuId,
      });
      assert.equal(details.payload.ok, true, `Details failed: ${JSON.stringify(details.payload.error)}`);
    }
  }
}
console.log('Live Web IQ smoke checks completed.');
