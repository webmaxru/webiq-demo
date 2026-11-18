import type { BrowseFetchOptions } from '@microsoft/webiq';
import type { EndpointDescriptor } from './types';
import { buildSdkOptions } from './types';

export const browseEndpoint: EndpointDescriptor = {
  id: 'browse',
  label: 'Browse',
  description: 'Extract query-focused passages from a known URL, with optional live-crawl fallback.',
  kind: 'url',
  inputLabel: 'URL',
  inputPlaceholder: 'https://learn.microsoft.com/web-iq/overview',
  resultKey: null,
  documentationUrl: 'https://learn.microsoft.com/web-iq/reference/browse',
  notice: 'Passage mode requires a selection query. Other formats require full document access. A pending crawl returns retryAfter; retry manually at that time. Fallback does not guarantee a crawl.',
  params: [
    { name: 'query', label: 'Passage selection query', type: 'string', default: 'What is Web IQ?', maxLength: 1000, description: 'Required for passage mode; selects relevant excerpts rather than the beginning of the page.' },
    { name: 'maxLength', label: 'Max content length', type: 'number', default: 3000, min: 1, max: 500000, step: 1, description: 'Capped at 3000 without full document access.' },
    { name: 'liveCrawl', label: 'Live crawl', type: 'enum', default: 'fallback', options: ['none', 'fallback'], enumImport: 'LiveCrawlMode', description: 'Request a crawl if the URL is not indexed.' },
    { name: 'includeWebLinks', label: 'Include web links', type: 'boolean', description: 'Include hyperlinks from the page.' },
    { name: 'renderDynamicPages', label: 'Render dynamic pages', type: 'boolean', description: 'JavaScript rendering; requires liveCrawl=fallback.' },
    { name: 'includeImageLinks', label: 'Include image links', type: 'boolean', description: 'Include image links from the page.' },
    { name: 'language', label: 'Language', type: 'string', placeholder: 'en', description: 'ISO 639-1 language code.' },
    { name: 'region', label: 'Region', type: 'string', placeholder: 'US', description: '2-letter country/region code.' },
    { name: 'contentFormat', label: 'Content format', type: 'enum', default: 'passage', options: ['passage', 'text', 'html', 'markdown'], optionLabels: { passage: 'Passage', text: 'Text (full document access)', html: 'HTML (full document access)', markdown: 'Markdown (full document access)' }, enumImport: 'BrowseContentFormat' },
  ],
  invoke(client, input, opts, signal) {
    return client.browse.fetch(input, buildSdkOptions(this.params, opts, signal) as BrowseFetchOptions);
  },
};
