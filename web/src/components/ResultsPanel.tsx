import type { EndpointMeta, SearchResponse } from '../types/meta';
import { BrowseResult } from './results/BrowseResult';
import { ClassicResults } from './results/ClassicResults';
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

  if (endpoint.id === 'web') {
    return <WebResults data={data} />;
  }

  if (endpoint.id === 'news') {
    return <NewsResults data={data} />;
  }

  if (endpoint.id === 'videos') {
    return <VideoResults data={data} />;
  }

  if (endpoint.id === 'images') {
    return <ImageResults data={data} />;
  }

  if (endpoint.id === 'browse') {
    return <BrowseResult data={data} />;
  }

  if (endpoint.id === 'classic') {
    return <ClassicResults data={data} />;
  }

  if (endpoint.resultKey) {
    return <GenericCards items={data[endpoint.resultKey]} />;
  }

  return (
    <pre className="max-h-96 overflow-auto bg-ink-950 p-4 text-xs text-ink-100">
      <code>{JSON.stringify(data, null, 2)}</code>
    </pre>
  );
}
