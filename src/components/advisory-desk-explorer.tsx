"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { advisoryArchiveHref, advisoryArchivePage, advisoryPageSize, normalizeAdvisoryQuery, type AdvisoryArchiveQuery, type AdvisorySort } from "@/lib/advisory-archive";
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
  image?: { url: string; altText: string } | null;
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

function exploitationConfirmed(value: string) {
  if (/no known|not aware|not known|no evidence/i.test(value)) return false;
  return /actively exploited|active exploitation|known exploited|exploitation confirmed|in the wild/i.test(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function AdvisoryDeskExplorer({ advisories, asOf, initialQuery = {} }: { advisories: PublicAdvisoryRecord[]; asOf: string; initialQuery?: AdvisoryArchiveQuery }) {
  const initial = normalizeAdvisoryQuery(initialQuery);
  const [query, setQuery] = useState(initial.q);
  const [severity, setSeverity] = useState(initial.severity);
  const [vendor, setVendor] = useState(initial.vendor);
  const [sort, setSort] = useState<AdvisorySort>(initial.sort);
  const [view, setView] = useState<AdvisoryView>("grid");
  const [page, setPage] = useState(initial.page);

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

  const archive = useMemo(() => advisoryArchivePage(advisories, { q: query, severity, vendor, sort, page }), [advisories, query, severity, sort, vendor, page]);

  function resetFilters() {
    setQuery("");
    setSeverity("all");
    setVendor("all");
    setSort("priority");
    setPage(1);
  }

  const { totalPages, page: currentPage, start: pageStart, items: pageItems, total } = archive;
  const pageHref = (next: number) => `${advisoryArchiveHref({ q: query, severity, vendor, sort }, next)}#latest-advisories`;

  return (
    <div className="advisory-desk-explorer">
      <div className="advisory-desk-metrics" aria-label="Current advisory desk summary">
        <article><AlertTriangle aria-hidden="true" /><span>Critical or high</span><strong>{metrics.urgent}</strong></article>
        <article><Radio aria-hidden="true" /><span>Exploitation reported</span><strong>{metrics.exploited}</strong></article>
        <article><ShieldCheck aria-hidden="true" /><span>Vendors tracked</span><strong>{metrics.vendors}</strong></article>
        <article><CheckCircle2 aria-hidden="true" /><span>Verified in 24 hours</span><strong>{metrics.verified}</strong></article>
      </div>

      <form action="/security-advisories#latest-advisories" method="get" className="advisory-desk-controls">
        <label className="advisory-desk-search">
          <span>Search the advisory desk</span>
          <div><Search aria-hidden="true" size={19} /><input name="q" maxLength={200} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="CVE, vendor, product, or vulnerability" type="search" value={query} /></div>
        </label>
        <label><span>Severity</span><select name="severity" onChange={(event) => { setSeverity(event.target.value); setPage(1); }} value={severity}><option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="unrated">Unrated</option></select></label>
        <label><span>Vendor</span><select name="vendor" onChange={(event) => { setVendor(event.target.value); setPage(1); }} value={vendor}><option value="all">All vendors</option>{vendors.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span>Order</span><select name="sort" onChange={(event) => { setSort(event.target.value as AdvisorySort); setPage(1); }} value={sort}><option value="priority">Highest priority</option><option value="newest">Newest disclosure</option><option value="vendor">Vendor A-Z</option></select></label>
        <div className="advisory-view-control" aria-label="Advisory view" role="group">
          <button aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")} title="Grid view" type="button"><Grid2X2 aria-hidden="true" size={18} /></button>
          <button aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")} title="List view" type="button"><List aria-hidden="true" size={19} /></button>
        </div>
        <button aria-label="Reset advisory filters" className="icon-button" onClick={resetFilters} title="Reset advisory filters" type="button"><SlidersHorizontal aria-hidden="true" size={18} /></button>
        <noscript><button className="button secondary" type="submit">Apply filters</button></noscript>
      </form>

      <div className="advisory-results-bar" aria-live="polite">
        <span><Activity aria-hidden="true" size={16} /> {total ? `Showing ${pageStart + 1}-${Math.min(pageStart + advisoryPageSize, total)} of ${total}` : "No advisories"}</span>
        <span>{sort === "priority" ? "Ordered by operational priority" : sort === "newest" ? "Ordered by disclosure date" : "Grouped by vendor"}</span>
      </div>

      {total ? (
        <div className={`advisory-command-list view-${view}`}>
          {pageItems.map((advisory, index) => {
            const exploited = exploitationConfirmed(advisory.exploitationStatus);
            const tags = [...advisory.cves, ...advisory.products].slice(0, 4);
            return (
              <article className={`advisory-command-card${advisory.image ? "" : " advisory-without-image"}`} key={advisory.id}>
                {advisory.image ? <Link className="advisory-command-media" href={`/security-advisories/${advisory.slug}`}>
                  <Image
                    alt={advisory.image.altText}
                    fill
                    priority={index < 2}
                    sizes={view === "list" ? "(max-width: 760px) 100vw, 320px" : "(max-width: 760px) 100vw, (max-width: 1180px) 50vw, 33vw"}
                    src={advisory.image.url}
                    unoptimized
                  />
                </Link> : null}
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
      {total > advisoryPageSize ? (
        <nav aria-label="Advisory pages" className="advisory-pagination">
          {currentPage > 1 ? <Link prefetch={false} href={pageHref(currentPage - 1)} rel="prev"><ChevronLeft aria-hidden="true" size={17} /> Previous</Link> : <span />}
          <span>Page {currentPage} of {totalPages}</span>
          {currentPage < totalPages ? <Link prefetch={false} href={pageHref(currentPage + 1)} rel="next">Next <ChevronRight aria-hidden="true" size={17} /></Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
