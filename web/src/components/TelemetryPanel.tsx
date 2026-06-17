import type { SearchResponse, TelemetryInfo } from '../types/meta';
import { statusColor } from '../lib/format';

interface TelemetryPanelProps {
  response: SearchResponse;
}

function row(label: string, value?: string | number) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-1 break-all text-sm font-medium text-ink-900">{value ?? '—'}</dd>
    </div>
  );
}

export function TelemetryPanel({ response }: TelemetryPanelProps) {
  const telemetry: TelemetryInfo | undefined = response.ok ? response.telemetry : response.telemetry;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">These values come from the SDK <code className="font-mono">telemetryHook</code>.</p>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {row('Elapsed', telemetry ? `${telemetry.elapsedMs} ms` : undefined)}
        <div className="rounded-xl border border-ink-200 bg-white p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Status</dt>
          <dd className="mt-2">
            <span className={`badge ${statusColor(telemetry?.statusCode)}`}>{telemetry?.statusCode ?? '—'}</span>
          </dd>
        </div>
        {row('Attempts', telemetry?.attempts)}
        {row('Trace ID', telemetry?.traceId)}
        {row('Request ID', telemetry?.requestId)}
        {row('Retry after', telemetry?.retryAfter)}
      </dl>
    </div>
  );
}
