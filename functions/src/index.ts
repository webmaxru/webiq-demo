import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { createHash } from 'node:crypto';
import { toApiError } from '../../server/src/apiError';
import { generateSnippet } from '../../server/src/codegen';
import type { SearchFailure, SearchSuccess } from '../../server/src/contract';
import { getDescriptor } from '../../server/src/endpoints/registry';
import { env } from '../../server/src/env';
import {
  runWithTelemetry,
  summarizeTelemetry,
  telemetryEventsFromError,
} from '../../server/src/telemetry';
import { validateAndCoerce } from '../../server/src/validation';
import { getClient, isKeyConfigured } from '../../server/src/webiqClient';

interface RateWindow {
  count: number;
  resetsAt: number;
}

const rateWindows = new Map<string, RateWindow>();
const rateLimitWindowMs = env.rateLimit.windowMs;
const rateLimitMax = env.rateLimit.searchMax;

function validationFailure(endpointId: string, issues: string[]): SearchFailure {
  return {
    ok: false,
    endpointId,
    error: {
      class: 'ValidationError',
      message: 'Request validation failed.',
      body: { issues },
    },
  };
}

function configurationFailure(endpointId: string): SearchFailure {
  return {
    ok: false,
    endpointId,
    error: {
      class: 'ConfigurationError',
      message: 'WEBIQ_API_KEY is not configured. Set it in the root .env file.',
    },
  };
}

function jsonResponse(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function clientIp(req: HttpRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  return forwardedFor?.split(',')[0]?.trim() || 'unknown';
}

function analyticsOptedOut(req: HttpRequest): boolean {
  return req.headers.get('x-webiq-analytics')?.toLowerCase() === 'off'
    || req.headers.get('dnt') === '1'
    || req.headers.get('sec-gpc') === '1';
}

function anonIdFor(req: HttpRequest): string {
  const salt = process.env.WEBIQ_ANON_SALT?.trim() || 'webiq-demo-anon';
  const userAgent = req.headers.get('user-agent') ?? '';
  return createHash('sha256')
    .update(`${salt}|${clientIp(req)}|${userAgent}`)
    .digest('hex')
    .slice(0, 16);
}

function isRateLimited(req: HttpRequest): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const key = clientIp(req);
  const current = rateWindows.get(key);

  if (!current || current.resetsAt <= now) {
    rateWindows.set(key, { count: 1, resetsAt: now + rateLimitWindowMs });
    return { limited: false, retryAfterSeconds: 0 };
  }

  current.count += 1;
  if (current.count <= rateLimitMax) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  return {
    limited: true,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetsAt - now) / 1000)),
  };
}

async function readRequestBody(req: HttpRequest): Promise<
  { body: Record<string, unknown> } | { error: HttpResponseInit }
> {
  try {
    const body = await req.json();
    return {
      body: (body && typeof body === 'object' ? body : {}) as Record<string, unknown>,
    };
  } catch {
    return {
      error: jsonResponse(400, validationFailure('unknown', ['Request body must be valid JSON.'])),
    };
  }
}

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    return jsonResponse(200, {
      ok: true,
      status: 'healthy',
      backend: 'azure-functions',
      keyConfigured: env.keyConfigured,
    });
  },
});

app.http('search', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'search/{endpointId}',
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const endpointId = req.params.endpointId ?? '';
    const optedOut = analyticsOptedOut(req);
    const anonId = optedOut ? undefined : anonIdFor(req);
    const descriptor = getDescriptor(endpointId);

    if (!descriptor) {
      return jsonResponse(400, validationFailure(endpointId, [`Unknown endpoint: ${endpointId}.`]));
    }

    const rateLimit = isRateLimited(req);
    if (rateLimit.limited) {
      return {
        ...jsonResponse(429, {
          ok: false,
          endpointId,
          error: {
            class: 'RateLimitError',
            statusCode: 429,
            message: 'Too many requests. Please try again later.',
            retryAfter: `${rateLimit.retryAfterSeconds}s`,
          },
        }),
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
      };
    }

    const parsedBody = await readRequestBody(req);
    if ('error' in parsedBody) {
      return parsedBody.error;
    }

    const body = parsedBody.body;
    const rawInput = typeof body.input === 'string' ? body.input : '';
    if (rawInput.length > env.maxInputLength) {
      const details = {
        endpointId,
        path: req.url,
        method: req.method,
        limit: env.maxInputLength,
        actual: rawInput.length,
      };
      ctx.warn(`[abuse] input_too_long ${JSON.stringify({ ip: clientIp(req), ...details })}`);
      return jsonResponse(
        400,
        validationFailure(endpointId, [
          `${descriptor.inputLabel} exceeds the maximum length of ${env.maxInputLength} characters.`,
        ]),
      );
    }

    const validation = validateAndCoerce(descriptor, body.input, body.params ?? {});
    if ('issues' in validation) {
      const issues = Array.isArray(validation.issues) ? validation.issues : [];
      return jsonResponse(400, validationFailure(endpointId, issues));
    }

    if (!isKeyConfigured()) {
      return jsonResponse(503, configurationFailure(endpointId));
    }

    const inputLength = validation.input.length;
    const startedAt = Date.now();
    const signal = AbortSignal.timeout(env.timeoutMs);

    try {
      const { result, events } = await runWithTelemetry(() => descriptor.invoke(
        getClient(),
        validation.input,
        validation.opts,
        signal,
      ));

      const elapsedMs = Date.now() - startedAt;
      const telemetry = summarizeTelemetry(events, elapsedMs);
      const response: SearchSuccess = {
        ok: true,
        endpointId,
        data: result,
        telemetry,
        snippet: generateSnippet(descriptor, validation.input, validation.opts),
      };

      ctx.log('Search completed.', {
        endpointId,
        elapsedMs,
        inputLength,
        anonId,
        statusCode: telemetry.statusCode,
      });

      return jsonResponse(200, response);
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      const events = telemetryEventsFromError(error);
      const telemetry = events.length > 0 ? summarizeTelemetry(events, elapsedMs) : undefined;
      const { httpStatus, info } = toApiError(error);
      const response: SearchFailure = {
        ok: false,
        endpointId,
        error: info,
        ...(telemetry ? { telemetry } : {}),
      };

      const eventProps = {
        endpointId,
        outcome: 'failure',
        anonId,
        errorClass: info.class,
        statusCode: info.statusCode ?? httpStatus,
        retryAfter: info.retryAfter,
      };

      ctx.error(`Search failed for ${endpointId}: ${info.message}`, {
        ...eventProps,
        elapsedMs,
        inputLength,
      });
      return jsonResponse(httpStatus, response);
    }
  },
});
