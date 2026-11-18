import type { WebSearchOptions } from '@microsoft/webiq';
import type { EndpointDescriptor } from './types';
import { buildSdkOptions } from './types';
import { scopeParams, siteParams } from './shared';

export const webEndpoint: EndpointDescriptor = {
  id: 'web',
  label: 'Web Search',
  description: 'Search webpages and retrieve readable content from the Web IQ web index.',
  kind: 'query',
  inputLabel: 'Query',
  inputPlaceholder: 'TypeScript programming',
  resultKey: 'webResults',
  documentationUrl: 'https://learn.microsoft.com/web-iq/reference/web-search',
  notice: 'Passages are recommended. Full-document text, HTML and Markdown require full document access on the server AppID. Health-aware ranking is automatic; this sandbox is not medical advice.',
  params: [
    { name: 'maxResults', label: 'Max results', type: 'number', default: 5, min: 1, max: 50, step: 1, description: 'Results to return (SDK default 10).' },
    { name: 'language', label: 'Language', type: 'string', placeholder: 'en', description: 'ISO 639-1 language code.' },
    { name: 'region', label: 'Region', type: 'string', placeholder: 'US', description: '2-letter country/region code.' },
    { name: 'location', label: 'Location', type: 'string', placeholder: 'lat:47.6062;long:-122.3321', description: 'Location bias in lat/long format.' },
    { name: 'contentFormat', label: 'Content format', type: 'enum', default: 'passage', options: ['passage', 'text', 'html', 'markdown'], optionLabels: { passage: 'Passage', text: 'Text (full document access)', html: 'HTML (full document access)', markdown: 'Markdown (full document access)' }, enumImport: 'ContentFormat' },
    { name: 'maxLength', label: 'Max content length per result', type: 'number', default: 3000, min: 1, max: 500000, step: 1, description: 'Capped at 3000 without full document access.' },
    { name: 'safeSearch', label: 'Safe search', type: 'enum', default: 'strict', options: ['off', 'strict'], enumImport: 'SafeSearch' },
    ...scopeParams,
    ...siteParams,
  ],
  invoke(client, input, opts, signal) {
    return client.web.search(input, buildSdkOptions(this.params, opts, signal) as WebSearchOptions);
  },
};
