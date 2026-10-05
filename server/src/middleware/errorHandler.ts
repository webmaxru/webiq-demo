import type { ErrorRequestHandler } from 'express';
import { trackAbuse } from '../abuse';
import { trackException } from '../appInsights';
import { toApiError } from '../apiError';

export { toApiError } from '../apiError';

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
