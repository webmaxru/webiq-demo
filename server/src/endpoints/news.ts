import type { EndpointDescriptor } from './types';
import { buildSdkOptions } from './types';

export const newsEndpoint: EndpointDescriptor = {
  id: 'news',
  label: 'News Search',
  description: 'Search current news articles and snippets.',
  kind: 'query',
  inputLabel: 'Query',
  inputPlaceholder: 'Microsoft AI news',
  resultKey: 'newsResults',
  params: [
    { name: 'maxResults', label: 'Max results', type: 'number', default: 5, min: 1, max: 20, step: 1, description: 'Results to return (SDK default 10).' },
    { name: 'language', label: 'Language', type: 'string', placeholder: 'en', description: 'ISO 639-1 language code.' },
    { name: 'region', label: 'Region', type: 'string', placeholder: 'US', description: '2-letter country/region code.' },
    { name: 'location', label: 'Location', type: 'string', placeholder: 'lat:47.6062;long:-122.3321', description: 'Location bias in lat/long format.' },
    { name: 'contentFormat', label: 'Content format', type: 'enum', default: 'markdown', options: ['passage', 'text', 'html', 'markdown'], optionLabels: { passage: 'Passage', text: 'Text', html: 'HTML', markdown: 'Markdown' }, enumImport: 'ContentFormat', description: 'Format for returned content.' },
    { name: 'maxLength', label: 'Max content length', type: 'number', min: 1, max: 500000, step: 1000, description: 'Maximum characters of content (SDK default 10000).' },
  ],
  invoke(client, input, opts, signal) {
    return client.news.search(input, buildSdkOptions(this.params, opts, signal) as any);
  },
};
