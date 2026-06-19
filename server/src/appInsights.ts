// Azure Application Insights bootstrap.
//
// This module MUST be imported before express/http (see index.ts) so the SDK's
// auto-instrumentation can patch the HTTP layer. It is a no-op when
// APPLICATIONINSIGHTS_CONNECTION_STRING is not set, so local development without
// an App Insights resource keeps working unchanged.
//
// We import './env' first purely for its dotenv side effect, so the connection
// string can also come from the root .env file during local development. In the
// Container App it arrives as a real environment variable.
import './env';
import { createHash } from 'node:crypto';
import * as appInsights from 'applicationinsights';
import type { TelemetryClient } from 'applicationinsights';
import type { Request } from 'express';

const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING?.trim();

export const appInsightsEnabled = Boolean(connectionString);

// cloud_RoleName used by the engagement workbook / KQL to scope telemetry.
const CLOUD_ROLE = 'webiq-demo-server';

// Salt for the anonymised visitor id. Override via env to rotate the hash.
const ANON_SALT = process.env.WEBIQ_ANON_SALT?.trim() || 'webiq-demo-anon';

let client: TelemetryClient | undefined;

if (appInsightsEnabled) {
  appInsights
    .setup(connectionString)
    .setAutoCollectRequests(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectConsole(false)
    .setSendLiveMetrics(false)
    .start();

  client = appInsights.defaultClient;
  client.context.tags[client.context.keys.cloudRole] = CLOUD_ROLE;

  console.log(`[appInsights] telemetry enabled (cloudRole=${CLOUD_ROLE})`);
} else {
  console.log('[appInsights] disabled — APPLICATIONINSIGHTS_CONNECTION_STRING not set');
}

type TelemetryProps = Record<string, string | number | boolean | undefined>;

function cleanProps(props?: TelemetryProps): Record<string, string> | undefined {
  if (!props) {
    return undefined;
  }

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined && value !== null && value !== '') {
      out[key] = String(value);
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/** Send a custom event to the `customEvents` table (no-op if telemetry disabled). */
export function trackEvent(
  name: string,
  properties?: TelemetryProps,
  measurements?: Record<string, number>,
): void {
  client?.trackEvent({ name, properties: cleanProps(properties), measurements });
}

/** Send a custom metric to the `customMetrics` table (no-op if telemetry disabled). */
export function trackMetric(name: string, value: number, properties?: TelemetryProps): void {
  client?.trackMetric({ name, value, properties: cleanProps(properties) });
}

/** Send an exception to the `exceptions` table (no-op if telemetry disabled). */
export function trackException(error: unknown, properties?: TelemetryProps): void {
  if (!client) {
    return;
  }

  const exception =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : JSON.stringify(error));

  client.trackException({ exception, properties: cleanProps(properties) });
}

/** Best-effort client IP, honouring the Container Apps `x-forwarded-for` header. */
export function clientIp(req: Request): string {
  const header = req.headers['x-forwarded-for'];
  const forwarded = Array.isArray(header) ? header[0] : header;
  const first = forwarded?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || 'unknown';
}

/**
 * Stable, non-reversible anonymous visitor id (sha256 of salt + ip + user-agent,
 * truncated). Lets the engagement dashboard count unique visitors and sessions
 * without storing any personal data.
 */
export function anonIdFor(req: Request): string {
  const userAgent = String(req.headers['user-agent'] ?? '');
  return createHash('sha256')
    .update(`${ANON_SALT}|${clientIp(req)}|${userAgent}`)
    .digest('hex')
    .slice(0, 16);
}

/** Flush queued telemetry — call before the process exits so nothing is lost. */
export async function flushAppInsights(): Promise<void> {
  if (!client) {
    return;
  }

  try {
    await client.flush();
  } catch {
    // best-effort flush on shutdown
  }
}
