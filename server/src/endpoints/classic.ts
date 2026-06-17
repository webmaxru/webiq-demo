import type { EndpointDescriptor } from './types';
import { buildSdkOptions } from './types';

export const classicEndpoint: EndpointDescriptor = {
  id: 'classic',
  label: 'Classic Search',
  description: 'Run classic multi-answer search with selectable answer-type filters.',
  kind: 'query',
  inputLabel: 'Query',
  inputPlaceholder: 'Microsoft Web IQ',
  resultKey: null,
  params: [
    { name: 'maxAnswerTypes', label: 'Max answer types', type: 'number', default: 6, min: 1, max: 6, step: 1, description: 'Answer groups to return.' },
    { name: 'language', label: 'Language', type: 'string', placeholder: 'en', description: 'ISO 639-1 language code.' },
    { name: 'region', label: 'Region', type: 'string', placeholder: 'US', description: '2-letter country/region code.' },
    { name: 'location', label: 'Location', type: 'string', placeholder: 'lat:47.6062;long:-122.3321', description: 'Location bias in lat/long format.' },
    { name: 'maxResultsWeb', label: 'Max web results', type: 'number', default: 5, min: 1, max: 50, step: 1, description: 'Web results to include (SDK default 10).' },
    { name: 'maxLength', label: 'Max content length', type: 'number', min: 1, max: 500000, step: 1000, description: 'Maximum characters of content (SDK default 10000).' },
    { name: 'contentFormat', label: 'Content format', type: 'enum', default: 'markdown', options: ['passage', 'text', 'html', 'markdown'], optionLabels: { passage: 'Passage', text: 'Text', html: 'HTML', markdown: 'Markdown' }, enumImport: 'ContentFormat', description: 'Format for returned content.' },
    { name: 'freshness', label: 'Freshness', type: 'enum', options: ['day', 'week', 'month', 'year'], optionLabels: { day: 'Day', week: 'Week', month: 'Month', year: 'Year' }, description: 'Filter by freshness.' },
    { name: 'responseFilter', label: 'Response filter', type: 'multiEnum', options: ['webResults', 'newsResults', 'imageResults', 'videoResults', 'relatedSearches', 'entities'], optionLabels: { webResults: 'Web results', newsResults: 'News results', imageResults: 'Image results', videoResults: 'Video results', relatedSearches: 'Related searches', entities: 'Entities' }, description: 'Answer types to request.' },
    { name: 'safeSearch', label: 'Safe search', type: 'enum', default: 'moderate', options: ['off', 'moderate', 'strict'], optionLabels: { off: 'Off', moderate: 'Moderate', strict: 'Strict' }, enumImport: 'SafeSearchMode', description: 'Adult-content filtering mode.' },
  ],
  invoke(client, input, opts, signal) {
    return client.classic.search(input, buildSdkOptions(this.params, opts, signal) as any);
  },
};
