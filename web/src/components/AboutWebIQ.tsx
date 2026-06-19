const WEBIQ_URL = 'https://www.microsoft.com/en-us/webiq';
const NPM_URL = 'https://www.npmjs.com/package/@microsoft/webiq';
const API_BASE_URL = 'https://api.microsoft.ai/v3';

interface Capability {
  name: string;
  detail: string;
}

// Plain-language summary of what each Web IQ endpoint returns, so developers
// know what they are actually exercising in each tab.
const CAPABILITIES: Capability[] = [
  {
    name: 'Web Search',
    detail:
      'Webpages plus their readable, extracted content (Markdown, HTML, plain text, or passage-level) — tunable by freshness, language, region, and location.',
  },
  {
    name: 'News Search',
    detail: 'Current news articles with snippets, publisher/source, and thumbnails.',
  },
  {
    name: 'Video Search',
    detail:
      'Videos with descriptions, view counts, key moments, and thumbnails — with duration, resolution, and freshness filters, plus optional playlists.',
  },
  {
    name: 'Image Search',
    detail:
      'Images with visual filters (aspect ratio, color, size, watermark-free) and safe-search controls.',
  },
  {
    name: 'Browse Fetch',
    detail:
      'Fetches one specific URL and transforms it into clean, LLM-ready content — with optional live crawl and dynamic-page rendering.',
  },
  {
    name: 'Classic Search',
    detail:
      'A single multi-answer call that returns several answer types at once (web, news, images …) together with query signals.',
  },
];

interface Reason {
  title: string;
  detail: string;
}

const REASONS: Reason[] = [
  {
    title: 'Grounding & RAG',
    detail:
      'Replace a model’s stale, fixed knowledge with fresh, real-world web data — reducing hallucinations and letting agents cite their sources.',
  },
  {
    title: 'Passage-level retrieval',
    detail:
      'Returns only the most relevant passages instead of whole pages — improving answer quality while cutting token usage.',
  },
  {
    title: 'Citation-ready & structured',
    detail:
      'Every result carries its URL and metadata, so your agent can attribute, verify, and link back to the original content.',
  },
  {
    title: 'Fine-grained control',
    detail:
      'You decide how results feed the LLM — tune freshness, region, language, content format, and safe-search on every call.',
  },
];

export function AboutWebIQ() {
  return (
    <details className="card group p-0" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <span className="flex items-center gap-2">
          <span className="badge bg-brand-50 text-brand-700 ring-brand-200">New here?</span>
          <span className="text-base font-bold tracking-tight text-ink-950">What is Web IQ?</span>
        </span>
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-ink-400 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <div className="space-y-5 border-t border-ink-100 px-5 py-5">
        <p className="text-sm leading-6 text-ink-700">
          <a
            className="font-semibold text-brand-600 hover:underline"
            href={WEBIQ_URL}
            rel="noreferrer"
            target="_blank"
          >
            Microsoft Web IQ
          </a>{' '}
          is a next-generation, <strong>agent-native grounding platform</strong> — a set of APIs that
          give LLMs and AI agents direct, real-time access to high-quality web content. Unlike
          traditional search, it returns <strong>structured, citation-ready semantic data</strong>{' '}
          with passage-level retrieval, so you keep full control over how results feed your LLM
          workflow — improving answer quality while reducing token usage.
        </p>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Why developers ground with Web IQ
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {REASONS.map((reason) => (
              <li key={reason.title} className="rounded-xl bg-ink-50 p-3">
                <p className="text-sm font-semibold text-ink-900">{reason.title}</p>
                <p className="mt-1 text-xs leading-5 text-ink-600">{reason.detail}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            What you’re testing in this sandbox
          </h3>
          <ul className="space-y-2">
            {CAPABILITIES.map((capability) => (
              <li key={capability.name} className="flex gap-2 text-sm leading-6 text-ink-700">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                <span>
                  <strong className="text-ink-900">{capability.name}</strong> — {capability.detail}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-5 text-ink-500">
            For every run, this sandbox shows the live results, the raw JSON the API returns,
            ready-to-run <code className="font-mono">@microsoft/webiq</code> SDK code, and
            latency/telemetry — so you see exactly what your agent would receive.
          </p>
        </div>

        <p className="rounded-xl border border-ink-100 bg-ink-50 px-3 py-2 text-xs leading-5 text-ink-500">
          Web IQ is in <strong>limited-access preview</strong>. Calls are authenticated with a Web IQ
          API key and sent to <code className="font-mono">{API_BASE_URL}</code>. Learn more on the{' '}
          <a className="font-semibold text-brand-600 hover:underline" href={WEBIQ_URL} rel="noreferrer" target="_blank">
            official Web IQ page
          </a>{' '}
          or the{' '}
          <a className="font-semibold text-brand-600 hover:underline" href={NPM_URL} rel="noreferrer" target="_blank">
            <code className="font-mono">@microsoft/webiq</code> SDK
          </a>
          .
        </p>
      </div>
    </details>
  );
}
