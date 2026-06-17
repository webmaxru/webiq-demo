import type { ParamMeta } from '../../types/meta';

interface BooleanFieldProps {
  param: ParamMeta;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function BooleanField({ param, value, onChange }: BooleanFieldProps) {
  const id = `param-${param.name}`;

  return (
    <label className="flex items-start gap-3 rounded-xl border border-ink-200 bg-ink-50 p-3" htmlFor={id}>
      <input
        checked={value}
        className="mt-1 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        id={id}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>
        <span className="block text-sm font-semibold text-ink-800">{param.label}</span>
        {param.description ? <span className="mt-1 block text-xs text-ink-500">{param.description}</span> : null}
      </span>
    </label>
  );
}
