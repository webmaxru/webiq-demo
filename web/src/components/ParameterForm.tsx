import type { ParamMeta } from '../types/meta';
import type { ParamsMap, ParamValue } from '../api/client';
import { BooleanField } from './fields/BooleanField';
import { EnumField } from './fields/EnumField';
import { MultiEnumField } from './fields/MultiEnumField';
import { NumberField } from './fields/NumberField';
import { TextField } from './fields/TextField';

interface ParameterFormProps {
  params: ParamMeta[];
  values: ParamsMap;
  onChange: (name: string, value: ParamValue | '') => void;
  onReset: () => void;
}

export function defaultParams(params: ParamMeta[]): ParamsMap {
  return params.reduce<ParamsMap>((accumulator, param) => {
    if (param.default !== undefined) {
      accumulator[param.name] = param.default;
    }

    return accumulator;
  }, {});
}

export function compactParams(values: ParamsMap): ParamsMap {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return value !== '';
    }),
  ) as ParamsMap;
}

export function ParameterForm({ params, values, onChange, onReset }: ParameterFormProps) {
  if (params.length === 0) {
    return <p className="text-sm text-ink-500 dark:text-ink-400">This endpoint has no extra parameters.</p>;
  }

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-500 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-ink-400 dark:hover:text-ink-100 dark:focus-visible:ring-offset-ink-950 [&::-webkit-details-marker]:hidden">
        <svg
          aria-hidden="true"
          className="h-4 w-4 transition-transform group-open:rotate-90"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Parameters
        <span className="normal-case tracking-normal text-ink-400 dark:text-ink-500">
          ({params.length})
        </span>
      </summary>
      <div className="mt-4 flex justify-end">
        <button
          className="text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300"
          onClick={onReset}
          type="button"
        >
          Reset to defaults
        </button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {params.map((param) => {
          const value = values[param.name];

          if (param.type === 'number') {
            return (
              <NumberField
                key={param.name}
                onChange={(nextValue) => onChange(param.name, nextValue)}
                param={param}
                value={typeof value === 'number' ? value : ''}
              />
            );
          }

          if (param.type === 'boolean') {
            return (
              <BooleanField
                key={param.name}
                onChange={(nextValue) => onChange(param.name, nextValue)}
                param={param}
                value={typeof value === 'boolean' ? value : false}
              />
            );
          }

          if (param.type === 'enum') {
            return (
              <EnumField
                key={param.name}
                onChange={(nextValue) => onChange(param.name, nextValue)}
                param={param}
                value={typeof value === 'string' ? value : ''}
              />
            );
          }

          if (param.type === 'multiEnum') {
            return (
              <MultiEnumField
                key={param.name}
                onChange={(nextValue) => onChange(param.name, nextValue)}
                param={param}
                value={Array.isArray(value) ? value : []}
              />
            );
          }

          return (
            <TextField
              key={param.name}
              onChange={(nextValue) => onChange(param.name, nextValue)}
              param={param}
              value={typeof value === 'string' ? value : ''}
            />
          );
        })}
      </div>
    </details>
  );
}
