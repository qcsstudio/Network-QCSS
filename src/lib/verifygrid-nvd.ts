import type { NormalizedObservation } from "@/lib/verifygrid-import-domain";

type NvdCve = {
  id?: string;
  published?: string;
  lastModified?: string;
  descriptions?: Array<{ lang?: string; value?: string }>;
  weaknesses?: Array<{ description?: Array<{ lang?: string; value?: string }> }>;
  metrics?: Record<string, Array<{ cvssData?: { baseScore?: number; baseSeverity?: string } }>>;
  configurations?: Array<{ nodes?: NvdNode[] }>;
  references?: Array<{ url?: string; tags?: string[] }>;
};

type NvdNode = { cpeMatch?: Array<{ vulnerable?: boolean; criteria?: string }>; nodes?: NvdNode[] };

export type NvdEvidence = {
  cve: string;
  description: string;
  published: string;
  lastModified: string;
  cvssScore?: number;
  severity: string;
  cwes: string[];
  cpes: string[];
  references: string[];
};

function metric(cve: NvdCve) {
  for (const key of ["cvssMetricV40", "cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]) {
    const item = cve.metrics?.[key]?.[0]?.cvssData;
    if (item?.baseScore !== undefined) return { cvssScore: item.baseScore, severity: String(item.baseSeverity || "").toLowerCase() };
  }
  return { cvssScore: undefined, severity: "" };
}

function collectCpes(nodes: NvdNode[] = [], result = new Set<string>()) {
  for (const node of nodes) {
    for (const match of node.cpeMatch || []) if (match.vulnerable && match.criteria) result.add(match.criteria);
    collectCpes(node.nodes || [], result);
  }
  return result;
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/\\([!"#$%&'()*+,./:;<=>?@[\]^`{|}~-])/g, "$1").replace(/[_-]+/g, " ").replace(/[^a-z0-9.]+/g, " ").trim();
}

function cpeParts(value: string) {
  const parts = value.split(":");
  return parts.length >= 6 ? { vendor: normalizeToken(parts[3] || ""), product: normalizeToken(parts[4] || ""), version: normalizeToken(parts[5] || "") } : null;
}

export function matchObservationToCpes(observation: Pick<NormalizedObservation, "service" | "title" | "rawMetadata">, cpes: string[]) {
  const evidence = normalizeToken(`${observation.service} ${observation.title} ${String(observation.rawMetadata.product || "")} ${String(observation.rawMetadata.vendor || "")} ${String(observation.rawMetadata.version || "")}`);
  const reportedVersion = normalizeToken(String(observation.rawMetadata.version || ""));
  const candidates = cpes.map((cpe) => ({ cpe, parts: cpeParts(cpe) })).filter((item): item is { cpe: string; parts: NonNullable<ReturnType<typeof cpeParts>> } => Boolean(item.parts));
  const matched = candidates.find(({ parts }) => {
    const productMatch = parts.product.length >= 3 && evidence.includes(parts.product);
    const vendorMatch = !parts.vendor || parts.vendor === "*" || evidence.includes(parts.vendor);
    const versionMatch = !reportedVersion || !parts.version || parts.version === "*" || reportedVersion === parts.version || evidence.includes(parts.version);
    return productMatch && vendorMatch && versionMatch;
  });
  if (matched) return { disposition: reportedVersion && matched.parts.version !== "*" ? "exact" : "candidate", cpe: matched.cpe, ...matched.parts };
  return { disposition: candidates.length ? "unmatched" : "not_available", cpe: "", vendor: "", product: "", version: "" };
}

async function fetchNvdCve(cve: string) {
  const url = new URL("https://services.nvd.nist.gov/rest/json/cves/2.0");
  url.searchParams.set("cveId", cve);
  const apiKey = process.env.NVD_API_KEY?.trim();
  const response = await fetch(url, {
    headers: { accept: "application/json", ...(apiKey ? { apiKey } : {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`NVD returned ${response.status} for ${cve}.`);
  const payload = await response.json() as { vulnerabilities?: Array<{ cve?: NvdCve }> };
  const record = payload.vulnerabilities?.[0]?.cve;
  if (!record) return null;
  const score = metric(record);
  return {
    cve,
    description: record.descriptions?.find((item) => item.lang === "en")?.value || "",
    published: record.published || "",
    lastModified: record.lastModified || "",
    cvssScore: score.cvssScore,
    severity: score.severity,
    cwes: [...new Set((record.weaknesses || []).flatMap((item) => item.description || []).filter((item) => item.lang === "en").map((item) => item.value || "").filter(Boolean))],
    cpes: [...collectCpes((record.configurations || []).flatMap((item) => item.nodes || []))].slice(0, 100),
    references: [...new Set((record.references || []).map((item) => item.url || "").filter(Boolean))].slice(0, 20)
  } satisfies NvdEvidence;
}

export async function fetchNvdEvidence(cves: string[]) {
  const apiKey = process.env.NVD_API_KEY?.trim();
  const limit = apiKey ? 25 : 3;
  const selected = [...new Set(cves.map((item) => item.toUpperCase()))].slice(0, limit);
  const records = new Map<string, NvdEvidence>();
  const errors: string[] = [];
  for (const [index, cve] of selected.entries()) {
    if (index) await new Promise((resolve) => setTimeout(resolve, apiKey ? 700 : 6500));
    try {
      const result = await fetchNvdCve(cve);
      if (result) records.set(cve, result);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `NVD lookup failed for ${cve}.`);
    }
  }
  return { records, errors, truncated: cves.length > selected.length };
}
