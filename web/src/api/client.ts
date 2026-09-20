import {
  ANALYTICS_OPT_OUT_HEADER,
  ANALYTICS_OPT_OUT_VALUE,
  isAnalyticsOptedOut,
} from '../lib/analyticsConsent';
import type { SearchResponse } from '../types/meta';

export type ParamValue = string | number | boolean | string[];
export type ParamsMap = Record<string, ParamValue>;

function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  return configured ? configured.replace(/\/+$/, '') : '';
}

function apiUrl(pathname: string): string {
  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${pathname}` : pathname;
}

let warmupRequest: Promise<void> | undefined;

export function warmBackend(): Promise<void> {
  warmupRequest ??= fetch(apiUrl('/api/health'), {
    cache: 'no-store',
    keepalive: true,
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Unable to warm the API (${response.status})`);
    }
  });

  return warmupRequest;
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

  const response = await fetch(apiUrl(`/api/search/${encodeURIComponent(endpointId)}`), {
    method: 'POST',
    headers,
    body: JSON.stringify({ input, params }),
    signal,
  });

  return response.json() as Promise<SearchResponse>;
}
