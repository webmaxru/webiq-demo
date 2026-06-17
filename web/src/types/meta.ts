export type ParamType = 'string' | 'number' | 'boolean' | 'enum' | 'multiEnum';

export interface ParamMeta {
  name: string;
  label: string;
  type: ParamType;
  description?: string;
  default?: string | number | boolean | string[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  optionLabels?: Record<string, string>;
  enumImport?: string;
}

export interface EndpointMeta {
  id: string;
  label: string;
  description: string;
  kind: 'query' | 'url';
  inputLabel: string;
  inputPlaceholder: string;
  resultKey: string | null;
  params: ParamMeta[];
}

export interface MetaResponse {
  endpoints: EndpointMeta[];
  keyConfigured: boolean;
  auth: 'apiKey' | 'none';
}

export interface TelemetryInfo {
  elapsedMs: number;
  statusCode?: number;
  traceId?: string;
  requestId?: string;
  attempts?: number;
  retryAfter?: string;
}

export interface SearchSuccess {
  ok: true;
  endpointId: string;
  data: any;
  telemetry: TelemetryInfo;
  snippet: string;
}

export interface ApiErrorInfo {
  class: string;
  statusCode?: number;
  message: string;
  retryAfter?: string;
  errorCode?: string;
  errorCategory?: string;
  technicalDetails?: string;
  traceId?: string;
  body?: unknown;
}

export interface SearchFailure {
  ok: false;
  endpointId: string;
  error: ApiErrorInfo;
  telemetry?: TelemetryInfo;
}

export type SearchResponse = SearchSuccess | SearchFailure;
