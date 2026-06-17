import type { SearchFailure } from '../types/meta';
import { statusColor } from '../lib/format';

interface ErrorBannerProps {
  failure: SearchFailure;
}

export function ErrorBanner({ failure }: ErrorBannerProps) {
  const { error } = failure;
  const isRateLimited = error.statusCode === 429 || error.statusCode === 430;

  return (
    <div
      className={`rounded-2xl border px-4 py-4 text-sm ${
        isRateLimited ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-red-200 bg-red-50 text-red-950'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <strong>{error.class}</strong>
        {error.statusCode ? <span className={`badge ${statusColor(error.statusCode)}`}>{error.statusCode}</span> : null}
      </div>
      <p className="mt-2">{error.message}</p>
      {error.retryAfter ? (
        <p className="mt-2 font-semibold">Retry after: {error.retryAfter}</p>
      ) : null}
      <div className="mt-3 grid gap-1 text-xs text-current/80">
        {error.errorCode ? <span>Error code: {error.errorCode}</span> : null}
        {error.errorCategory ? <span>Category: {error.errorCategory}</span> : null}
        {error.traceId ? <span>Trace ID: {error.traceId}</span> : null}
        {error.technicalDetails ? <span>Details: {error.technicalDetails}</span> : null}
      </div>
    </div>
  );
}
