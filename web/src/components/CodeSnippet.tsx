import { useState } from 'react';
import type { SearchResponse } from '../types/meta';

interface CodeSnippetProps {
  response: SearchResponse;
}

export function CodeSnippet({ response }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);
  const snippet = response.ok ? response.snippet : '// Fix the request error to generate a runnable SDK snippet.';

  const copy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-600">Install: <code className="font-mono">npm i @microsoft/webiq</code></p>
      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-ink-950">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <h3 className="text-sm font-semibold text-white">SDK snippet</h3>
          <button className="text-xs font-semibold text-blue-200 hover:text-white" onClick={copy} type="button">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="max-h-96 overflow-auto p-4 text-xs leading-relaxed text-ink-100">
          <code>{snippet}</code>
        </pre>
      </div>
    </div>
  );
}
