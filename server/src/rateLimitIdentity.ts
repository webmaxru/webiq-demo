import { createHash } from 'node:crypto';

export const RATE_LIMIT_SESSION_HEADER = 'x-webiq-session-id';

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const IDENTITY_SALT = process.env.WEBIQ_ANON_SALT?.trim() || 'webiq-demo-rate-limit';

export function rateLimitKey(
  sessionId: string | undefined,
  fallback: string,
): string {
  const normalized = sessionId?.trim();
  if (!normalized || !SESSION_ID_PATTERN.test(normalized)) {
    return `ip:${fallback}`;
  }

  const digest = createHash('sha256')
    .update(`${IDENTITY_SALT}|${normalized}`)
    .digest('hex')
    .slice(0, 32);
  return `session:${digest}`;
}

export function validSessionId(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && SESSION_ID_PATTERN.test(normalized) ? normalized : undefined;
}
