import { AsyncLocalStorage } from 'node:async_hooks';
import type { TelemetryEvent } from '@microsoft/webiq';
import type { TelemetryInfo } from './contract';

export const telemetryStore = new AsyncLocalStorage<{ events: TelemetryEvent[] }>();

export async function runWithTelemetry<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; events: TelemetryEvent[] }> {
  const store = { events: [] as TelemetryEvent[] };
  return telemetryStore.run(store, async () => {
    try {
      const result = await fn();
      return { result, events: [...store.events] };
    } catch (err) {
      if (err && typeof err === 'object') {
        Object.defineProperty(err, '__webiqTelemetryEvents', {
          value: [...store.events],
          configurable: true,
        });
      }

      throw err;
    }
  });
}

export function telemetryHook(event: TelemetryEvent): void {
  telemetryStore.getStore()?.events.push(event);
}

export function telemetryEventsFromError(err: unknown): TelemetryEvent[] {
  if (err && typeof err === 'object' && '__webiqTelemetryEvents' in err) {
    const events = (err as { __webiqTelemetryEvents?: unknown }).__webiqTelemetryEvents;
    return Array.isArray(events) ? (events as TelemetryEvent[]) : [];
  }

  return [];
}

export function summarizeTelemetry(
  events: TelemetryEvent[],
  elapsedMs: number,
): TelemetryInfo {
  const last = events[events.length - 1];
  const attempts = events.reduce(
    (maxAttempt, event) => Math.max(maxAttempt, event.attempt ?? 0),
    0,
  );

  return {
    elapsedMs,
    ...(last?.statusCode !== undefined ? { statusCode: last.statusCode } : {}),
    ...(last?.traceId ? { traceId: last.traceId } : {}),
    ...(last?.requestId ? { requestId: last.requestId } : {}),
    ...(attempts > 0 ? { attempts } : {}),
    ...(last?.retryAfter ? { retryAfter: last.retryAfter } : {}),
  };
}
