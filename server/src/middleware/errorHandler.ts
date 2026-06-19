import type { ErrorRequestHandler } from 'express';
import {
  APIConnectionError,
  APIStatusError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
  WebIQError,
} from '@microsoft/webiq';
import type { ApiErrorInfo } from '../contract';
import { trackAbuse } from '../abuse';
import { trackException } from '../appInsights';
import { ConfigurationError } from '../webiqClient';

function objectBody(body: unknown): Record<string, unknown> | undefined {
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : undefined;
}

function stringField(body: Record<string, unknown> | undefined, field: string): string | undefined {
  const value = body?.[field];
  if (typeof value === 'string') {
    return value;
  }

  if (value !== undefined && field === 'technicalDetails') {
    return JSON.stringify(value);
  }

  return undefined;
}

export function toApiError(err: unknown): { httpStatus: number; info: ApiErrorInfo } {
  if (err instanceof ConfigurationError) {
    return {
      httpStatus: 503,
      info: {
        class: err.name,
        message: err.message,
      },
    };
  }

  if (err instanceof APIStatusError) {
    const body = objectBody(err.body);
    const retryAfter = err instanceof RateLimitError
      ? err.retryAfter
      : stringField(body, 'retryAfter');
    const className = err instanceof AuthenticationError
      ? 'AuthenticationError'
      : err instanceof PermissionDeniedError
        ? 'PermissionDeniedError'
        : err instanceof RateLimitError
          ? 'RateLimitError'
          : err.name || 'APIStatusError';

    return {
      httpStatus: err.statusCode,
      info: {
        class: className,
        statusCode: err.statusCode,
        message: err.message,
        ...(retryAfter ? { retryAfter } : {}),
        ...(stringField(body, 'errorCode') ? { errorCode: stringField(body, 'errorCode') } : {}),
        ...(stringField(body, 'errorCategory') ? { errorCategory: stringField(body, 'errorCategory') } : {}),
        ...(stringField(body, 'technicalDetails') ? { technicalDetails: stringField(body, 'technicalDetails') } : {}),
        ...(stringField(body, 'traceId') ?? err.traceId ? { traceId: stringField(body, 'traceId') ?? err.traceId } : {}),
        ...(err.body !== undefined ? { body: err.body } : {}),
      },
    };
  }

  if (err instanceof APIConnectionError) {
    return {
      httpStatus: 502,
      info: {
        class: err.name || 'APIConnectionError',
        message: err.message,
      },
    };
  }

  if (err instanceof WebIQError) {
    return {
      httpStatus: 500,
      info: {
        class: err.name || 'WebIQError',
        message: err.message,
      },
    };
  }

  if (err instanceof Error) {
    const status = (err as { status?: unknown; statusCode?: unknown }).status
      ?? (err as { statusCode?: unknown }).statusCode;
    return {
      httpStatus: typeof status === 'number' ? status : 500,
      info: {
        class: err.name || 'Error',
        message: err.message,
      },
    };
  }

  return {
    httpStatus: 500,
    info: {
      class: 'UnknownError',
      message: 'An unknown error occurred.',
      body: err,
    },
  };
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const { httpStatus, info } = toApiError(err);

  // Catch-all errors that bypass the search route (e.g. malformed JSON bodies).
  trackException(err, {
    source: 'errorHandler',
    path: req.path,
    method: req.method,
    errorClass: info.class,
    statusCode: httpStatus,
  });

  // Oversized request bodies (express.json 413) are an abuse signal.
  const isPayloadTooLarge =
    httpStatus === 413 ||
    (err && typeof err === 'object' && (err as { type?: unknown }).type === 'entity.too.large');
  if (isPayloadTooLarge) {
    trackAbuse('payload_too_large', req, {
      path: req.originalUrl,
      method: req.method,
      actual: Number((err as { length?: unknown }).length) || undefined,
      limit: Number((err as { limit?: unknown }).limit) || undefined,
    });
  }

  res.status(httpStatus).json({
    ok: false,
    endpointId: 'unknown',
    error: info,
  });
};

