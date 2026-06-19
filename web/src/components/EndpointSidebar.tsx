import { useState } from 'react';
import type { EndpointMeta } from '../types/meta';

interface EndpointSidebarProps {
  endpoints: EndpointMeta[];
  selectedId?: string;
  homeSelected: boolean;
  onSelect: (endpoint: EndpointMeta) => void;
  onSelectHome: () => void;
}

export function EndpointSidebar({
  endpoints,
  selectedId,
  homeSelected,
  onSelect,
  onSelectHome,
}: EndpointSidebarProps) {
  const [open, setOpen] = useState(false);
  const selected = endpoints.find((endpoint) => endpoint.id === selectedId);
  const currentLabel = homeSelected ? 'What is Web IQ?' : selected?.label ?? 'Choose an endpoint';

  const handleSelect = (endpoint: EndpointMeta) => {
    onSelect(endpoint);
    setOpen(false);
  };

  const handleSelectHome = () => {
    onSelectHome();
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
          <span className="block text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">Menu</span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-ink-900 dark:text-ink-100">
            {currentLabel}
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

      <div className="hidden border-b border-ink-200 px-4 py-3 dark:border-ink-800 lg:block">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">Menu</h2>
      </div>

      <nav
        className={`${open ? 'block' : 'hidden'} border-t border-ink-200 p-3 dark:border-ink-800 lg:block lg:border-t-0`}
        id="endpoint-list"
      >
        <ul className="flex flex-col gap-2">
          <li>
            <button
              aria-current={homeSelected ? 'true' : undefined}
              className={`w-full rounded-xl px-3 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                homeSelected
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'
              }`}
              onClick={handleSelectHome}
              type="button"
            >
              <span className="block text-sm font-semibold">What is Web IQ?</span>
              <span className={`mt-1 block line-clamp-2 text-xs ${homeSelected ? 'text-blue-100' : 'text-ink-500 dark:text-ink-400'}`}>
                Overview &amp; how this sandbox works
              </span>
            </button>
          </li>
          {endpoints.map((endpoint) => {
            const isSelected = !homeSelected && endpoint.id === selectedId;

            return (
              <li key={endpoint.id}>
                <button
                  aria-current={isSelected ? 'true' : undefined}
                  className={`w-full rounded-xl px-3 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'
                  }`}
                  onClick={() => handleSelect(endpoint)}
                  type="button"
                >
                  <span className="block text-sm font-semibold">{endpoint.label}</span>
                  <span className={`mt-1 block line-clamp-2 text-xs ${isSelected ? 'text-blue-100' : 'text-ink-500 dark:text-ink-400'}`}>
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
