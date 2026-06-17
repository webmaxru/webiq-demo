import type { EndpointDescriptor } from './types';
import { buildSdkOptions } from './types';

export const imagesEndpoint: EndpointDescriptor = {
  id: 'images',
  label: 'Image Search',
  description: 'Search images with visual filters and safe-search controls.',
  kind: 'query',
  inputLabel: 'Query',
  inputPlaceholder: 'Seattle skyline',
  resultKey: 'imageResults',
  params: [
    { name: 'maxResults', label: 'Max results', type: 'number', default: 12, min: 1, max: 30, step: 1, description: 'Images to return (SDK default 30).' },
    { name: 'language', label: 'Language', type: 'string', placeholder: 'en', description: 'ISO 639-1 language code.' },
    { name: 'region', label: 'Region', type: 'string', placeholder: 'US', description: '2-letter country/region code.' },
    { name: 'aspectRatio', label: 'Aspect ratio', type: 'enum', options: ['square', 'wide', 'tall'], optionLabels: { square: 'Square', wide: 'Wide', tall: 'Tall' }, enumImport: 'ImageAspectRatio', description: 'Filter by image aspect ratio.' },
    { name: 'color', label: 'Color', type: 'enum', options: ['colorOnly', 'monochrome'], optionLabels: { colorOnly: 'Color only', monochrome: 'Monochrome' }, enumImport: 'ImageColor', description: 'Filter by color mode.' },
    { name: 'safeSearch', label: 'Safe search', type: 'enum', default: 'strict', options: ['off', 'strict'], optionLabels: { off: 'Off', strict: 'Strict' }, enumImport: 'SafeSearch', description: 'Adult-content filtering mode.' },
    { name: 'imageSize', label: 'Image size', type: 'enum', options: ['small', 'medium', 'large', 'extraLarge'], optionLabels: { small: 'Small', medium: 'Medium', large: 'Large', extraLarge: 'Extra large' }, enumImport: 'ImageSize', description: 'Filter by image size.' },
    { name: 'watermarkFree', label: 'Watermark free', type: 'boolean', description: 'Prefer images without watermarks.' },
    { name: 'maxHeight', label: 'Max height', type: 'number', min: 1, step: 1, description: 'Maximum image height in pixels.' },
    { name: 'minHeight', label: 'Min height', type: 'number', min: 1, step: 1, description: 'Minimum image height in pixels.' },
    { name: 'maxWidth', label: 'Max width', type: 'number', min: 1, step: 1, description: 'Maximum image width in pixels.' },
    { name: 'minWidth', label: 'Min width', type: 'number', min: 1, step: 1, description: 'Minimum image width in pixels.' },
  ],
  invoke(client, input, opts, signal) {
    return client.images.search(input, buildSdkOptions(this.params, opts, signal) as any);
  },
};
