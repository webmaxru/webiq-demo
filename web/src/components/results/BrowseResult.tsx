import { formatDate } from '../../lib/format';
import type { JsonRecord } from './GenericCards';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function BrowseResult({ data }: { data: JsonRecord }) {
  return (
    <article className="space-y-4">
      {asString(data.retryAfter) ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          Retry after: {asString(data.retryAfter)}
        </div>
      ) : null}
      <div>
        <h3 className="text-xl font-semibold text-ink-950">{asString(data.title) ?? 'Browse result'}</h3>
        {asString(data.url) ? <a className="mt-1 block break-all text-sm text-brand-600 hover:underline" href={asString(data.url)} rel="noreferrer" target="_blank">{asString(data.url)}</a> : null}
        <p className="mt-2 text-xs text-ink-500">Updated {formatDate(asString(data.lastUpdatedAt))} · Crawled {formatDate(asString(data.crawledAt))}</p>
      </div>
      <pre className="max-h-[32rem] overflow-auto rounded-2xl border border-ink-200 bg-ink-950 p-4 text-xs leading-relaxed text-ink-100">
        <code>{asString(data.content) ?? ''}</code>
      </pre>
    </article>
  );
}
