import type { Request } from 'express';
import { clientIp, trackEvent } from './appInsights';

export type AbuseKind = 'rate_limit' | 'input_too_long' | 'payload_too_large';

// Per-IP rate-limit hits reuse main's existing event so the engagement workbook's
// "rate-limit" tile and the scheduled-query alert light up without changes. (main
// already emits SandboxRateLimited for *upstream* 429s; gateway hits carry
// source:'gateway' to tell them apart.) Oversized-input/body abuse uses a dedicated
// event; the alert query covers both names.
const RATE_LIMIT_EVENT = 'SandboxRateLimited';
const ABUSE_EVENT = 'SandboxAbuse';

export interface AbuseDetails {
  endpointId?: string;
  path?: string;
  method?: string;
  userAgent?: string;
  /** The configured limit that was exceeded (req count or char length). */
  limit?: number;
  /** The observed value that exceeded the limit. */
  actual?: number;
  /** Rate-limit window in ms, when applicable. */
  windowMs?: number;
}

/**
 * Records an abuse event. Emits:
 *   1. a structured `console.warn` line so the signal exists in container logs
 *      even when App Insights is not configured, and
 *   2. an Application Insights custom event (`SandboxRateLimited` for rate-limit
 *      hits, otherwise `SandboxAbuse`) via the shared `trackEvent` helper, which
 *      lands in `customEvents` and drives the Owner-role alert.
 *
 * Abuse signals are security telemetry (not analytics), so they are recorded
 * regardless of the analytics opt-out. The raw client IP is included so an
 * operator can act on it; never any query text. `trackEvent` is a no-op when App
 * Insights is unconfigured, so this is safe in local dev.
 */
export function trackAbuse(kind: AbuseKind, req: Request, details: AbuseDetails = {}): void {
  const ip = clientIp(req);
  console.warn(`[abuse] ${kind} ${JSON.stringify({ ip, ...details })}`);

  const eventName = kind === 'rate_limit' ? RATE_LIMIT_EVENT : ABUSE_EVENT;
  trackEvent(eventName, {
    kind,
    source: 'gateway',
    ip,
    userAgent: req.get('user-agent') ?? undefined,
    ...details,
  });
}
