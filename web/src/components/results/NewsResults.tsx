import { formatDate } from '../../lib/format';
import { GenericCards, type JsonRecord } from './GenericCards';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function NewsResults({ data }: { data: JsonRecord }) {
  const items = Array.isArray(data.newsResults) ? data.newsResults : [];

  if (items.length === 0) {
    return <GenericCards items={items} />;
  }

  return (
    <div className="grid gap-3">
      {items.map((item, index) => {
        const record = item as JsonRecord;
        const thumbnail = record.thumbnail as JsonRecord | undefined;
        const url = asString(record.url);

        return (
          <article className="rounded-2xl border border-ink-200 bg-white p-4" key={`${url ?? index}`}>
            <div className="flex gap-4">
              {asString(thumbnail?.url) ? <img alt="" className="h-24 w-32 rounded-xl object-cover" src={asString(thumbnail?.url)} /> : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {asString(record.source) ? <span className="badge bg-ink-100 text-ink-700 ring-ink-200">{asString(record.source)}</span> : null}
                  {asString(record.lastUpdatedAt) ? <span className="text-xs text-ink-500">{formatDate(asString(record.lastUpdatedAt))}</span> : null}
                </div>
                <h3 className="mt-2 font-semibold text-ink-950">
                  {url ? <a className="hover:text-brand-600 hover:underline" href={url} rel="noreferrer" target="_blank">{asString(record.title) ?? 'News result'}</a> : asString(record.title)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-ink-600">{asString(record.snippet) ?? asString(record.content)}</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
