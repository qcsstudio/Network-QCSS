import { commandReferences, RULES_REVIEWED, type CommandReference } from "@/lib/config-lens/references";

export function ConfigLensReference({ reference }: { reference?: CommandReference }) {
  if (!reference) return null;
  const source = commandReferences[reference];
  return <small><a href={source.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Vendor reference: {source.title}</a> (reviewed {RULES_REVIEWED})</small>;
}
