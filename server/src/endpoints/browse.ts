import type { EndpointDescriptor } from './types';
import { buildSdkOptions } from './types';

export const browseEndpoint: EndpointDescriptor = {
  id: 'browse',
  label: 'Browse Fetch',
  description: 'Fetch and transform the content of a specific web page URL.',
  kind: 'url',
  inputLabel: 'URL',
  inputPlaceholder: 'https://www.microsoft.com',
  resultKey: null,
  params: [
    { name: 'maxLength', label: 'Max content length', type: 'number', default: 10000, min: 1, max: 500000, step: 1000, description: 'Maximum characters of content.' },
    { name: 'liveCrawl', label: 'Live crawl', type: 'enum', default: 'none', options: ['none', 'fallback', 'force'], optionLabels: { none: 'None', fallback: 'Fallback', force: 'Force' }, description: 'Whether to use live crawling.' },
    { name: 'includeWebLinks', label: 'Include web links', type: 'boolean', description: 'Include hyperlinks from the page.' },
    { name: 'renderDynamicPages', label: 'Render dynamic pages', type: 'boolean', description: 'Render dynamic JavaScript pages.' },
    { name: 'includeImageLinks', label: 'Include image links', type: 'boolean', description: 'Include image links from the page.' },
    { name: 'language', label: 'Language', type: 'string', placeholder: 'en', description: 'ISO 639-1 language code.' },
    { name: 'region', label: 'Region', type: 'string', placeholder: 'US', description: '2-letter country/region code.' },
    { name: 'contentFormat', label: 'Content format', type: 'enum', default: 'markdown', options: ['text', 'html', 'markdown'], optionLabels: { text: 'Text', html: 'HTML', markdown: 'Markdown' }, enumImport: 'BrowseContentFormat', description: 'Format for returned page content.' },
  ],
  invoke(client, input, opts, signal) {
    return client.browse.fetch(input, buildSdkOptions(this.params, opts, signal) as any);
  },
};
