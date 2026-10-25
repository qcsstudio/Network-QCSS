"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileSearch, GitBranch, Layers3, Search, X } from "lucide-react";
import { categoryCatalog } from "@/lib/config-lens/categories";
import { matchesStatement, type ResultsIndex, type StatementGroup } from "@/lib/config-lens/results";
import styles from "./config-lens.module.css";

const groupPageSize = 24;
function Group({ group, onInspect, onObject }: { group: StatementGroup; onInspect: (group: StatementGroup) => void; onObject: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const unknown = group.lines.filter(l => l.status === "unknown").length;
  return <details className={styles.categoryGroup} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary><span><strong>{group.entry || group.section}</strong><small>{group.entry ? group.section : categoryCatalog[group.category].label} / {group.scope}</small></span><span className={styles.groupCount}>{group.lines.length} statements{unknown > 0 && <span className={styles.reviewBadge}>{unknown} need review</span>}</span></summary>
    {open && <div className={styles.groupBody}>
      <div className={styles.toolbar}><button type="button" onClick={() => onInspect(group)}><FileSearch size={17} aria-hidden="true" />Open all statements</button>{group.entityId && <button type="button" onClick={() => onObject(group.entityId!)}><GitBranch size={17} aria-hidden="true" />View relationships</button>}</div>
      {group.lines.slice(0, 10).map(line => <div key={line.line} className={styles.groupStatement}><div className={styles.lineMeta}><span>L{line.line}</span><span className={line.status === "unknown" ? styles.reviewBadge : styles.badge}>{line.status === "unknown" ? "Needs review" : line.status}</span></div><code>{line.text.length > 4096 ? "Long statement: open all statements to read the complete text." : line.text}</code><p>{line.explanation.length > 4096 ? "Open all statements for the complete explanation." : line.explanation}</p></div>)}
      {group.lines.length > 10 && <p>{group.lines.length - 10} more statements in this group. <button type="button" onClick={() => onInspect(group)}>Open all {group.lines.length}</button></p>}
    </div>}
  </details>;
}
export function ConfigLensCategories({ index, onInspect, onObject }: { index: ResultsIndex; onInspect: (group: StatementGroup) => void; onObject: (id: string) => void }) {
  const [category, setCategory] = useState("all"), [scope, setScope] = useState("all"), [status, setStatus] = useState("all"), [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => index.groups.filter(group => group.lines.some(line => matchesStatement(line, { category, scope, status, query: deferredQuery }))), [index, category, scope, status, deferredQuery]);
  function choose(value: string) { setCategory(value); setPage(0); }
  const selected = index.categories.find(c => c === category);
  const stats = selected ? index.stats.get(selected) : undefined;
  return <div className={styles.categoryWorkspace}>
    <nav className={styles.categoryNav} aria-label="Configuration categories">
      <div className={styles.categoryNavTitle}><Layers3 size={18} aria-hidden="true" /><strong>Configuration categories</strong></div>
      <button type="button" aria-current={category === "all" ? "true" : undefined} onClick={() => choose("all")}><span>All categories</span><span>{index.lines.size.toLocaleString()}</span></button>
      {index.categories.map(c => <button type="button" key={c} aria-current={category === c ? "true" : undefined} onClick={() => choose(c)}><span>{categoryCatalog[c].label}</span><span>{index.stats.get(c)!.total.toLocaleString()}</span></button>)}
    </nav>
    <div className={styles.categoryContent}>
      <label className={styles.mobileCategories}>Configuration category<select value={category} onChange={e => choose(e.target.value)}><option value="all">All categories ({index.lines.size})</option>{index.categories.map(c => <option key={c} value={c}>{categoryCatalog[c].label} ({index.stats.get(c)!.total})</option>)}</select></label>
      <h3>{selected ? categoryCatalog[selected].label : "Explore by function"}</h3>
      <p>{selected ? categoryCatalog[selected].purpose : "Every nonblank statement is grouped by its configured function, section and entry. Unrecognized settings remain visible as Needs review."}</p>
      {stats && <div className={styles.categoryStats}><span>{stats.explained} explained</span><span>{stats.unknown} need review</span><span>{stats.context} structural</span><span>{stats.masked} masked</span></div>}
      <div className={styles.resultFilters}>
        <label><span><Search size={15} aria-hidden="true" /> Search configuration</span><input value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} autoComplete="off" placeholder="Name, command or line" /></label>
        <label>Context / VDOM<select value={scope} onChange={e => { setScope(e.target.value); setPage(0); }}><option value="all">All contexts</option>{index.scopes.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Review status<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="all">All statuses</option><option value="explained">Explained</option><option value="unknown">Needs review</option><option value="context">Structure</option><option value="masked">Masked</option></select></label>
        <button type="button" className={styles.iconButton} title="Reset category filters" aria-label="Reset category filters" onClick={() => { choose("all"); setScope("all"); setStatus("all"); setQuery(""); }}><X size={18} /></button>
      </div>
      <p className={styles.resultCount} role="status">{filtered.length.toLocaleString()} matching groups. Filters find groups; opening a group retains its surrounding statements.</p>
      <div>{filtered.slice(page * groupPageSize, (page + 1) * groupPageSize).map(group => <Group key={group.id} group={group} onInspect={onInspect} onObject={onObject} />)}</div>
      {!filtered.length && <p>No groups match these filters.</p>}
      {filtered.length > groupPageSize && <nav className={styles.pagination} aria-label="Category group pages"><button type="button" title="Previous groups" aria-label="Previous groups" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={18} /></button><span>Page {page + 1} of {Math.ceil(filtered.length / groupPageSize)}</span><button type="button" title="Next groups" aria-label="Next groups" disabled={(page + 1) * groupPageSize >= filtered.length} onClick={() => setPage(p => p + 1)}><ChevronRight size={18} /></button></nav>}
      <p className={styles.classificationNote}>A category identifies a function, not verified behavior. No traffic, connectivity or vulnerability test is performed.</p>
    </div>
  </div>;
}
