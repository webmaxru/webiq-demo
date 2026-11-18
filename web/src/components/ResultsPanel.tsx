import type { EndpointMeta, SearchResponse } from '../types/meta';
import { BrowseResult } from './results/BrowseResult';
import { AutoResults } from './results/AutoResults';
import { CommerceResults } from './results/CommerceResults';
import { PlaceResults } from './results/PlaceResults';
import { GenericCards, type JsonRecord } from './results/GenericCards';
import { ImageResults } from './results/ImageResults';
import { NewsResults } from './results/NewsResults';
import { VideoResults } from './results/VideoResults';
import { WebResults } from './results/WebResults';

interface ResultsPanelProps {
  endpoint: EndpointMeta;
  response: SearchResponse;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

export function ResultsPanel({ endpoint, response }: ResultsPanelProps) {
  if (!response.ok) {
    return <GenericCards items={[]} />;
  }

  const data = response.data as unknown;

  if (!isRecord(data)) {
    return (
      <pre className="max-h-96 overflow-auto bg-ink-950 p-4 text-xs text-ink-100">
        <code>{JSON.stringify(data, null, 2)}</code>
      </pre>
    );
  }

  let results;
  if (endpoint.id === 'auto' || endpoint.id === 'weather') {
    results = <AutoResults data={data} />;
  } else if (endpoint.id.startsWith('commerce')) {
    results = <CommerceResults data={data} />;
  } else if (endpoint.id === 'places') {
    results = <PlaceResults data={data} />;
  } else if (endpoint.id === 'web') {
    results = <WebResults data={data} />;
  } else if (endpoint.id === 'news') {
    results = <NewsResults data={data} />;
  } else if (endpoint.id === 'videos') {
    results = <VideoResults data={data} />;
  } else if (endpoint.id === 'images') {
    results = <ImageResults data={data} />;
  } else if (endpoint.id === 'browse') {
    results = <BrowseResult data={data} />;
  } else {
    results = endpoint.resultKey ? <GenericCards items={data[endpoint.resultKey]} /> : null;
  }

  return (
    <div className="space-y-4">
      {typeof data.scopeApplied === 'boolean' ? (
        <p role="status" className={`border p-3 text-sm ${data.scopeApplied ? 'border-emerald-500 text-emerald-800 dark:text-emerald-300' : 'border-amber-500 text-amber-900 dark:text-amber-200'}`}>
          {data.scopeApplied ? 'Named scope applied for this request. This does not confirm the latest definition has propagated.' : 'Warning: named scope was NOT applied. These results are unscoped.'}
        </p>
      ) : null}
      {results}
    </div>
  );
}
