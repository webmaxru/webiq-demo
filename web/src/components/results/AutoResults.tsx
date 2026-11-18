import type { JsonRecord } from './GenericCards';
import { GenericCards } from './GenericCards';
import { httpUrl, record, records, SourceLink, StructuredData, text } from './StructuredData';

function WeatherCard({ content }: { content: JsonRecord }) {
  const units = record(content.units);
  const current = record(content.currentWeather);
  return (
    <div className="space-y-4">
      <h4 className="text-xl font-semibold">{text(content.location) ?? 'Weather'}</h4>
      <div className="flex flex-wrap items-baseline gap-3">
        {typeof current.temperature === 'number' ? <p className="text-3xl font-bold">{current.temperature} {text(units.temperature)}</p> : null}
        <p>{text(current.condition)}</p>
        {typeof current.feelsLike === 'number' ? <p className="text-sm">Feels like {current.feelsLike} {text(units.temperature)}</p> : null}
      </div>
      {records(content.alerts).map((alert, index) => (
        <div className="border border-amber-400 bg-amber-50 p-3 text-amber-950 dark:bg-amber-950 dark:text-amber-100" key={index}>
          <p className="font-semibold">{[text(alert.severity), text(alert.name)].filter(Boolean).join(': ') || 'Weather alert'}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{text(alert.description)}</p>
          {text(alert.safetyGuidance) ? <p className="mt-2 text-sm">{text(alert.safetyGuidance)}</p> : null}
          <SourceLink url={alert.url}>{text(alert.issuingAuthority) ?? 'Issuing authority'}</SourceLink>
          {text(alert.expiresAt) ? <p className="text-xs">Expires {text(alert.expiresAt)}</p> : null}
        </div>
      ))}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {records(content.forecastedWeather).map((day, index) => (
          <div className="border border-ink-200 p-3 dark:border-ink-700" key={index}>
            <p className="font-semibold">{text(day.validDate) ?? `Forecast ${index + 1}`}</p>
            <p className="text-sm">{text(day.condition)}</p>
            {typeof day.temperatureHigh === 'number' ? <p>High {day.temperatureHigh} {text(units.temperature)}</p> : null}
            {typeof day.temperatureLow === 'number' ? <p>Low {day.temperatureLow} {text(units.temperature)}</p> : null}
          </div>
        ))}
      </div>
      <details>
        <summary className="cursor-pointer text-sm font-semibold">All weather measurements &amp; units</summary>
        <div className="mt-3"><StructuredData value={content} /></div>
      </details>
    </div>
  );
}

export function AutoResults({ data }: { data: JsonRecord }) {
  const results = records(data.results);
  if (!results.length) {
    return <GenericCards items={[]} />;
  }
  return (
    <div className="space-y-4">
      {results.map((result, index) => {
        const evidence = record(result.evidence);
        const content = record(evidence.content);
        const thumbnail = httpUrl(content.thumbnailUrl) ?? httpUrl(record(evidence.thumbnail).url);
        return (
          <article className="space-y-4 border border-ink-200 p-4 text-ink-900 dark:border-ink-700 dark:text-ink-100" key={index}>
            <span className="badge bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200">{text(evidence.type) ?? 'Evidence'}</span>
            {thumbnail ? <img alt={text(content.caption) ?? ''} src={thumbnail} className="max-h-60 max-w-full object-contain" loading="lazy" /> : null}
            {typeof evidence.content === 'string' ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-7">{evidence.content}</p>
            ) : evidence.type === 'structured/weather' ? <WeatherCard content={content} /> : <StructuredData value={evidence.content} />}
            {records(result.citations).length ? (
              <div className="space-y-2 border-t border-ink-200 pt-3 dark:border-ink-700">
                <h4 className="text-xs font-semibold uppercase text-ink-500">Sources for this evidence</h4>
                <ul className="space-y-2 text-sm">
                  {records(result.citations).map((citation, citationIndex) => (
                    <li key={citationIndex}>
                      <SourceLink url={httpUrl(citation.hostPageUrl) ?? citation.url}>{text(citation.title) ?? text(citation.source) ?? text(citation.url) ?? 'Source'}</SourceLink>
                      <p className="text-xs text-ink-500 dark:text-ink-400">{[text(citation.publishedBy), text(citation.lastUpdatedAt), text(citation.observedAt)].filter(Boolean).join(' | ')}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <p className="text-xs text-ink-500">No source citations supplied for this evidence.</p>}
          </article>
        );
      })}
    </div>
  );
}
