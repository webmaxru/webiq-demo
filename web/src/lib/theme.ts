// Minimal class-based dark theme helper. The initial class is applied by an
// inline script in index.html (before paint) to avoid a flash; this module keeps
// React in sync and persists the user's explicit choice in localStorage.
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'webiq-theme';

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function getStoredTheme(): Theme | undefined {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : undefined;
  } catch {
    return undefined;
  }
}

export function getActiveTheme(): Theme {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark';
  }

  return getStoredTheme() ?? (prefersDark() ? 'dark' : 'light');
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');

  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures (private mode, disabled storage) — the in-memory
    // class toggle still works for the current session.
  }
}
