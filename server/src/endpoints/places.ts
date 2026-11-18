import type { PlacesSearchOptions } from '@microsoft/webiq';
import type { EndpointDescriptor } from './types';
import { buildSdkOptions } from './types';
import { localeParams } from './shared';

export const placesEndpoint: EndpointDescriptor = {
  id: 'places',
  label: 'Places',
  description: 'Find local businesses and places with addresses, hours, reviews, photos, amenities and actions.',
  kind: 'query',
  inputLabel: 'Place query',
  inputPlaceholder: 'Vegetarian restaurants in Seattle',
  resultKey: 'placeResults',
  documentationUrl: 'https://learn.microsoft.com/web-iq/reference/places',
  params: [
    { name: 'maxResults', label: 'Max results', type: 'number', default: 5, min: 1, max: 10, step: 1 },
    ...localeParams,
  ],
  invoke(client, input, opts, signal) {
    return client.places.search(input, buildSdkOptions(this.params, opts, signal) as PlacesSearchOptions);
  },
};
