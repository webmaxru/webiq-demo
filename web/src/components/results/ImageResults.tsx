import { formatDate } from '../../lib/format';
import { GenericCards, type JsonRecord } from './GenericCards';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function ImageResults({ data }: { data: JsonRecord }) {
  const images = Array.isArray(data.imageResults) ? data.imageResults : [];

  if (images.length === 0) {
    return <GenericCards items={images} />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {images.map((item, index) => {
        const record = item as JsonRecord;
        const href = asString(record.hostPageUrl) ?? asString(record.url);

        return (
          <a className="group overflow-hidden border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900" href={href} key={`${href ?? index}`} rel="noreferrer" target="_blank">
            {asString(record.thumbnailUrl) ? <img alt={asString(record.title) ?? ''} className="h-44 w-full object-cover transition group-hover:scale-105" src={asString(record.thumbnailUrl)} /> : null}
            <div className="space-y-1 p-3">
              <h3 className="line-clamp-2 text-sm font-semibold text-ink-950 group-hover:text-brand-600 dark:text-ink-100 dark:group-hover:text-brand-300">{asString(record.title) ?? 'Image result'}</h3>
              <p className="line-clamp-2 text-xs text-ink-600 dark:text-ink-400">{asString(record.caption)}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                {String(record.width ?? '—')} × {String(record.height ?? '—')} · {formatDate(asString(record.lastUpdatedAt))}
              </p>
            </div>
          </a>
        );
      })}
    </div>
  );
}
