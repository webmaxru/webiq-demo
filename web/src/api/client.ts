import {
  ANALYTICS_OPT_OUT_HEADER,
  ANALYTICS_OPT_OUT_VALUE,
  isAnalyticsOptedOut,
} from '../lib/analyticsConsent';
import type { MetaResponse, SearchResponse } from '../types/meta';

export type ParamValue = string | number | boolean | string[];
export type ParamsMap = Record<string, ParamValue>;

export async function getMeta(): Promise<MetaResponse> {
  const response = await fetch('/api/meta');

  if (!response.ok) {
    throw new Error(`Unable to load API metadata (${response.status})`);
  }

  return response.json() as Promise<MetaResponse>;
}

export async function runSearch(
  endpointId: string,
  input: string,
  params: ParamsMap,
  signal: AbortSignal,
): Promise<SearchResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Honour the visitor's opt-out so the server suppresses usage telemetry.
  if (isAnalyticsOptedOut()) {
    headers[ANALYTICS_OPT_OUT_HEADER] = ANALYTICS_OPT_OUT_VALUE;
  }

  const response = await fetch(`/api/search/${encodeURIComponent(endpointId)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input, params }),
    signal,
  });

  return response.json() as Promise<SearchResponse>;
}
