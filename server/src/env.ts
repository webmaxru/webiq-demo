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

const apiKey = process.env.WEBIQ_API_KEY?.trim() || undefined;

export const env = {
  apiKey,
  port: parseNumber(process.env.PORT, 3001),
  webOrigin: process.env.WEB_ORIGIN?.trim() || 'http://localhost:5173',
  timeoutMs: parseNumber(process.env.WEBIQ_TIMEOUT_MS, 15000),
  keyConfigured: Boolean(apiKey),
  authMode: apiKey ? 'apiKey' : 'none',
} as const;
