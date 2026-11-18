import type { ReactNode } from 'react';
import type { JsonRecord } from './GenericCards';

export function record(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

export function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => item !== null && typeof item === 'object' && !Array.isArray(item)) : [];
}

export function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function httpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value !== value.trim() || !/^https?:\/\//i.test(value)) {
    return undefined;
  }
  try {
    const url = new URL(value);
    return url.username || url.password ? undefined : value;
  } catch {
    return undefined;
  }
}

export function SourceLink({ url, children }: { url: unknown; children: ReactNode }) {
  const href = httpUrl(url);
  return href ? (
    <a className="break-words font-semibold text-brand-600 hover:underline dark:text-brand-300" href={href} target="_blank" rel="noreferrer">{children}</a>
  ) : <span>{children}</span>;
}

function label(key: string) {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, (value) => value.toUpperCase());
}

export function StructuredData({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return <span>{String(value)}</span>;
  }
  if (typeof value === 'string') {
    return httpUrl(value) ? <SourceLink url={value}>{value}</SourceLink> : <span className="whitespace-pre-wrap break-words">{value}</span>;
  }
  if (Array.isArray(value)) {
    return value.length ? <ul className="space-y-2">{value.map((item, index) => <li className="border-l border-ink-200 pl-3 dark:border-ink-700" key={index}><StructuredData value={item} /></li>)}</ul> : null;
  }
  return (
    <dl className="space-y-2 text-sm leading-6 text-ink-700 dark:text-ink-300">
      {Object.entries(record(value)).filter(([, item]) => item !== null && item !== undefined && item !== '').map(([key, item]) => (
        <div key={key}>
          <dt className="text-xs font-semibold text-ink-500 dark:text-ink-400">{label(key)}</dt>
          <dd><StructuredData value={item} /></dd>
        </div>
      ))}
    </dl>
  );
}
