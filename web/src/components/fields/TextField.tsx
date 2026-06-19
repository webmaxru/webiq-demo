import type { ParamMeta } from '../../types/meta';

interface TextFieldProps {
  param: ParamMeta;
  value: string;
  onChange: (value: string) => void;
}

export function TextField({ param, value, onChange }: TextFieldProps) {
  const id = `param-${param.name}`;

  return (
    <label className="block" htmlFor={id}>
      <span className="text-sm font-semibold text-ink-800 dark:text-ink-200">{param.label}</span>
      <input
        className="input mt-1"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={param.placeholder}
        type="text"
        value={value}
      />
      {param.description ? <span className="mt-1 block text-xs text-ink-500 dark:text-ink-400">{param.description}</span> : null}
    </label>
  );
}
