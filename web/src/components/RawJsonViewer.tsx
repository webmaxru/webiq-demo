import { useState } from 'react';
import type { SearchResponse } from '../types/meta';
import type { ParamsMap } from '../api/client';

interface RawJsonViewerProps {
  endpointId: string;
  input: string;
  params: ParamsMap;
  response: SearchResponse;
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(value, null, 2);

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="overflow-hidden border border-ink-200 bg-ink-950 dark:border-ink-800">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <h3 className="text-sm font-semibold text-white">{label}</h3>
        <button className="text-xs font-semibold text-blue-200 hover:text-white" onClick={copy} type="button">
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-96 overflow-auto p-4 text-xs leading-relaxed text-ink-100">
        <code>{json}</code>
      </pre>
    </div>
  );
}

export function RawJsonViewer({ endpointId, input, params, response }: RawJsonViewerProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <JsonBlock label="Request" value={{ endpointId, input, params }} />
      <JsonBlock label="Response" value={response.ok ? response.data : response} />
    </div>
  );
}
