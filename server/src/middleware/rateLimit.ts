import rateLimit from 'express-rate-limit';
import type { Request, RequestHandler, Response } from 'express';
import type { SearchFailure } from '../contract';
import { trackAbuse } from '../abuse';
import { env } from '../env';

function endpointIdFromUrl(req: Request): string | undefined {
  const match = req.originalUrl.match(/\/api\/search\/([^/?]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

// Shared 429 handler: record the abuse event, then return a contract-shaped
// RateLimitError (statusCode 429 + retryAfter) the SPA already knows how to render.
function abuseLimitHandler(limit: number) {
  return (req: Request, res: Response): void => {
    const endpointId = endpointIdFromUrl(req);

    trackAbuse('rate_limit', req, {
      endpointId,
      path: req.originalUrl,
      method: req.method,
      limit,
      windowMs: env.rateLimit.windowMs,
    });

    const retryAfterSeconds = Math.ceil(env.rateLimit.windowMs / 1000);
    res.setHeader('Retry-After', String(retryAfterSeconds));

    const body: SearchFailure = {
      ok: false,
      endpointId: endpointId ?? 'unknown',
      error: {
        class: 'RateLimitError',
        statusCode: 429,
        message: `Too many requests. Please retry in ${retryAfterSeconds}s.`,
        retryAfter: `${retryAfterSeconds}s`,
      },
    };

    res.status(429).json(body);
  };
}

// Strict limiter for the expensive, paid search endpoints.
export const searchRateLimiter: RequestHandler = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.searchMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: abuseLimitHandler(env.rateLimit.searchMax),
});

// Looser limiter for the rest of the API. Health is skipped so platform probes
// (Container Apps liveness/readiness) are never throttled.
export const generalRateLimiter: RequestHandler = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.generalMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  handler: abuseLimitHandler(env.rateLimit.generalMax),
});
