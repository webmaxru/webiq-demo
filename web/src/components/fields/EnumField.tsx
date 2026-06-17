import type { ParamMeta } from '../../types/meta';

interface EnumFieldProps {
  param: ParamMeta;
  value: string;
  onChange: (value: string) => void;
}

export function EnumField({ param, value, onChange }: EnumFieldProps) {
  const id = `param-${param.name}`;

  return (
    <label className="block" htmlFor={id}>
      <span className="text-sm font-semibold text-ink-800">{param.label}</span>
      <select className="input mt-1" id={id} onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">Default</option>
        {(param.options ?? []).map((option) => (
          <option key={option} value={option}>
            {param.optionLabels?.[option] ?? option}
          </option>
        ))}
      </select>
      {param.description ? <span className="mt-1 block text-xs text-ink-500">{param.description}</span> : null}
    </label>
  );
}
