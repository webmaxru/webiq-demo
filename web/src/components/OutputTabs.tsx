import { useState } from 'react';
import type { EndpointMeta, SearchResponse } from '../types/meta';
import type { ParamsMap } from '../api/client';
import { CodeSnippet } from './CodeSnippet';
import { RawJsonViewer } from './RawJsonViewer';
import { ResultsPanel } from './ResultsPanel';
import { TelemetryPanel } from './TelemetryPanel';

interface OutputTabsProps {
  endpoint: EndpointMeta;
  input: string;
  params: ParamsMap;
  response?: SearchResponse;
}

type TabId = 'results' | 'raw' | 'code' | 'telemetry';

const tabs: { id: TabId; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'raw', label: 'Raw JSON' },
  { id: 'code', label: 'Code' },
  { id: 'telemetry', label: 'Telemetry' },
];

export function OutputTabs({ endpoint, input, params, response }: OutputTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('results');

  return (
    <section className="card overflow-hidden">
      <div className="flex gap-1 overflow-x-auto border-b border-ink-200 bg-ink-50 p-2 dark:border-ink-800 dark:bg-ink-950/40">
        {tabs.map((tab) => (
          <button
            className={`px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              activeTab === tab.id
                ? 'bg-white text-brand-700 dark:bg-ink-800 dark:text-brand-200'
                : 'text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100'
            }`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-4">
        {!response ? (
          <div className="border border-dashed border-ink-300 bg-white p-8 text-center text-sm text-ink-500 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400">
            Run an endpoint to inspect results, raw payloads, generated code, and telemetry.
          </div>
        ) : null}
        {response && activeTab === 'results' ? <ResultsPanel endpoint={endpoint} response={response} /> : null}
        {response && activeTab === 'raw' ? (
          <RawJsonViewer endpointId={endpoint.id} input={input} params={params} response={response} />
        ) : null}
        {response && activeTab === 'code' ? <CodeSnippet response={response} /> : null}
        {response && activeTab === 'telemetry' ? <TelemetryPanel response={response} /> : null}
      </div>
    </section>
  );
}
