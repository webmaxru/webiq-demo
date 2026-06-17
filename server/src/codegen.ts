import type { EndpointDescriptor, ParamDescriptor } from './endpoints/types';
import { enumMemberName } from './webiqClient';

function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function renderValue(param: ParamDescriptor, value: unknown, enumImports: Set<string>): string {
  if (param.enumImport && typeof value === 'string') {
    const memberName = enumMemberName(param.enumImport, value);
    if (memberName) {
      enumImports.add(param.enumImport);
      return `${param.enumImport}.${memberName}`;
    }
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => quote(String(item))).join(', ')}]`;
  }

  if (typeof value === 'string') {
    return quote(value);
  }

  return String(value);
}

function renderOptions(
  descriptor: EndpointDescriptor,
  opts: Record<string, unknown>,
  enumImports: Set<string>,
): string {
  const lines = descriptor.params
    .filter((param) => opts[param.name] !== undefined)
    .map((param) => `  ${param.name}: ${renderValue(param, opts[param.name], enumImports)},`);

  if (lines.length === 0) {
    return '{}';
  }

  return `{
${lines.join('\n')}
}`;
}

export function generateSnippet(
  descriptor: EndpointDescriptor,
  input: string,
  opts: Record<string, unknown>,
): string {
  const enumImports = new Set<string>();
  const options = renderOptions(descriptor, opts, enumImports);
  const imports = ['WebIQClient', ...Array.from(enumImports).sort()].join(', ');
  const resource = descriptor.id === 'browse' ? 'browse.fetch' : `${descriptor.id}.search`;
  const resultExpression = descriptor.resultKey
    ? `response.${descriptor.resultKey} ?? response`
    : 'response';

  return [
    `import { ${imports} } from '@microsoft/webiq';`,
    '',
    `const client = new WebIQClient({ apiKey: process.env.WEBIQ_API_KEY });`,
    '',
    'async function main() {',
    `  const response = await client.${resource}(${quote(input)}, ${options});`,
    `  console.log(${resultExpression});`,
    '  await client.close();',
    '}',
    '',
    'void main();',
  ].join('\n');
}
