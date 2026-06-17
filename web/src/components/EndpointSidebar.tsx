import type { EndpointMeta } from '../types/meta';

interface EndpointSidebarProps {
  endpoints: EndpointMeta[];
  selectedId?: string;
  onSelect: (endpoint: EndpointMeta) => void;
}

export function EndpointSidebar({ endpoints, selectedId, onSelect }: EndpointSidebarProps) {
  return (
    <aside className="card overflow-hidden lg:sticky lg:top-4">
      <div className="border-b border-ink-200 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Endpoints</h2>
      </div>
      <nav className="flex gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">
        {endpoints.map((endpoint) => {
          const selected = endpoint.id === selectedId;

          return (
            <button
              className={`min-w-48 rounded-xl px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                selected ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-700 hover:bg-ink-100'
              }`}
              key={endpoint.id}
              onClick={() => onSelect(endpoint)}
              type="button"
            >
              <span className="block text-sm font-semibold">{endpoint.label}</span>
              <span className={`mt-1 block line-clamp-2 text-xs ${selected ? 'text-blue-100' : 'text-ink-500'}`}>
                {endpoint.description}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
