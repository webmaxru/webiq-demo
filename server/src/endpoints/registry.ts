import type { EndpointDescriptor } from './types';
import { browseEndpoint } from './browse';
import { autoEndpoint, weatherEndpoint } from './auto';
import { commerceEndpoint, offersEndpoint, detailsEndpoint } from './commerce';
import { placesEndpoint } from './places';
import { imagesEndpoint } from './images';
import { newsEndpoint } from './news';
import { videosEndpoint } from './videos';
import { webEndpoint } from './web';

export const registry: EndpointDescriptor[] = [
  autoEndpoint,
  weatherEndpoint,
  placesEndpoint,
  webEndpoint,
  newsEndpoint,
  videosEndpoint,
  imagesEndpoint,
  browseEndpoint,
  commerceEndpoint,
  offersEndpoint,
  detailsEndpoint,
];

export function getDescriptor(id: string): EndpointDescriptor | undefined {
  return registry.find((descriptor) => descriptor.id === id);
}
