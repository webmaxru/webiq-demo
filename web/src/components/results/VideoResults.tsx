import { formatDate, formatNumber } from '../../lib/format';
import { GenericCards, type JsonRecord } from './GenericCards';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function VideoResults({ data }: { data: JsonRecord }) {
  const videos = Array.isArray(data.videoResults) ? data.videoResults : [];
  const playlists = Array.isArray(data.playlists) ? data.playlists : [];

  return (
    <div className="space-y-6">
      {videos.length === 0 ? (
        <GenericCards items={videos} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {videos.map((item, index) => {
            const record = item as JsonRecord;
            const url = asString(record.url);

            return (
              <article className="overflow-hidden rounded-2xl border border-ink-200 bg-white" key={`${url ?? index}`}>
                {asString(record.thumbnailUrl) ? <img alt="" className="h-44 w-full object-cover" src={asString(record.thumbnailUrl)} /> : null}
                <div className="space-y-2 p-4">
                  <h3 className="font-semibold text-ink-950">
                    {url ? <a className="hover:text-brand-600 hover:underline" href={url} rel="noreferrer" target="_blank">{asString(record.title) ?? 'Video result'}</a> : asString(record.title)}
                  </h3>
                  <p className="text-sm text-ink-600">{asString(record.description)}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-ink-500">
                    {asString(record.publishedBy) ? <span>{asString(record.publishedBy)}</span> : null}
                    <span>{formatNumber(record.viewCount as number | string)} views</span>
                    {asString(record.length) ? <span>{asString(record.length)}</span> : null}
                    {asString(record.lastUpdatedAt) ? <span>{formatDate(asString(record.lastUpdatedAt))}</span> : null}
                  </div>
                  {asString(record.embeddingUrl) ? <a className="text-sm font-semibold text-brand-600 hover:underline" href={asString(record.embeddingUrl)} rel="noreferrer" target="_blank">Open embed</a> : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {playlists.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-ink-900">Playlists</h3>
          <GenericCards items={playlists} />
        </section>
      ) : null}
    </div>
  );
}
