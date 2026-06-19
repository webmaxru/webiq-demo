import { GenericCards, type JsonRecord } from './GenericCards';

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

export function ClassicResults({ data }: { data: JsonRecord }) {
  const signals = isRecord(data.querySignals) ? data.querySignals : undefined;
  const groups = Object.entries(data).filter(([, value]) => Array.isArray(value));

  return (
    <div className="space-y-6">
      {signals ? (
        <section>
          <h3 className="mb-2 text-base font-semibold text-ink-900 dark:text-ink-100">Query signals</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(signals).map(([key, value]) => (
              <span className="badge bg-ink-100 text-ink-700 ring-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:ring-ink-700" key={key}>
                {key}: {String(value)}
              </span>
            ))}
          </div>
        </section>
      ) : null}
      {groups.length > 0 ? (
        groups.map(([key, value]) => <GenericCards items={value} key={key} title={key} />)
      ) : (
        <GenericCards items={[]} />
      )}
      {typeof data.traceId === 'string' ? <p className="text-xs text-ink-500 dark:text-ink-400">Trace ID: {data.traceId}</p> : null}
    </div>
  );
}
