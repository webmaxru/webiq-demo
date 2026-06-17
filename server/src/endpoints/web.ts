import type { EndpointDescriptor } from './types';
import { buildSdkOptions } from './types';

export const webEndpoint: EndpointDescriptor = {
  id: 'web',
  label: 'Web Search',
  description: 'Search webpages and retrieve readable content from the Web IQ web index.',
  kind: 'query',
  inputLabel: 'Query',
  inputPlaceholder: 'TypeScript programming',
  resultKey: 'webResults',
  params: [
    { name: 'maxResults', label: 'Max results', type: 'number', default: 5, min: 1, max: 50, step: 1, description: 'Results to return (SDK default 10).' },
    { name: 'language', label: 'Language', type: 'string', placeholder: 'en', description: 'ISO 639-1 language code.' },
    { name: 'region', label: 'Region', type: 'string', placeholder: 'US', description: '2-letter country/region code.' },
    { name: 'location', label: 'Location', type: 'string', placeholder: 'lat:47.6062;long:-122.3321', description: 'Location bias in lat/long format.' },
    { name: 'contentFormat', label: 'Content format', type: 'enum', default: 'markdown', options: ['passage', 'text', 'html', 'markdown'], optionLabels: { passage: 'Passage', text: 'Text', html: 'HTML', markdown: 'Markdown' }, enumImport: 'ContentFormat', description: 'Format for returned content.' },
    { name: 'maxLength', label: 'Max content length', type: 'number', min: 1, max: 500000, step: 1000, description: 'Maximum characters of content (SDK default 10000).' },
  ],
  invoke(client, input, opts, signal) {
    return client.web.search(input, buildSdkOptions(this.params, opts, signal) as any);
  },
};
