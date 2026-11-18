import type { AutoSearchOptions } from '@microsoft/webiq';
import type { EndpointDescriptor } from './types';
import { buildSdkOptions } from './types';
import { localeParams, scopeParams, siteParams } from './shared';

export const autoEndpoint: EndpointDescriptor = {
  id: 'auto',
  label: 'Auto',
  description: 'Start here: one natural-language question returns typed evidence with citations. Choose Advanced for iterative, multi-document retrieval.',
  kind: 'query',
  inputLabel: 'Question',
  inputPlaceholder: 'What is the weather in Seattle this weekend and what is the latest news about Pike Place Market?',
  resultKey: 'results',
  documentationUrl: 'https://learn.microsoft.com/web-iq/reference/auto',
  notice: 'Auto costs $8 per 1,000 calls; Advanced $9. Named scopes filter only Web and News, not weather or other evidence. Use the Web/News response filter when all evidence must be scoped.',
  params: [
    { name: 'mode', label: 'Retrieval mode', type: 'enum', default: 'lite', options: ['lite', 'advanced'], optionLabels: { lite: 'Auto - fast', advanced: 'Auto Advanced - comprehensive' }, enumImport: 'AutoMode', description: 'Advanced performs additional retrieval passes; it can take longer. Auto does not choose this mode automatically.' },
    { name: 'maxResponseLength', label: 'Max web content length', type: 'number', default: 30000, min: 1500, max: 500000, step: 500, description: 'Web content budget, not total response length. Capped at 30000 without full document access.' },
    { name: 'maxCitations', label: 'Max web citations', type: 'number', default: 10, min: 1, max: 50, step: 1 },
    { name: 'responseFilter', label: 'Eligible evidence types', type: 'multiEnum', options: ['web', 'news', 'timezone', 'weather', 'images', 'videos'], description: 'Leave empty to let Auto choose. These request categories differ from response evidence type names.' },
    ...localeParams,
    ...scopeParams,
    ...siteParams,
  ],
  invoke(client, input, opts, signal) {
    return client.auto.search(input, buildSdkOptions(this.params, opts, signal) as AutoSearchOptions);
  },
};

export const weatherEndpoint: EndpointDescriptor = {
  ...autoEndpoint,
  id: 'weather',
  label: 'Weather & Time Zones',
  sdkMethod: 'auto.search',
  description: 'Structured current conditions, forecasts, weather alerts and local times through Auto. Measurements retain their returned units and source citations.',
  inputPlaceholder: 'What is the weather forecast for Seattle tomorrow and what time is it there?',
  notice: 'Powered by Auto, not a separate Weather API. Fields are optional; missing measurements are unavailable, not zero. Weather alerts include the issuing authority when supplied.',
  params: autoEndpoint.params.filter((param) => !['scopeName', 'failOnMissingScope', 'includeSites', 'excludeSites'].includes(param.name))
    .map((param) => param.name === 'responseFilter' ? { ...param, default: ['weather', 'timezone'] } : param),
};
