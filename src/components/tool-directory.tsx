"use client";

import { ArrowUpRight, Cloud, Globe2, LayoutGrid, List, Network, Search, ShieldCheck, Terminal, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { filterDirectoryTools, type DirectoryTool } from "@/lib/tool-directory";

function categoryIcon(category: string) {
  if (/automation/i.test(category)) return Terminal;
  if (/cloud/i.test(category)) return Cloud;
  if (/security|firewall|vpn|threat/i.test(category)) return ShieldCheck;
  if (/dns|website|email/i.test(category)) return Globe2;
  return Network;
}

export function ToolDirectory({ tools }: { tools: DirectoryTool[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [order, setOrder] = useState("priority");
  const [view, setView] = useState<"grid" | "list">("grid");
  const categories = [...new Set(tools.map((tool) => tool.category))].sort();
  const visible = filterDirectoryTools(tools, query, category, order);
  const reset = () => { setQuery(""); setCategory(""); setOrder("priority"); };

  return (
    <div className="tool-directory">
      <div className="directory-toolbar">
        <div className="directory-search"><label htmlFor="directory-query">Search tools</label><div><Search size={19} aria-hidden="true" /><input id="directory-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a network tool" aria-controls="directory-results" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear tool search" title="Clear search"><X size={18} aria-hidden="true" /></button>}</div></div>
        <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)} aria-controls="directory-results"><option value="">All categories</option>{categories.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
        <label><span>Sort by</span><select value={order} onChange={(event) => setOrder(event.target.value)}><option value="priority">Recommended</option><option value="name">Name A-Z</option></select></label>
        <div className="directory-view" role="group" aria-label="Tool display">
          <button type="button" title="Grid view" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={19} aria-hidden="true" /></button>
          <button type="button" title="List view" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={19} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="directory-summary"><p role="status">{visible.length} of {tools.length} tools</p>{(query || category) && <button type="button" onClick={reset}>Clear filters <X size={14} aria-hidden="true" /></button>}</div>
      <div id="directory-results" className={`directory-results is-${view}`}>
        {visible.map((tool) => {
          const Icon = categoryIcon(tool.category);
          return <Link className="directory-tool" key={tool.slug} href={`/network-tools/${tool.slug}`}>
            <div className="directory-tool-heading"><span className="directory-tool-icon"><Icon size={22} aria-hidden="true" /></span><span className="directory-tool-category">{tool.category.replace(/ tools$/i, "")}</span><ArrowUpRight size={18} aria-hidden="true" /></div>
            <h3>{tool.title}</h3><p>{tool.description}</p><span className="directory-tool-action">Open tool <ArrowUpRight size={16} aria-hidden="true" /></span>
          </Link>;
        })}
      </div>
      {!visible.length && <div className="directory-empty"><Search size={30} aria-hidden="true" /><h3>No matching tools</h3><p>Try another keyword or category.</p><button className="button secondary" type="button" onClick={reset}>Reset filters</button></div>}
    </div>
  );
}
