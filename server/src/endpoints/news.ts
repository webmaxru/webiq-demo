import type { NewsSearchOptions } from '@microsoft/webiq';
import type { EndpointDescriptor } from './types';
import { buildSdkOptions } from './types';
import { scopeParams } from './shared';

export const newsEndpoint: EndpointDescriptor = {
  id: 'news',
  label: 'News Search',
  description: 'Search current news articles and snippets.',
  kind: 'query',
  inputLabel: 'Query',
  inputPlaceholder: 'Microsoft AI news',
  resultKey: 'newsResults',
  documentationUrl: 'https://learn.microsoft.com/web-iq/reference/news-search',
  notice: 'Passages are recommended. Other content formats require full document access. Freshness filters discovery date, not publication date; only the last 30 days of news are available.',
  params: [
    { name: 'maxResults', label: 'Max results', type: 'number', default: 5, min: 1, max: 20, step: 1, description: 'Results to return (SDK default 10).' },
    { name: 'language', label: 'Language', type: 'string', placeholder: 'en', description: 'ISO 639-1 language code.' },
    { name: 'region', label: 'Region', type: 'string', placeholder: 'US', description: '2-letter country/region code.' },
    { name: 'location', label: 'Location', type: 'string', placeholder: 'lat:47.6062;long:-122.3321', description: 'Location bias in lat/long format.' },
    { name: 'contentFormat', label: 'Content format', type: 'enum', default: 'passage', options: ['passage', 'text', 'html', 'markdown'], optionLabels: { passage: 'Passage', text: 'Text (full document access)', html: 'HTML (full document access)', markdown: 'Markdown (full document access)' }, enumImport: 'ContentFormat' },
    { name: 'maxLength', label: 'Max content length per result', type: 'number', default: 3000, min: 1, max: 500000, step: 1, description: 'Capped at 3000 without full document access.' },
    { name: 'freshness', label: 'Discovery date filter', type: 'string', placeholder: 'week or 2026-11-01/2026-11-18', description: 'day, week, month, year or an ISO date/time interval. Use .. for an open boundary. A 12-hour tolerance applies.' },
    ...scopeParams,
  ],
  invoke(client, input, opts, signal) {
    return client.news.search(input, buildSdkOptions(this.params, opts, signal) as NewsSearchOptions);
  },
};
