import type { EndpointDescriptor, ParamDescriptor } from './endpoints/types';
import { env } from './env';

export interface ValidationResultSuccess {
  input: string;
  opts: Record<string, unknown>;
}

export interface ValidationResultFailure {
  issues: string[];
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return undefined;
}

function coerceStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return undefined;
}

function validateParam(
  param: ParamDescriptor,
  value: unknown,
  issues: string[],
): unknown {
  if (isBlank(value)) {
    return undefined;
  }

  switch (param.type) {
    case 'string':
      if (typeof value !== 'string') {
        issues.push(`${param.name} must be a string.`);
        return undefined;
      }

      if (value.length > env.maxInputLength) {
        issues.push(
          `${param.name} exceeds the maximum length of ${env.maxInputLength} characters.`,
        );
        return undefined;
      }

      return value.trim();

    case 'number': {
      const numberValue = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(numberValue)) {
        issues.push(`${param.name} must be a number.`);
        return undefined;
      }

      if (param.min !== undefined && numberValue < param.min) {
        issues.push(`${param.name} must be at least ${param.min}.`);
      }

      if (param.max !== undefined && numberValue > param.max) {
        issues.push(`${param.name} must be at most ${param.max}.`);
      }

      return numberValue;
    }

    case 'boolean': {
      const booleanValue = coerceBoolean(value);
      if (booleanValue === undefined) {
        issues.push(`${param.name} must be a boolean.`);
      }
      return booleanValue;
    }

    case 'enum':
      if (typeof value !== 'string') {
        issues.push(`${param.name} must be one of: ${(param.options ?? []).join(', ')}.`);
        return undefined;
      }

      if (!param.options?.includes(value)) {
        issues.push(`${param.name} must be one of: ${(param.options ?? []).join(', ')}.`);
        return undefined;
      }

      return value;

    case 'multiEnum': {
      const values = coerceStringArray(value);
      if (!values) {
        issues.push(`${param.name} must be an array of strings.`);
        return undefined;
      }

      const invalid = values.filter((item) => !param.options?.includes(item));
      if (invalid.length > 0) {
        issues.push(`${param.name} contains invalid values: ${invalid.join(', ')}.`);
        return undefined;
      }

      return values;
    }
  }
}

export function validateAndCoerce(
  descriptor: EndpointDescriptor,
  input: unknown,
  rawParams: unknown,
): ValidationResultSuccess | ValidationResultFailure {
  const issues: string[] = [];
  const normalizedInput = typeof input === 'string' ? input.trim() : '';

  if (!normalizedInput) {
    issues.push(`${descriptor.inputLabel} is required.`);
  } else if (normalizedInput.length > env.maxInputLength) {
    issues.push(
      `${descriptor.inputLabel} exceeds the maximum length of ${env.maxInputLength} characters.`,
    );
  } else if (descriptor.kind === 'url') {
    try {
      const url = new URL(normalizedInput);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        issues.push('URL must start with http:// or https://.');
      }
    } catch {
      issues.push('URL must be a valid http:// or https:// URL.');
    }
  }

  const params = rawParams && typeof rawParams === 'object' && !Array.isArray(rawParams)
    ? (rawParams as Record<string, unknown>)
    : {};
  const opts: Record<string, unknown> = {};

  for (const param of descriptor.params) {
    const coerced = validateParam(param, params[param.name], issues);
    if (coerced !== undefined) {
      opts[param.name] = coerced;
    }
  }

  if (issues.length > 0) {
    return { issues };
  }

  return { input: normalizedInput, opts };
}
