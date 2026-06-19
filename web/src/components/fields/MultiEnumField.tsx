import type { ParamMeta } from '../../types/meta';

interface MultiEnumFieldProps {
  param: ParamMeta;
  value: string[];
  onChange: (value: string[]) => void;
}

export function MultiEnumField({ param, value, onChange }: MultiEnumFieldProps) {
  const toggle = (option: string) => {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  };

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink-800 dark:text-ink-200">{param.label}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {(param.options ?? []).map((option) => (
          <label className="flex items-center gap-2 border border-ink-200 bg-white px-3 py-2 dark:border-ink-700 dark:bg-ink-900" key={option}>
            <input
              checked={value.includes(option)}
              className="h-4 w-4 border-ink-300 text-brand-600 focus:ring-brand-500 dark:border-ink-600 dark:bg-ink-900"
              onChange={() => toggle(option)}
              type="checkbox"
            />
            <span className="text-sm text-ink-700 dark:text-ink-300">{param.optionLabels?.[option] ?? option}</span>
          </label>
        ))}
      </div>
      {param.description ? <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{param.description}</p> : null}
    </fieldset>
  );
}
