import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { WebIQClient } from '@microsoft/webiq';
import ts from 'typescript';
import { generateSnippet } from '../src/codegen';
import { registry, getDescriptor } from '../src/endpoints/registry';
import { validateAndCoerce } from '../src/validation';

function descriptor(id: string) {
  const result = getDescriptor(id);
  assert.ok(result, `Endpoint ${id} exists`);
  return result;
}

function validated(id: string, input: string, params: Record<string, unknown> = {}) {
  const result = validateAndCoerce(descriptor(id), input, params);
  assert.ok(!('issues' in result), JSON.stringify(result));
  return result;
}

test('real SDK sends Auto mode, named scopes, site lists and filters without dropping them', async () => {
  const request = validated('auto', 'Compare current AI announcements', {
    mode: 'advanced',
    scopeName: 'ProductDocs',
    includeSites: 'learn.microsoft.com, microsoft.com',
    responseFilter: ['web', 'news'],
  });
  let called = false;
  const client = new WebIQClient({
    apiKey: 'test-key-not-a-secret',
    fetchFn: async (url, init) => {
      called = true;
      assert.equal(new URL(String(url)).pathname, '/v3/auto');
      const body = JSON.parse(String(init?.body));
      assert.equal(body.query, request.input);
      assert.equal(body.mode, 'advanced');
      assert.equal(body.scopeName, 'ProductDocs');
      assert.equal(body.failOnMissingScope, true);
      assert.deepEqual(body.includeSites, ['learn.microsoft.com', 'microsoft.com']);
      assert.deepEqual(body.responseFilter, ['web', 'news']);
      assert.equal(body.signal, undefined);
      return Response.json({ results: [] });
    },
  });
  try {
    await descriptor('auto').invoke(client, request.input, request.opts, new AbortController().signal);
    assert.ok(called);
  } finally {
    await client.close();
  }
});

test('weather preset calls Auto with structured weather and timezone categories', async () => {
  const request = validated('weather', 'Weather in Seattle');
  const client = new WebIQClient({
    apiKey: 'test-key-not-a-secret',
    fetchFn: async (url, init) => {
      assert.equal(new URL(String(url)).pathname, '/v3/auto');
      assert.deepEqual(JSON.parse(String(init?.body)).responseFilter, ['weather', 'timezone']);
      return Response.json({ results: [] });
    },
  });
  try {
    await descriptor('weather').invoke(client, request.input, request.opts, new AbortController().signal);
  } finally {
    await client.close();
  }
});

test('passage defaults, Browse selection query and request limits are enforced', () => {
  assert.equal(validated('web', 'test').opts.contentFormat, 'passage');
  assert.equal(validated('news', 'test').opts.maxLength, 3000);
  assert.equal(validated('browse', 'https://example.com').opts.query, 'What is Web IQ?');
  for (const [id, input, params] of [
    ['browse', 'https://example.com', { query: '' }],
    ['browse', 'https://example.com', { query: 'x'.repeat(1001) }],
    ['browse', 'https://example.com', { liveCrawl: 'force' }],
    ['places', 'coffee', { maxResults: 11 }],
    ['auto', 'x'.repeat(1001), {}],
    ['auto', 'test', { maxCitations: 1.5 }],
    ['auto', 'test', { scopeName: 'invalid scope' }],
    ['auto', 'test', { includeSites: Array(251).fill('example.com') }],
    ['commerce', 'test', { region: 'NO' }],
  ] as const) {
    assert.ok('issues' in validateAndCoerce(descriptor(id), input, params), `${id}: ${JSON.stringify(params)}`);
  }
});

test('named scope fallback remains explicit and default is fail-closed', () => {
  for (const id of ['auto', 'web', 'news']) {
    assert.equal(validated(id, 'test', { scopeName: 'ProductDocs' }).opts.failOnMissingScope, true);
    assert.equal(validated(id, 'test', { scopeName: 'ProductDocs', failOnMissingScope: false }).opts.failOnMissingScope, false);
  }
});

test('Commerce identifier lookups use correct SDK methods and do not send UI-only fields', async () => {
  for (const [id, identifierType, apiPath] of [
    ['commerce-offers', 'offerId', 'offers'],
    ['commerce-offers', 'skuId', 'offers'],
    ['commerce-details', 'skuId', 'details'],
    ['commerce-details', 'productId', 'details'],
  ]) {
    const request = validated(id, 'selected-id', { identifierType });
    const client = new WebIQClient({
      apiKey: 'test-key-not-a-secret',
      fetchFn: async (url, init) => {
        assert.equal(new URL(String(url)).pathname, `/v3/fetch/commerce/products/${apiPath}`);
        const body = JSON.parse(String(init?.body));
        assert.equal(body[identifierType], 'selected-id');
        assert.equal(body.identifierType, undefined);
        assert.equal(body.query, undefined);
        return Response.json({ products: [], offers: [] });
      },
    });
    try {
      await descriptor(id).invoke(client, request.input, request.opts, new AbortController().signal);
    } finally {
      await client.close();
    }
  }
});

test('generated snippets typecheck against the installed SDK, including lookup signatures and multiline queries', () => {
  const sources = new Map<string, string>();
  for (const endpoint of registry) {
    const input = endpoint.kind === 'url' ? 'https://example.com' : "Question with 'quotes'\nand a newline";
    const request = validated(endpoint.id, input);
    sources.set(path.resolve(`server/test/generated-${endpoint.id}.ts`), generateSnippet(endpoint, request.input, request.opts));
  }
  const host = ts.createCompilerHost({});
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const source = sources.get(fileName);
    return source === undefined ? originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile) : ts.createSourceFile(fileName, source, languageVersion);
  };
  const program = ts.createProgram([...sources.keys()], {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    types: ['node'],
  }, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, diagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));
});
