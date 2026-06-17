import type { EndpointDescriptor } from './types';
import { buildSdkOptions } from './types';

export const videosEndpoint: EndpointDescriptor = {
  id: 'videos',
  label: 'Video Search',
  description: 'Search videos, optional playlists, thumbnails, and metadata.',
  kind: 'query',
  inputLabel: 'Query',
  inputPlaceholder: 'Azure developer tutorial',
  resultKey: 'videoResults',
  params: [
    { name: 'maxResults', label: 'Max results', type: 'number', default: 10, min: 1, max: 30, step: 1, description: 'Videos to return (SDK default 30).' },
    { name: 'language', label: 'Language', type: 'string', placeholder: 'en', description: 'ISO 639-1 language code.' },
    { name: 'region', label: 'Region', type: 'string', placeholder: 'US', description: '2-letter country/region code.' },
    { name: 'enablePlaylist', label: 'Enable playlists', type: 'boolean', default: false, description: 'Include playlist results when available.' },
    { name: 'freshness', label: 'Freshness', type: 'enum', options: ['day', 'week', 'month', 'year'], optionLabels: { day: 'Day', week: 'Week', month: 'Month', year: 'Year' }, description: 'Filter by published freshness.' },
    { name: 'embeddable', label: 'Embeddable', type: 'multiEnum', options: ['player'], optionLabels: { player: 'Player' }, description: 'Return videos with embeddable player support.' },
    { name: 'resolution', label: 'Resolution', type: 'enum', options: ['360p', '480p', '720p', '1080p'], optionLabels: { '360p': '360p', '480p': '480p', '720p': '720p', '1080p': '1080p' }, enumImport: 'VideoResolution', description: 'Preferred video resolution.' },
    { name: 'safeSearch', label: 'Safe search', type: 'enum', default: 'strict', options: ['off', 'strict'], optionLabels: { off: 'Off', strict: 'Strict' }, enumImport: 'SafeSearch', description: 'Adult-content filtering mode.' },
    { name: 'duration', label: 'Duration', type: 'enum', options: ['short', 'medium', 'long'], optionLabels: { short: 'Short', medium: 'Medium', long: 'Long' }, enumImport: 'VideoDuration', description: 'Filter by video length.' },
  ],
  invoke(client, input, opts, signal) {
    return client.videos.search(input, buildSdkOptions(this.params, opts, signal) as any);
  },
};
