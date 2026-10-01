export type AdvisoryArchiveQuery = { page?: string | number; q?: string; severity?: string; vendor?: string; sort?: string };
export type AdvisorySort = "priority" | "newest" | "vendor";
export const advisoryPageSize = 12;
const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, unrated: 4 };

export function archivePageNumber(value: unknown) {
  const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof number === "number" && Number.isSafeInteger(number) && number > 0 ? number : 1;
}

export function normalizeAdvisoryQuery(query: AdvisoryArchiveQuery = {}) {
  return {
    page: archivePageNumber(query.page),
    q: typeof query.q === "string" ? query.q.trim().slice(0, 200) : "",
    severity: query.severity && Object.hasOwn(severityRank, query.severity) ? query.severity : "all",
    vendor: typeof query.vendor === "string" && query.vendor.trim() ? query.vendor.trim().slice(0, 100) : "all",
    sort: (["priority", "newest", "vendor"].includes(query.sort || "") ? query.sort : "priority") as AdvisorySort
  };
}

export function advisoryArchiveHref(query: AdvisoryArchiveQuery = {}, page = archivePageNumber(query.page)) {
  const normalized = normalizeAdvisoryQuery(query);
  const params = new URLSearchParams();
  if (normalized.q) params.set("q", normalized.q);
  if (normalized.severity !== "all") params.set("severity", normalized.severity);
  if (normalized.vendor !== "all") params.set("vendor", normalized.vendor);
  if (normalized.sort !== "priority") params.set("sort", normalized.sort);
  if (page > 1) params.set("page", String(page));
  return `/security-advisories${params.size ? `?${params}` : ""}`;
}

type FilterableAdvisory = {
  id: string; title: string; vendor: string; summary: string; exploitationStatus: string;
  cves: string[]; products: string[]; severity: string; priorityScore: number; vendorPublishedAt: string;
};

export function advisoryArchivePage<T extends FilterableAdvisory>(advisories: T[], query: AdvisoryArchiveQuery = {}) {
  const normalized = normalizeAdvisoryQuery(query);
  const search = normalized.q.toLowerCase();
  const visible = advisories.filter((item) => {
    if (normalized.severity !== "all" && item.severity !== normalized.severity) return false;
    if (normalized.vendor !== "all" && item.vendor !== normalized.vendor) return false;
    return !search || [item.title, item.vendor, item.summary, item.exploitationStatus, ...item.cves, ...item.products].join(" ").toLowerCase().includes(search);
  }).sort((left, right) => {
    const severity = (severityRank[left.severity] ?? 4) - (severityRank[right.severity] ?? 4);
    const date = new Date(right.vendorPublishedAt).getTime() - new Date(left.vendorPublishedAt).getTime();
    if (normalized.sort === "newest") return date || left.id.localeCompare(right.id);
    if (normalized.sort === "vendor") return left.vendor.localeCompare(right.vendor) || severity || date || left.id.localeCompare(right.id);
    return right.priorityScore - left.priorityScore || severity || date || left.id.localeCompare(right.id);
  });
  const totalPages = Math.max(1, Math.ceil(visible.length / advisoryPageSize));
  const page = Math.min(normalized.page, totalPages);
  const start = (page - 1) * advisoryPageSize;
  return { items: visible.slice(start, start + advisoryPageSize), total: visible.length, totalPages, page, start };
}
