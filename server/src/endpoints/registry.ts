import type { EndpointDescriptor } from './types';
import { browseEndpoint } from './browse';
import { classicEndpoint } from './classic';
import { imagesEndpoint } from './images';
import { newsEndpoint } from './news';
import { videosEndpoint } from './videos';
import { webEndpoint } from './web';

export const registry: EndpointDescriptor[] = [
  webEndpoint,
  newsEndpoint,
  videosEndpoint,
  imagesEndpoint,
  browseEndpoint,
  classicEndpoint,
];

export function getDescriptor(id: string): EndpointDescriptor | undefined {
  return registry.find((descriptor) => descriptor.id === id);
}
