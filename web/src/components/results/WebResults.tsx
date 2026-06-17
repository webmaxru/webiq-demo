import { GenericCards, type JsonRecord } from './GenericCards';

export function WebResults({ data }: { data: JsonRecord }) {
  return <GenericCards items={data.webResults} />;
}
