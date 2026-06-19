import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const dotenvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(__dirname, '..', '..', '..', '.env'),
];

for (const dotenvPath of dotenvPaths) {
  if (fs.existsSync(dotenvPath)) {
    dotenv.config({ path: dotenvPath, override: false });
  }
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Like parseNumber but allows 0 (used for the trust-proxy hop count, where 0 = trust none).
function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

const apiKey = process.env.WEBIQ_API_KEY?.trim() || undefined;

export const env = {
  apiKey,
  port: parseNumber(process.env.PORT, 3001),
  webOrigin: process.env.WEB_ORIGIN?.trim() || 'http://localhost:5173',
  timeoutMs: parseNumber(process.env.WEBIQ_TIMEOUT_MS, 15000),
  keyConfigured: Boolean(apiKey),
  authMode: apiKey ? 'apiKey' : 'none',
  // Number of reverse-proxy hops to trust for X-Forwarded-For (Container Apps
  // ingress is 1). A finite number keeps express-rate-limit's IP keying accurate
  // while avoiding its permissive `trust proxy = true` validation error.
  trustProxyHops: parseNonNegativeInt(process.env.TRUST_PROXY_HOPS, 1),
  // Hard cap on the primary search input length (chars). Oversized input is
  // rejected and recorded as an abuse signal.
  maxInputLength: parseNumber(process.env.WEBIQ_MAX_INPUT_LENGTH, 2048),
  // Per-IP rate limiting (fixed window).
  rateLimit: {
    windowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    searchMax: parseNumber(process.env.RATE_LIMIT_SEARCH_MAX, 15),
    generalMax: parseNumber(process.env.RATE_LIMIT_GENERAL_MAX, 100),
  },
} as const;
