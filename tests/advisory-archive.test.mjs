import assert from "node:assert/strict";
import test from "node:test";
import { advisoryArchiveHref, advisoryArchivePage, archivePageNumber, normalizeAdvisoryQuery } from "../src/lib/advisory-archive.ts";

const records = Array.from({ length: 301 }, (_, index) => ({
  id: `advisory-${String(index).padStart(4, "0")}`, title: `Advisory ${index}`, vendor: index % 2 ? "Cisco" : "Google Cloud",
  severity: index % 2 ? "high" : "critical", summary: "Patch the affected software.", exploitationStatus: "Not known",
  cves: [`CVE-2026-${1000 + index}`], products: ["Network appliance"], priorityScore: 80,
  vendorPublishedAt: "2026-10-01T12:00:00.000Z"
}));

test("every public record is reachable through deterministic archive pages, beyond 250 entries", () => {
  const first = advisoryArchivePage(records);
  assert.equal(first.totalPages, 26);
  const found = Array.from({ length: first.totalPages }, (_, page) => advisoryArchivePage(records, { page: page + 1 }).items).flat();
  assert.equal(found.length, 301);
  assert.equal(new Set(found.map((item) => item.id)).size, 301);
  assert.deepEqual(advisoryArchivePage([...records].reverse()).items, first.items);
});

test("archive page numbers reject negative, fractional and unsafe values", () => {
  for (const value of [undefined, NaN, Infinity, -4, 0, "1.5", "2junk", "-2", "9007199254740993", ["2"]]) assert.equal(archivePageNumber(value), 1);
  assert.equal(archivePageNumber("2"), 2);
  assert.equal(advisoryArchivePage(records, { page: 999 }).page, 26);
});

test("CVE, severity and vendor filtering are shared by server rendering and client interaction", () => {
  const result = advisoryArchivePage(records, { q: "CVE-2026-1001", severity: "high", vendor: "Cisco" });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, "advisory-0001");
  assert.equal(advisoryArchivePage(records, { q: "no results" }).totalPages, 1);
});

test("page links preserve filters, encode values, and avoid duplicate page-one URLs", () => {
  assert.equal(advisoryArchiveHref({}, 1), "/security-advisories");
  assert.equal(advisoryArchiveHref({}, 2), "/security-advisories?page=2");
  const query = { vendor: "Google Cloud", q: "CVE & patch", severity: "critical", sort: "newest" };
  const url = new URL(advisoryArchiveHref(query, 2), "https://www.qcsstudio.com");
  assert.equal(url.searchParams.get("vendor"), "Google Cloud");
  assert.equal(url.searchParams.get("q"), "CVE & patch");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(normalizeAdvisoryQuery({ sort: "invalid", severity: "invalid" }).sort, "priority");
});

test("newest ordering is chronological and has a stable tie-break", () => {
  const newer = { ...records[0], id: "newer", vendorPublishedAt: "2026-10-02T12:00:00Z" };
  assert.equal(advisoryArchivePage([...records, newer], { sort: "newest" }).items[0].id, "newer");
});
