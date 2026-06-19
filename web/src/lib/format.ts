export function truncate(value: string, length = 220): string {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length).trimEnd()}…`;
}

export function formatDate(value?: string): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatNumber(value?: number | string): string {
  if (value === undefined || value === null || value === '') {
    return '—';
  }

  const numberValue = typeof value === 'number' ? value : Number(value);

  if (Number.isNaN(numberValue)) {
    return String(value);
  }

  return new Intl.NumberFormat(undefined, {
    notation: numberValue >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(numberValue);
}

export function statusColor(status?: number): string {
  if (!status) {
    return 'bg-ink-100 text-ink-700 ring-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:ring-ink-700';
  }

  if (status >= 200 && status < 300) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/40';
  }

  if (status === 429 || status === 430) {
    return 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/40';
  }

  if (status >= 400) {
    return 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-200 dark:ring-red-500/40';
  }

  return 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-500/40';
}
