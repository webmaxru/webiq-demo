import type { EndpointMeta } from '../types/meta';

const LEARN = 'https://learn.microsoft.com/web-iq';
const ANNOUNCEMENT = 'https://techcommunity.microsoft.com/blog/azuredevcommunityblog/whats-new-with-web-iq-ignite-2026-edition/4574183';
const scenarios = [
  { id: 'auto', title: 'Ask once. Retrieve across sources.', detail: 'Auto returns evidence with per-result citations. Switch to Advanced for questions that need iterative retrieval.' },
  { id: 'weather', title: 'Plan with live weather and local time.', detail: 'Inspect conditions, forecasts, weather alerts and time zones as structured data, with units and source attribution.' },
  { id: 'places', title: 'Explore the world around a location.', detail: 'Find places with addresses, opening hours, reviews, photos, amenities and useful actions.' },
  { id: 'commerce', title: 'Compare products and merchant offers.', detail: 'Private preview: search products, then look up offers and product details with the identifiers returned.' },
];

export function AboutWebIQ({ endpoints, onSelect }: { endpoints: EndpointMeta[]; onSelect: (endpoint: EndpointMeta) => void }) {
  return (
    <section className="card space-y-7 p-6 sm:p-8">
      <header className="space-y-3">
        <span className="badge bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-600/20 dark:text-brand-100 dark:ring-brand-500/40">Ignite 2026 edition</span>
        <h2 className="text-3xl font-bold tracking-tight text-ink-950 dark:text-white sm:text-4xl">Fresh evidence for your next agent.</h2>
        <p className="text-sm leading-7 text-ink-700 dark:text-ink-300">
          Microsoft Web IQ grounds AI applications in the live web. Explore Auto and Auto Advanced,
          structured weather, Places, Commerce and specialized retrieval in one sandbox.
          Web IQ retrieves evidence, not a final AI answer; your model decides how to use it.
        </p>
        <a className="inline-block text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300" href={ANNOUNCEMENT} target="_blank" rel="noreferrer">Read the Ignite announcement</a>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {scenarios.map((scenario) => {
          const endpoint = endpoints.find((item) => item.id === scenario.id);
          return (
            <button key={scenario.id} className="space-y-2 border border-ink-200 p-4 text-left transition hover:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-ink-700 dark:hover:border-brand-400" onClick={() => endpoint && onSelect(endpoint)} type="button">
              <span className="block text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">{endpoint?.label}</span>
              <span className="block font-semibold text-ink-950 dark:text-white">{scenario.title}</span>
              <span className="block text-sm leading-6 text-ink-600 dark:text-ink-400">{scenario.detail}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 text-sm leading-6 text-ink-700 dark:text-ink-300">
        <h3 className="text-lg font-bold text-ink-950 dark:text-white">Specialized retrieval, updated</h3>
        <p>
          Web, News, Images and Videos retain fine-grained controls. Web and News now default to
          query-focused passages. Browse extracts passages from a known URL using a selection query;
          full-document text, HTML and Markdown require full document access on the server AppID.
          Classic Search has been replaced by Auto in the current SDK.
        </p>
        <p>Every request exposes rendered results, raw JSON, copyable TypeScript SDK code and request telemetry. The API key stays on the server.</p>
      </div>

      <div className="space-y-4 border-t border-ink-200 pt-5 text-sm leading-6 text-ink-700 dark:border-ink-700 dark:text-ink-300">
        <h3 className="text-lg font-bold text-ink-950 dark:text-white">Control sources. Understand access.</h3>
        <p><strong>Named Scopes:</strong> select a published scope in Web, News or Auto. Keep “Require scope” enabled to prevent unscoped fallback. Auto scopes affect only Web and News evidence. Scope management requires billing-account permissions and is intentionally not exposed through this public demo. <a className="text-brand-600 hover:underline dark:text-brand-300" href={`${LEARN}/guides/create-scopes`} target="_blank" rel="noreferrer">Scopes guide</a></p>
        <p><strong>Health-aware ranking:</strong> Web IQ automatically prioritizes credible sources for health-related questions. This is retrieval, not medical advice. Do not enter personal health information.</p>
        <p><strong>Premium Content:</strong> premium publisher content and bring-your-own licensed data require arrangements with Microsoft; this demo cannot grant publisher rights or enable them per request.</p>
        <p><strong>Zero Query Logging:</strong> a support-approved service setting, not a query toggle. The sandbox analytics opt-out does not disable Microsoft service logging. <a className="text-brand-600 hover:underline dark:text-brand-300" href={`${LEARN}/resources/faq#privacy-and-data-handling`} target="_blank" rel="noreferrer">Privacy and logging</a></p>
      </div>

      <details className="border border-ink-200 p-4 text-sm dark:border-ink-700">
        <summary className="cursor-pointer font-semibold text-ink-900 dark:text-ink-100">Connect your agent over MCP</summary>
        <p className="mt-3 leading-6 text-ink-600 dark:text-ink-300">Use your own key in your MCP client, never this demo’s server credential. Available tools depend on your AppID permissions. This configuration is an example, not a connection made by this page.</p>
        <pre className="mt-3 overflow-x-auto bg-ink-950 p-4 text-xs text-ink-100"><code>{JSON.stringify({
          servers: {
            WebIQ: {
              type: 'http',
              url: 'https://api.microsoft.ai/v3/mcp',
              headers: { 'x-apikey': '<your-api-key>' },
            },
          },
        }, null, 2)}</code></pre>
        <a className="mt-3 inline-block font-semibold text-brand-600 hover:underline dark:text-brand-300" href={`${LEARN}/integrations/mcp`} target="_blank" rel="noreferrer">MCP setup for VS Code and other clients</a>
      </details>

      <div className="space-y-2 border border-ink-200 bg-ink-50 p-4 text-xs leading-6 text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">
        <p><strong>Generally available:</strong> Auto, Web, News, Images, Videos, Places and Browse. Commerce is private preview and may return an access error for this demo’s AppID.</p>
        <p>Published API prices per 1,000 calls: Browse $1; Web, News, Images, Videos and Places $7; Auto $8; Advanced $9; Commerce preview $7. This shared sandbox is rate limited; pricing applies to your own Web IQ usage.</p>
        <div className="flex flex-wrap gap-4 font-semibold text-brand-600 dark:text-brand-300">
          <a className="hover:underline" href={`${LEARN}/get-started/quickstart`} target="_blank" rel="noreferrer">Get started</a>
          <a className="hover:underline" href={`${LEARN}/resources/pricing`} target="_blank" rel="noreferrer">Pricing</a>
          <a className="hover:underline" href="https://webiq.microsoft.ai/scopes" target="_blank" rel="noreferrer">Manage scopes</a>
          <a className="hover:underline" href="https://aka.ms/microsoft-webiq-support" target="_blank" rel="noreferrer">Access and support</a>
        </div>
      </div>
    </section>
  );
}
