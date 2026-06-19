import type { ParamMeta } from '../../types/meta';

interface NumberFieldProps {
  param: ParamMeta;
  value: number | '';
  onChange: (value: number | '') => void;
}

export function NumberField({ param, value, onChange }: NumberFieldProps) {
  const id = `param-${param.name}`;

  return (
    <label className="block" htmlFor={id}>
      <span className="text-sm font-semibold text-ink-800 dark:text-ink-200">{param.label}</span>
      <input
        className="input mt-1"
        id={id}
        max={param.max}
        min={param.min}
        onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
        placeholder={param.placeholder}
        step={param.step}
        type="number"
        value={value}
      />
      {param.description ? <span className="mt-1 block text-xs text-ink-500 dark:text-ink-400">{param.description}</span> : null}
    </label>
  );
}
