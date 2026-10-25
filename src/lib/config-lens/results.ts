import type { Analysis, Explanation, Relationship } from "./engine";
import { categoryOrder, type Category } from "./categories";

export type StatementGroup = {
  id: string; category: Category; scope: string; section: string; entry: string;
  entityId?: string; lines: Explanation[];
};
export type StatementFilters = { category?: string; scope?: string; status?: string; query?: string; groupId?: string };
export function groupId(line: Explanation) {
  return JSON.stringify([line.category, line.scope, line.section, line.blockLine]);
}
export function matchesStatement(line: Explanation, filters: StatementFilters) {
  if (filters.category && filters.category !== "all" && line.category !== filters.category) return false;
  if (filters.scope && filters.scope !== "all" && line.scope !== filters.scope) return false;
  if (filters.status && filters.status !== "all" && line.status !== filters.status) return false;
  if (filters.groupId && groupId(line) !== filters.groupId) return false;
  const query = filters.query?.trim().toLowerCase();
  return !query || `${line.text} ${line.explanation} ${line.section} ${line.entry} L${line.line}`.toLowerCase().includes(query);
}

// Build once per analysis: category browsing and reverse-reference navigation stay linear.
export function buildResultsIndex(analysis: Analysis) {
  const groups = new Map<string, StatementGroup>();
  const stats = new Map<Category, { total: number; explained: number; unknown: number; context: number; masked: number }>();
  const scopes = new Set<string>();
  const lines = new Map<number, Explanation>();
  const entities = new Map(analysis.entities.map(e => [e.id, e]));
  const outgoing = new Map<string, Relationship[]>(), incoming = new Map<string, Relationship[]>();
  for (const line of analysis.lines) {
    lines.set(line.line, line); scopes.add(line.scope);
    const stat = stats.get(line.category) || { total: 0, explained: 0, unknown: 0, context: 0, masked: 0 };
    stat.total++; stat[line.status]++; stats.set(line.category, stat);
    const id = groupId(line);
    const group = groups.get(id) || { id, category: line.category, scope: line.scope, section: line.section, entry: line.entry, entityId: line.entityId, lines: [] };
    group.lines.push(line); groups.set(id, group);
  }
  for (const reference of analysis.relationships) {
    const from = outgoing.get(reference.from) || []; from.push(reference); outgoing.set(reference.from, from);
    if (reference.to) { const to = incoming.get(reference.to) || []; to.push(reference); incoming.set(reference.to, to); }
  }
  return { groups: [...groups.values()], categories: categoryOrder.filter(c => stats.has(c)), stats, scopes: [...scopes], lines, entities, outgoing, incoming };
}
export type ResultsIndex = ReturnType<typeof buildResultsIndex>;

const roles: Record<string, string> = {
  srcintf: "Incoming interface match", dstintf: "Outgoing interface match", srcaddr: "Source address match",
  dstaddr: "Destination address match", service: "Service match", member: "Group member", device: "Exit interface",
  interface: "Parent interface", phase1name: "Parent VPN peer", vserver: "Virtual server", "server-pool": "Backend pool"
};
export function referenceRole(reference: Relationship) { return roles[reference.role || ""] || reference.role || `${reference.kind} reference`; }
