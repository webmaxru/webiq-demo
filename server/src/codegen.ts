import type { EndpointDescriptor, ParamDescriptor } from './endpoints/types';
import { enumMemberName } from './webiqClient';

function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}'`;
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
  input: string,
): string {
  const identifierKey = descriptor.lookup ? String(opts.identifierType ?? 'productId') : undefined;
  const lines = descriptor.params
    .filter((param) => opts[param.name] !== undefined && (!descriptor.lookup || (param.name !== 'identifierType' && param.name !== identifierKey)))
    .map((param) => `  ${param.name}: ${renderValue(param, opts[param.name], enumImports)},`);

  if (identifierKey) {
    lines.unshift(`  ${identifierKey}: ${quote(input)},`);
  }
  lines.push('  timeout: 60_000,');

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
  const options = renderOptions(descriptor, opts, enumImports, input);
  const imports = ['WebIQClient', ...Array.from(enumImports).sort()].join(', ');
  const resource = descriptor.sdkMethod ?? (descriptor.id === 'browse' ? 'browse.fetch' : `${descriptor.id}.search`);
  const resultExpression = descriptor.resultKey
    ? `response.${descriptor.resultKey} ?? response`
    : 'response';

  return [
    `import { ${imports} } from '@microsoft/webiq';`,
    '',
    `const client = new WebIQClient({ apiKey: process.env.WEBIQ_API_KEY });`,
    '',
    'async function main() {',
    '  try {',
    `    const options = ${options};`,
    `    const response = await client.${resource}(${descriptor.lookup ? '' : `${quote(input)}, `}options);`,
    `    console.log(${resultExpression});`,
    '  } finally {',
    '    await client.close();',
    '  }',
    '}',
    '',
    'main().catch((error) => {',
    '  console.error(error);',
    '  process.exitCode = 1;',
    '});',
  ].join('\n');
}
