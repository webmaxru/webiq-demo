import { useState } from 'react';
import type { EndpointMeta } from '../types/meta';

interface EndpointSidebarProps {
  endpoints: EndpointMeta[];
  selectedId?: string;
  onSelect: (endpoint: EndpointMeta) => void;
}

export function EndpointSidebar({ endpoints, selectedId, onSelect }: EndpointSidebarProps) {
  const [open, setOpen] = useState(false);
  const selected = endpoints.find((endpoint) => endpoint.id === selectedId);

  const handleSelect = (endpoint: EndpointMeta) => {
    onSelect(endpoint);
    setOpen(false);
  };

  return (
    <aside className="card overflow-hidden lg:sticky lg:top-4">
      <button
        aria-controls="endpoint-list"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 lg:hidden"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wide text-ink-500">Endpoint</span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-ink-900">
            {selected?.label ?? 'Choose an endpoint'}
          </span>
        </span>
        <svg
          aria-hidden="true"
          className={`h-5 w-5 shrink-0 text-ink-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="hidden border-b border-ink-200 px-4 py-3 lg:block">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Endpoints</h2>
      </div>

      <nav className={`${open ? 'block' : 'hidden'} border-t border-ink-200 p-3 lg:block lg:border-t-0`} id="endpoint-list">
        <ul className="flex flex-col gap-2">
          {endpoints.map((endpoint) => {
            const isSelected = endpoint.id === selectedId;

            return (
              <li key={endpoint.id}>
                <button
                  aria-current={isSelected ? 'true' : undefined}
                  className={`w-full rounded-xl px-3 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    isSelected ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-700 hover:bg-ink-100'
                  }`}
                  onClick={() => handleSelect(endpoint)}
                  type="button"
                >
                  <span className="block text-sm font-semibold">{endpoint.label}</span>
                  <span className={`mt-1 block line-clamp-2 text-xs ${isSelected ? 'text-blue-100' : 'text-ink-500'}`}>
                    {endpoint.description}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
