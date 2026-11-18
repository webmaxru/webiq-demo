import type { CommerceSearchOptions } from '@microsoft/webiq';
import type { EndpointDescriptor } from './types';
import { buildSdkOptions } from './types';
import { localeParams } from './shared';

const notice = 'Private preview: the server AppID must be enabled for Commerce. Use identifiers from a live Commerce Search response. Supported markets: en-US, es-US, en-CA, fr-CA, en-GB, de-DE, fr-FR, en-AU, ja-JP. Offers without a usable clickUrl are not displayed.';
const documentationUrl = 'https://learn.microsoft.com/web-iq/reference/commerce';

export const commerceEndpoint: EndpointDescriptor = {
  id: 'commerce',
  label: 'Commerce Search (preview)',
  description: 'Search ranked products and compare merchant offers, prices, images and shipping.',
  kind: 'query',
  inputLabel: 'Shopping query',
  inputPlaceholder: 'Wireless noise cancelling headphones',
  resultKey: 'products',
  notice,
  documentationUrl,
  params: [
    { name: 'maxResults', label: 'Max products', type: 'number', default: 5, min: 1, max: 50, step: 1 },
    ...localeParams,
  ],
  invoke(client, input, opts, signal) {
    return client.commerce.search(input, buildSdkOptions(this.params, opts, signal) as CommerceSearchOptions);
  },
};

export function commerceIdentifier(input: string, opts: Record<string, unknown>) {
  if (opts.identifierType === 'skuId') {
    return { skuId: input };
  }
  if (opts.identifierType === 'offerId') {
    return { offerId: input };
  }
  return { productId: input };
}

export const offersEndpoint: EndpointDescriptor = {
  ...commerceEndpoint,
  id: 'commerce-offers',
  label: 'Commerce Offers (preview)',
  description: 'Look up eligible buying options for a product, SKU or representative offer.',
  inputLabel: 'Identifier from Commerce Search',
  inputPlaceholder: '',
  resultKey: 'offers',
  sdkMethod: 'commerce.fetchOffers',
  lookup: 'offers',
  params: [
    { name: 'identifierType', label: 'Identifier type', type: 'enum', default: 'productId', options: ['productId', 'skuId', 'offerId'] },
    { name: 'productId', label: 'Additional product ID', type: 'string', maxLength: 1000, description: 'Send all available IDs; the primary identifier takes precedence.' },
    { name: 'skuId', label: 'Additional SKU ID', type: 'string', maxLength: 1000 },
    { name: 'offerId', label: 'Additional offer ID', type: 'string', maxLength: 1000 },
    ...localeParams,
  ],
  invoke(client, input, opts, signal) {
    const { identifierType: _identifierType, ...options } = buildSdkOptions(this.params, opts, signal);
    return client.commerce.fetchOffers({ ...options, ...commerceIdentifier(input, opts) });
  },
};

export const detailsEndpoint: EndpointDescriptor = {
  ...offersEndpoint,
  id: 'commerce-details',
  label: 'Product Details (preview)',
  description: 'Retrieve a product title, description and aggregate rating by product or SKU ID.',
  resultKey: 'products',
  sdkMethod: 'commerce.fetchDetails',
  lookup: 'details',
  params: offersEndpoint.params.filter((param) => !['location', 'offerId'].includes(param.name))
    .map((param) => param.name === 'identifierType' ? { ...param, options: ['productId', 'skuId'] } : param),
  invoke(client, input, opts, signal) {
    const { identifierType: _identifierType, ...options } = buildSdkOptions(this.params, opts, signal);
    const identifier = opts.identifierType === 'skuId' ? { skuId: input } : { productId: input };
    return client.commerce.fetchDetails({ ...options, ...identifier });
  },
};
