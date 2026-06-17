import { Router } from 'express';
import type { Response } from 'express';
import type { SearchFailure, SearchSuccess } from '../contract';
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

searchRouter.post('/search/:endpointId', async (req, res) => {
  const endpointId = req.params.endpointId;
  const descriptor = getDescriptor(endpointId);

  if (!descriptor) {
    res.status(400).json(validationFailure(endpointId, [`Unknown endpoint: ${endpointId}.`]));
    return;
  }

  const body = (req.body ?? {}) as SearchBody;
  const validation = validateAndCoerce(descriptor, body.input, body.params ?? {});
  if ('issues' in validation) {
    res.status(400).json(validationFailure(endpointId, validation.issues));
    return;
  }

  if (!isKeyConfigured()) {
    res.status(503).json(configurationFailure(endpointId));
    return;
  }

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
    const response: SearchSuccess = {
      ok: true,
      endpointId,
      data: result,
      telemetry: summarizeTelemetry(events, elapsedMs),
      snippet: generateSnippet(descriptor, validation.input, validation.opts),
    };

    res.json(response);
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    const events = telemetryEventsFromError(err);
    const { httpStatus, info } = toApiError(err);
    const response: SearchFailure = {
      ok: false,
      endpointId,
      error: info,
      ...(events.length > 0 ? { telemetry: summarizeTelemetry(events, elapsedMs) } : {}),
    };

    res.status(httpStatus).json(response);
  }
});


