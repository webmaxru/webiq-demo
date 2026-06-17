import type { WebIQClient } from '@microsoft/webiq';
import type { EndpointMeta, ParamMeta } from '../contract';
import { resolveEnumValue } from '../webiqClient';

export type ParamDescriptor = ParamMeta;

export interface EndpointDescriptor extends Omit<EndpointMeta, 'params'> {
  params: ParamDescriptor[];
  invoke(
    client: WebIQClient,
    input: string,
    opts: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<any>;
}

export function toMeta(descriptor: EndpointDescriptor): EndpointMeta {
  return {
    id: descriptor.id,
    label: descriptor.label,
    description: descriptor.description,
    kind: descriptor.kind,
    inputLabel: descriptor.inputLabel,
    inputPlaceholder: descriptor.inputPlaceholder,
    resultKey: descriptor.resultKey,
    params: descriptor.params,
  };
}

export function buildSdkOptions(
  params: ParamDescriptor[],
  opts: Record<string, unknown>,
  signal: AbortSignal,
): Record<string, unknown> {
  const sdkOptions: Record<string, unknown> = { signal };

  for (const param of params) {
    const value = opts[param.name];
    if (value === undefined) {
      continue;
    }

    if (param.enumImport) {
      const enumValue = resolveEnumValue(param.enumImport, value);
      if (enumValue !== undefined) {
        sdkOptions[param.name] = enumValue;
      }
      continue;
    }

    sdkOptions[param.name] = value;
  }

  return sdkOptions;
}
