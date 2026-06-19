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
  return (
    <aside className="card overflow-hidden lg:sticky lg:top-4">
      <div className="border-b border-ink-200 px-4 py-3 dark:border-ink-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">Menu</h2>
      </div>
      <nav className="flex gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">
        <button
          className={`min-w-48 px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-500 ${
            homeSelected
              ? 'bg-brand-600 text-white'
              : 'text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'
          }`}
          onClick={onSelectHome}
          type="button"
        >
          <span className="block text-sm font-semibold">What is Web IQ?</span>
          <span className={`mt-1 block line-clamp-2 text-xs ${homeSelected ? 'text-blue-100' : 'text-ink-500 dark:text-ink-400'}`}>
            Overview &amp; how this sandbox works
          </span>
        </button>
        {endpoints.map((endpoint) => {
          const selected = !homeSelected && endpoint.id === selectedId;

          return (
            <button
              className={`min-w-48 px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                selected
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'
              }`}
              key={endpoint.id}
              onClick={() => onSelect(endpoint)}
              type="button"
            >
              <span className="block text-sm font-semibold">{endpoint.label}</span>
              <span className={`mt-1 block line-clamp-2 text-xs ${selected ? 'text-blue-100' : 'text-ink-500 dark:text-ink-400'}`}>
                {endpoint.description}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
