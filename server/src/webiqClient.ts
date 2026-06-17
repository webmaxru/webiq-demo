import {
  BrowseContentFormat,
  ContentFormat,
  ImageAspectRatio,
  ImageColor,
  ImageSize,
  SafeSearch,
  SafeSearchMode,
  VideoDuration,
  VideoResolution,
  WebIQClient,
} from '@microsoft/webiq';
import { env } from './env';
import { telemetryHook } from './telemetry';

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

let client: WebIQClient | undefined;

export const SDK_ENUMS: Record<string, Record<string, string>> = {
  ContentFormat,
  BrowseContentFormat,
  SafeSearch,
  SafeSearchMode,
  ImageAspectRatio,
  ImageColor,
  ImageSize,
  VideoDuration,
  VideoResolution,
};

export function isKeyConfigured(): boolean {
  return env.keyConfigured;
}

export function getClient(): WebIQClient {
  if (!env.apiKey) {
    throw new ConfigurationError('WEBIQ_API_KEY is not configured. Set it in the root .env file.');
  }

  client ??= new WebIQClient({
    apiKey: env.apiKey,
    timeout: env.timeoutMs,
    telemetryHook,
  });

  return client;
}

export function resolveEnumValue(enumImport: string, value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const enumValues = SDK_ENUMS[enumImport];
  if (!enumValues) {
    return undefined;
  }

  return Object.values(enumValues).includes(value) ? value : undefined;
}

export function enumMemberName(enumImport: string, value: string): string | undefined {
  const enumValues = SDK_ENUMS[enumImport];
  if (!enumValues) {
    return undefined;
  }

  return Object.entries(enumValues).find(([, enumValue]) => enumValue === value)?.[0];
}
