const WEBIQ_URL = 'https://www.microsoft.com/en-us/webiq';
const AUTHOR_URL = 'https://www.linkedin.com/in/webmax';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-ink-200 bg-white/85 backdrop-blur dark:border-ink-800 dark:bg-ink-950/85">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-sm text-ink-500 dark:text-ink-400 sm:flex-row sm:px-6 lg:px-8">
        <p>
          Powered by{' '}
          <a
            className="font-semibold text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-300"
            href={WEBIQ_URL}
            rel="noreferrer"
            target="_blank"
          >
            Microsoft Web IQ
          </a>
        </p>
        <p>
          Made in 🇳🇴 Norway by{' '}
          <a
            className="font-semibold text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-300"
            href={AUTHOR_URL}
            rel="noreferrer"
            target="_blank"
          >
            Maxim Salnikov
          </a>
        </p>
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-5 text-center text-xs text-ink-400 dark:text-ink-500 sm:px-6 lg:px-8">
        No cookies. Requests are logged anonymously (no query text) for usage statistics —{' '}
        <a className="font-semibold text-brand-600 hover:underline dark:text-brand-300" href="/privacy">
          Privacy &amp; opt-out
        </a>
        .
      </div>
    </footer>
  );
}
