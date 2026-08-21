"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  List,
  Radio,
  Search,
  ShieldCheck,
  SlidersHorizontal
} from "lucide-react";

export type PublicAdvisoryRecord = {
  id: string;
  slug: string;
  title: string;
  vendor: string;
  summary: string;
  severity: string;
  status: string;
  priorityScore: number;
  cvssScore: number | null;
  cves: string[];
  products: string[];
  exploitationStatus: string;
  vendorPublishedAt: string;
  vendorUpdatedAt: string;
  lastVerifiedAt: string;
};

type AdvisoryView = "grid" | "list";
type AdvisorySort = "priority" | "newest" | "vendor";

const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, unrated: 4 };
const advisoryPageSize = 12;

function exploitationConfirmed(value: string) {
  if (/no known|not aware|not known|no evidence/i.test(value)) return false;
  return /actively exploited|active exploitation|known exploited|exploitation confirmed|in the wild/i.test(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function AdvisoryDeskExplorer({ advisories, asOf }: { advisories: PublicAdvisoryRecord[]; asOf: string }) {
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [vendor, setVendor] = useState("all");
  const [sort, setSort] = useState<AdvisorySort>("priority");
  const [view, setView] = useState<AdvisoryView>("grid");
  const [page, setPage] = useState(1);

  const vendors = useMemo(
    () => [...new Set(advisories.map((item) => item.vendor))].sort((left, right) => left.localeCompare(right)),
    [advisories]
  );
  const metrics = useMemo(() => ({
    urgent: advisories.filter((item) => item.severity === "critical" || item.severity === "high").length,
    exploited: advisories.filter((item) => exploitationConfirmed(item.exploitationStatus)).length,
    vendors: vendors.length,
    verified: advisories.filter((item) => new Date(asOf).getTime() - new Date(item.lastVerifiedAt).getTime() <= 24 * 60 * 60 * 1000).length
  }), [advisories, asOf, vendors.length]);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return advisories
      .filter((item) => {
        if (severity !== "all" && item.severity !== severity) return false;
        if (vendor !== "all" && item.vendor !== vendor) return false;
        if (!normalizedQuery) return true;
        return [item.title, item.vendor, item.summary, item.exploitationStatus, ...item.cves, ...item.products]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => {
        if (sort === "newest") return new Date(right.vendorPublishedAt).getTime() - new Date(left.vendorPublishedAt).getTime();
        if (sort === "vendor") return left.vendor.localeCompare(right.vendor) || severityRank[left.severity] - severityRank[right.severity];
        return right.priorityScore - left.priorityScore || severityRank[left.severity] - severityRank[right.severity];
      });
  }, [advisories, query, severity, sort, vendor]);

  function resetFilters() {
    setQuery("");
    setSeverity("all");
    setVendor("all");
    setSort("priority");
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(visible.length / advisoryPageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * advisoryPageSize;
  const pageItems = visible.slice(pageStart, pageStart + advisoryPageSize);

  return (
    <div className="advisory-desk-explorer">
      <div className="advisory-desk-metrics" aria-label="Current advisory desk summary">
        <article><AlertTriangle aria-hidden="true" /><span>Critical or high</span><strong>{metrics.urgent}</strong></article>
        <article><Radio aria-hidden="true" /><span>Exploitation reported</span><strong>{metrics.exploited}</strong></article>
        <article><ShieldCheck aria-hidden="true" /><span>Vendors tracked</span><strong>{metrics.vendors}</strong></article>
        <article><CheckCircle2 aria-hidden="true" /><span>Verified in 24 hours</span><strong>{metrics.verified}</strong></article>
      </div>

      <div className="advisory-desk-controls">
        <label className="advisory-desk-search">
          <span>Search the advisory desk</span>
          <div><Search aria-hidden="true" size={19} /><input onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="CVE, vendor, product, or vulnerability" type="search" value={query} /></div>
        </label>
        <label><span>Severity</span><select onChange={(event) => { setSeverity(event.target.value); setPage(1); }} value={severity}><option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="unrated">Unrated</option></select></label>
        <label><span>Vendor</span><select onChange={(event) => { setVendor(event.target.value); setPage(1); }} value={vendor}><option value="all">All vendors</option>{vendors.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span>Order</span><select onChange={(event) => { setSort(event.target.value as AdvisorySort); setPage(1); }} value={sort}><option value="priority">Highest priority</option><option value="newest">Newest disclosure</option><option value="vendor">Vendor A-Z</option></select></label>
        <div className="advisory-view-control" aria-label="Advisory view" role="group">
          <button aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")} title="Grid view" type="button"><Grid2X2 aria-hidden="true" size={18} /></button>
          <button aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")} title="List view" type="button"><List aria-hidden="true" size={19} /></button>
        </div>
        <button className="icon-button" onClick={resetFilters} title="Reset advisory filters" type="button"><SlidersHorizontal aria-hidden="true" size={18} /></button>
      </div>

      <div className="advisory-results-bar" aria-live="polite">
        <span><Activity aria-hidden="true" size={16} /> {visible.length ? `Showing ${pageStart + 1}-${Math.min(pageStart + advisoryPageSize, visible.length)} of ${visible.length}` : "No advisories"}</span>
        <span>{sort === "priority" ? "Ordered by operational priority" : sort === "newest" ? "Ordered by disclosure date" : "Grouped by vendor"}</span>
      </div>

      {visible.length ? (
        <div className={`advisory-command-list view-${view}`}>
          {pageItems.map((advisory, index) => {
            const exploited = exploitationConfirmed(advisory.exploitationStatus);
            const tags = [...advisory.cves, ...advisory.products].slice(0, 4);
            return (
              <article className="advisory-command-card" key={advisory.id}>
                <Link className="advisory-command-media" href={`/security-advisories/${advisory.slug}`}>
                  <Image
                    alt={`${advisory.vendor} ${advisory.severity} security advisory`}
                    fill
                    priority={index < 2}
                    sizes={view === "list" ? "(max-width: 760px) 100vw, 320px" : "(max-width: 760px) 100vw, (max-width: 1180px) 50vw, 33vw"}
                    src={`/security-advisories/${advisory.slug}/visual`}
                    unoptimized
                  />
                </Link>
                <div className="advisory-command-body">
                  <div className="advisory-command-kicker">
                    <span className={`severity-pill severity-${advisory.severity}`}>{advisory.severity}</span>
                    {exploited ? <span className="exploitation-pill"><Radio aria-hidden="true" size={13} /> Exploitation reported</span> : null}
                    {advisory.status === "withdrawn" ? <span className="status-pill content-status-withdrawn">Withdrawn</span> : null}
                  </div>
                  <p className="eyebrow">{advisory.vendor} / Priority {advisory.priorityScore}</p>
                  <h2><Link href={`/security-advisories/${advisory.slug}`}>{advisory.title}</Link></h2>
                  <p>{advisory.summary}</p>
                  <div className="advisory-tags">{tags.map((item) => <span key={item}>{item}</span>)}</div>
                  <dl className="advisory-command-facts">
                    <div><dt>Published</dt><dd>{formatDate(advisory.vendorPublishedAt)}</dd></div>
                    <div><dt>CVSS</dt><dd>{advisory.cvssScore ?? "Not scored"}</dd></div>
                    <div><dt>Verified</dt><dd>{formatDate(advisory.lastVerifiedAt)}</dd></div>
                  </dl>
                  <Link className="text-link" href={`/security-advisories/${advisory.slug}`}>Review evidence and action</Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="content-empty-state"><Search aria-hidden="true" size={28} /><strong>No matching advisories</strong><span>Try a broader vendor, product, severity, or CVE search.</span><button className="button secondary" onClick={resetFilters} type="button">View all advisories</button></div>
      )}
      {visible.length > advisoryPageSize ? (
        <nav aria-label="Advisory pages" className="advisory-pagination">
          <button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button"><ChevronLeft aria-hidden="true" size={17} /> Previous</button>
          <span>Page {currentPage} of {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button">Next <ChevronRight aria-hidden="true" size={17} /></button>
        </nav>
      ) : null}
    </div>
  );
}
