import type { ParamDescriptor } from './types';

export const localeParams: ParamDescriptor[] = [
  { name: 'language', label: 'Language', type: 'string', placeholder: 'en', description: 'Two-letter ISO 639-1 code.' },
  { name: 'region', label: 'Region', type: 'string', placeholder: 'US', description: 'Two-letter country/region code.' },
  { name: 'location', label: 'Location', type: 'string', placeholder: 'lat:47.6062;long:-122.3321', description: 'Optional geographic context.' },
];

export const scopeParams: ParamDescriptor[] = [
  { name: 'scopeName', label: 'Named scope', type: 'string', maxLength: 128, placeholder: 'ProductDocs', description: 'Existing scope in this demo AppID billing account. Create and publish it in the Web IQ portal; propagation can take 10-30 minutes.' },
  { name: 'failOnMissingScope', label: 'Require scope', type: 'boolean', default: true, description: 'Fail rather than return unscoped results when the named scope cannot be applied. Has no effect without a scope name.' },
];

export const siteParams: ParamDescriptor[] = [
  { name: 'includeSites', label: 'Include sites', type: 'stringList', placeholder: 'learn.microsoft.com, microsoft.com', description: 'Comma-separated domains or paths; max 250. Paths are limited to two segments. Prefer named scopes for long lists.' },
  { name: 'excludeSites', label: 'Exclude sites', type: 'stringList', placeholder: 'example.com', description: 'Comma-separated domains or paths; max 250. Exclusions take precedence.' },
];
