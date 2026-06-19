import { Router } from 'express';
import type { Response } from 'express';
import type { SearchFailure, SearchSuccess } from '../contract';
import { trackAbuse } from '../abuse';
import { analyticsOptedOut, anonIdFor, trackEvent, trackException, trackMetric } from '../appInsights';
import { generateSnippet } from '../codegen';
import { getDescriptor } from '../endpoints/registry';
import { env } from '../env';
import { toApiError } from '../middleware/errorHandler';
import { runWithTelemetry, summarizeTelemetry, telemetryEventsFromError } from '../telemetry';
import { validateAndCoerce } from '../validation';
import { getClient, isKeyConfigured } from '../webiqClient';

interface SearchBody {
  input?: unknown;
  params?: unknown;
}

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

function requestAbortSignal(res: Response): AbortSignal {
  const controller = new AbortController();

  // Abort the in-flight SDK call only if the client goes away before the
  // response has been fully written. Listening on `res` 'close' (not `req`)
  // avoids a spurious early abort once the request body has been consumed.
  res.once('close', () => {
    if (!res.writableFinished) {
      controller.abort(new Error('Client disconnected.'));
    }
  });

  return controller.signal;
}

export const searchRouter = Router();

// The sandbox "send request" action is the key event we report to App Insights.
const SEARCH_EVENT = 'SandboxSearch';
const RATE_LIMIT_EVENT = 'SandboxRateLimited';

searchRouter.post('/search/:endpointId', async (req, res) => {
  const endpointId = req.params.endpointId;

  // Respect Do Not Track / Global Privacy Control / explicit opt-out: the request
  // runs normally, but we emit no pseudonymous id and no custom telemetry.
  const optedOut = analyticsOptedOut(req);
  const anonId = optedOut ? undefined : anonIdFor(req);
  const emit: typeof trackEvent = optedOut ? () => {} : trackEvent;
  const emitException: typeof trackException = optedOut ? () => {} : trackException;
  const emitMetric: typeof trackMetric = optedOut ? () => {} : trackMetric;
  const descriptor = getDescriptor(endpointId);

  if (!descriptor) {
    emit(SEARCH_EVENT, { endpointId, outcome: 'unknown_endpoint', anonId });
    res.status(400).json(validationFailure(endpointId, [`Unknown endpoint: ${endpointId}.`]));
    return;
  }

  const body = (req.body ?? {}) as SearchBody;

  // Hard input-length cap, checked before validation so oversized payloads are
  // rejected cheaply and recorded as an abuse signal (security telemetry, emitted
  // regardless of analytics opt-out).
  const rawInput = typeof body.input === 'string' ? body.input : '';
  if (rawInput.length > env.maxInputLength) {
    trackAbuse('input_too_long', req, {
      endpointId,
      path: req.originalUrl,
      method: req.method,
      limit: env.maxInputLength,
      actual: rawInput.length,
    });
    emit(SEARCH_EVENT, { endpointId, outcome: 'input_too_long', anonId });
    res.status(400).json(
      validationFailure(endpointId, [
        `${descriptor.inputLabel} exceeds the maximum length of ${env.maxInputLength} characters.`,
      ]),
    );
    return;
  }

  const validation = validateAndCoerce(descriptor, body.input, body.params ?? {});
  if ('issues' in validation) {
    emit(SEARCH_EVENT, { endpointId, outcome: 'validation_error', anonId });
    res.status(400).json(validationFailure(endpointId, validation.issues));
    return;
  }

  if (!isKeyConfigured()) {
    emit(SEARCH_EVENT, { endpointId, outcome: 'not_configured', anonId });
    res.status(503).json(configurationFailure(endpointId));
    return;
  }

  // Only the length of the query is recorded — never the query text itself.
  const inputLength = validation.input.length;
  const startedAt = Date.now();
  const signal = AbortSignal.any([
    requestAbortSignal(res),
    AbortSignal.timeout(env.timeoutMs),
  ]);

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

    emit(
      SEARCH_EVENT,
      {
        endpointId,
        outcome: 'success',
        anonId,
        statusCode: telemetry.statusCode,
      },
      {
        elapsedMs,
        inputLength,
        ...(telemetry.attempts !== undefined ? { attempts: telemetry.attempts } : {}),
      },
    );

    res.json(response);
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    const events = telemetryEventsFromError(err);
    const telemetry = events.length > 0 ? summarizeTelemetry(events, elapsedMs) : undefined;
    const { httpStatus, info } = toApiError(err);
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
    emit(SEARCH_EVENT, eventProps, { elapsedMs, inputLength });
    emitException(err, eventProps);

    // Rate limiting gets its own event + metric so the email alert can target it.
    if (info.class === 'RateLimitError') {
      emit(RATE_LIMIT_EVENT, {
        endpointId,
        anonId,
        statusCode: info.statusCode ?? httpStatus,
        retryAfter: info.retryAfter,
      });
      emitMetric('SandboxRateLimitErrors', 1, { endpointId });
    }

    res.status(httpStatus).json(response);
  }
});


