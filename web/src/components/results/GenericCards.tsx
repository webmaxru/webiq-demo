import { useState } from 'react';
import { formatDate, truncate } from '../../lib/format';

export type JsonRecord = Record<string, unknown>;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => typeof item === 'object' && item !== null) : [];
}

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 260;

  return (
    <p className="text-sm leading-6 text-ink-600">
      {expanded || !isLong ? text : truncate(text, 260)}
      {isLong ? (
        <button
          className="ml-2 font-semibold text-brand-600 hover:text-brand-700"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </p>
  );
}

export function GenericCards({ items, title }: { items: unknown; title?: string }) {
  const records = asRecords(items);

  if (records.length === 0) {
    return <p className="rounded-2xl border border-dashed border-ink-300 p-6 text-center text-sm text-ink-500">No results.</p>;
  }

  return (
    <div className="space-y-3">
      {title ? <h3 className="text-base font-semibold text-ink-900">{title}</h3> : null}
      <div className="grid gap-3">
        {records.map((item, index) => {
          const titleText = asString(item.title) ?? asString(item.name) ?? `Result ${index + 1}`;
          const url = asString(item.url) ?? asString(item.hostPageUrl);
          const description = asString(item.content) ?? asString(item.snippet) ?? asString(item.description) ?? asString(item.caption);
          const thumbnail = asString(item.thumbnailUrl) ?? asString((item.thumbnail as JsonRecord | undefined)?.url);
          const date = asString(item.lastUpdatedAt) ?? asString(item.crawledAt);

          return (
            <article className="rounded-2xl border border-ink-200 bg-white p-4 transition hover:border-brand-500/60" key={`${url ?? titleText}-${index}`}>
              <div className="flex gap-4">
                {thumbnail ? (
                  <img alt="" className="h-20 w-28 rounded-xl object-cover" loading="lazy" src={thumbnail} />
                ) : null}
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-ink-950">
                    {url ? (
                      <a className="hover:text-brand-600 hover:underline" href={url} rel="noreferrer" target="_blank">
                        {titleText}
                      </a>
                    ) : (
                      titleText
                    )}
                  </h4>
                  {url ? <p className="mt-1 truncate text-xs text-brand-700">{url}</p> : null}
                  {description ? <div className="mt-2"><Description text={description} /></div> : null}
                  {date ? <p className="mt-2 text-xs text-ink-500">Updated {formatDate(date)}</p> : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
