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
  const response = await fetch(`/api/search/${encodeURIComponent(endpointId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input, params }),
    signal,
  });

  return response.json() as Promise<SearchResponse>;
}
