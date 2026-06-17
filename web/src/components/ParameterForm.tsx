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
    return <p className="text-sm text-ink-500">This endpoint has no extra parameters.</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Parameters</h3>
        <button className="text-sm font-semibold text-brand-600 hover:text-brand-700" onClick={onReset} type="button">
          Reset to defaults
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
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
    </section>
  );
}
