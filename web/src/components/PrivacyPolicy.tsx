import { useState } from 'react';
import { Footer } from './Footer';
import { Header } from './Header';
import {
  browserSignalsOptOut,
  isAnalyticsOptedOut,
  setAnalyticsOptedOut,
} from '../lib/analyticsConsent';

const LAST_UPDATED = '19 June 2026';
const AUTHOR_URL = 'https://www.linkedin.com/in/webmax';
const REPO_URL = 'https://github.com/webmaxru/webiq-demo';

function OptOutControl() {
  const [optedOut, setOptedOut] = useState(isAnalyticsOptedOut());
  const forcedByBrowser = browserSignalsOptOut();

  const toggle = () => {
    const next = !optedOut;
    setAnalyticsOptedOut(next);
    setOptedOut(next);
  };

  return (
    <div className="border border-ink-200 bg-ink-50 p-5 dark:border-ink-700 dark:bg-ink-800/60">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
            Anonymous usage analytics are currently{' '}
            <span className={optedOut ? 'text-red-600' : 'text-emerald-600'}>
              {optedOut ? 'OFF' : 'ON'}
            </span>{' '}
            for this browser.
          </p>
          <p className="mt-1 text-xs leading-5 text-ink-500 dark:text-ink-400">
            {forcedByBrowser
              ? 'Your browser is sending a Do Not Track / Global Privacy Control signal, which we honour automatically.'
              : 'Your choice is stored only in this browser. No account or cookie is involved.'}
          </p>
        </div>
        <button
          className="inline-flex items-center border border-ink-300 bg-white px-4 py-2 text-sm font-semibold text-ink-800 transition hover:bg-ink-100 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700"
          disabled={forcedByBrowser}
          onClick={toggle}
          type="button"
        >
          {optedOut ? 'Opt back in' : 'Opt out of analytics'}
        </button>
      </div>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <article className="card space-y-6 p-6 sm:p-8">
          <header className="space-y-1">
            <a className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300" href="/">
              ← Back to the sandbox
            </a>
            <h1 className="text-3xl font-bold tracking-tight text-ink-950 dark:text-white">Privacy Notice</h1>
            <p className="text-sm text-ink-500 dark:text-ink-400">Last updated: {LAST_UPDATED}</p>
          </header>

          <section className="space-y-3 text-sm leading-6 text-ink-700 dark:text-ink-300">
            <p>
              Web IQ Sandbox is a free, interactive developer playground for the Microsoft Web IQ
              grounding APIs. This notice explains what data we process, why, and the choices you
              have under the EU/EEA General Data Protection Regulation (GDPR).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-ink-950 dark:text-white">No cookies, no device storage for tracking</h2>
            <p className="text-sm leading-6 text-ink-700 dark:text-ink-300">
              This site sets <strong>no cookies</strong> and uses <strong>no localStorage,
              sessionStorage, fingerprinting, or third-party trackers</strong> for analytics or
              advertising. We do not store or read information on your device for those purposes, so
              no cookie-consent banner is shown. The only thing we may save locally is your
              analytics opt-out choice below — strictly to remember that you objected.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-ink-950 dark:text-white">What we process, and why</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-ink-700 dark:text-ink-300">
              <li>
                <strong>Anonymous usage telemetry.</strong> When you run a request we record the
                endpoint used, timing, outcome/status code, the number of retries, and the{' '}
                <strong>length</strong> of your query — <strong>never the query text itself</strong>.
              </li>
              <li>
                <strong>A pseudonymous visitor id.</strong> To count unique visitors we derive a
                one-way hash from your IP address and browser user-agent. The raw IP and user-agent
                are <strong>not stored</strong>; only the truncated hash is kept.
              </li>
              <li>
                <strong>Standard diagnostics.</strong> Our hosting/monitoring (Microsoft Azure
                Application Insights) collects standard request logs and error diagnostics, and may
                derive coarse (city/country) location from your IP for aggregate statistics before
                discarding the IP.
              </li>
            </ul>
            <p className="text-sm leading-6 text-ink-700 dark:text-ink-300">
              <strong>Legal basis:</strong> our legitimate interest (GDPR Art. 6(1)(f)) in keeping
              the service reliable and understanding aggregate usage, balanced against your privacy
              through data minimisation. Sending your query to the Web IQ API is necessary to
              perform the search you request (Art. 6(1)(b)).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-ink-950 dark:text-white">Who receives the data</h2>
            <p className="text-sm leading-6 text-ink-700 dark:text-ink-300">
              We use <strong>Microsoft Azure</strong> as our processor for hosting (Azure Container
              Apps) and telemetry (Application Insights). When you run a search, your query text is
              sent to the <strong>Microsoft Web IQ</strong> API to return results. Microsoft may
              process data inside and outside the EEA under its Data Protection Addendum and EU
              Standard Contractual Clauses. We do not sell your data or share it with advertisers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-ink-950 dark:text-white">How long we keep it</h2>
            <p className="text-sm leading-6 text-ink-700 dark:text-ink-300">
              Telemetry is retained for up to <strong>90 days</strong> (the Application Insights
              default) and is then deleted or kept only in aggregate, non-identifiable form.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-ink-950 dark:text-white">Your choice: opt out of analytics</h2>
            <p className="text-sm leading-6 text-ink-700 dark:text-ink-300">
              You can object to the usage analytics at any time with one click. We also{' '}
              <strong>automatically honour</strong> your browser's Do Not Track (DNT) and Global
              Privacy Control (GPC) signals. Opting out does not affect your ability to use the
              sandbox.
            </p>
            <OptOutControl />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-ink-950 dark:text-white">Your rights</h2>
            <p className="text-sm leading-6 text-ink-700 dark:text-ink-300">
              Under the GDPR you have the right to access, rectification, erasure, restriction,
              objection, and data portability. Because we deliberately keep no directly identifying
              records, we may be unable to single out your data, but we will help wherever possible.
              You may also lodge a complaint with your local supervisory authority (for example, the
              Norwegian Data Protection Authority, <em>Datatilsynet</em>, or the authority in your
              country).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-ink-950 dark:text-white">Who is responsible &amp; how to contact us</h2>
            <p className="text-sm leading-6 text-ink-700 dark:text-ink-300">
              The data controller is Maxim Salnikov (Norway, EEA). For any privacy request, contact
              us via{' '}
              <a className="font-semibold text-brand-600 hover:underline dark:text-brand-300" href={AUTHOR_URL} rel="noreferrer" target="_blank">
                LinkedIn
              </a>{' '}
              or by opening an issue on{' '}
              <a className="font-semibold text-brand-600 hover:underline dark:text-brand-300" href={REPO_URL} rel="noreferrer" target="_blank">
                GitHub
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-ink-950 dark:text-white">Changes to this notice</h2>
            <p className="text-sm leading-6 text-ink-700 dark:text-ink-300">
              We may update this notice from time to time. Material changes will be reflected by the
              “last updated” date above.
            </p>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
}
