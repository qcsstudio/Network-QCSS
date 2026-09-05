export const ccnaSourceLimit = 10;

export function canonicalCcnaSourceUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key)) url.searchParams.delete(key);
  }
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export const ccnaTrustedSourceHosts = ["cisco.com", "learningcontent.cisco.com", "learningnetwork.cisco.com", "docs.gns3.com", "ietf.org", "rfc-editor.org", "nist.gov", "wireshark.org"];

export function isTrustedCcnaSource(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && ccnaTrustedSourceHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// Work before strict schema validation so an over-budget draft can be repaired,
// without removing a cited source or substituting evidence for another claim.
export function consolidateCcnaCitations(value: unknown, allowedUrls: string[]) {
  const candidate: unknown = structuredClone(value);
  const issues: string[] = [];
  if (!record(candidate) || !Array.isArray(candidate.sources)) return { candidate, issues };
  const accepted = new Map(allowedUrls.filter(isTrustedCcnaSource).map((url) => [canonicalCcnaSourceUrl(url), canonicalCcnaSourceUrl(url)]));
  const bibliography = new Map<string, Record<string, unknown>>();
  const malformed: unknown[] = [];
  const required = new Set<string>();

  function verified(value: string, path: string) {
    if (!isTrustedCcnaSource(value)) {
      issues.push(`${path}: untrusted source URL: ${value}`);
      return null;
    }
    const url = accepted.get(canonicalCcnaSourceUrl(value));
    if (!url) issues.push(`${path}: unverified source URL: ${value}`);
    return url || null;
  }

  for (const [index, source] of candidate.sources.entries()) {
    if (!record(source) || typeof source.url !== "string") {
      malformed.push(source);
      continue;
    }
    const url = verified(source.url, `sources[${index}].url`);
    if (!url) {
      malformed.push(source);
      continue;
    }
    if (!bibliography.has(url)) bibliography.set(url, { ...source, url });
  }

  function reconcile(items: unknown, path: string, headingField: string) {
    if (!Array.isArray(items)) return;
    for (const [index, item] of items.entries()) {
      if (!record(item) || !Array.isArray(item.sourceUrls)) continue;
      item.sourceUrls = [...new Set(item.sourceUrls.map((sourceUrl, citationIndex) => {
        if (typeof sourceUrl !== "string") return sourceUrl;
        const url = verified(sourceUrl, `${path}[${index}].sourceUrls[${citationIndex}]`);
        if (!url) return sourceUrl;
        required.add(url);
        if (!bibliography.has(url)) bibliography.set(url, {
          label: `Technical source: ${new URL(url).hostname.replace(/^www\./, "")}`,
          url,
          supports: `Primary evidence for ${path}[${index}]: ${typeof item[headingField] === "string" ? item[headingField] : "the lesson explanation"}.`
        });
        return url;
      }))];
    }
  }
  reconcile(candidate.sections, "sections", "heading");
  if (record(candidate.visualStory)) reconcile(candidate.visualStory.stages, "visualStory.stages", "title");

  const cited = [...required].map((url) => bibliography.get(url)!);
  const uncited = [...bibliography].filter(([url]) => !required.has(url)).map(([, source]) => source);
  candidate.sources = [...cited, ...uncited.slice(0, Math.max(0, ccnaSourceLimit - cited.length)), ...malformed];
  if (required.size > ccnaSourceLimit) {
    issues.push(`The lesson cites ${required.size} distinct sources across its sections and visual stages; the shared bibliography allows ${ccnaSourceLimit}. Consolidate overlapping evidence only where a retained source supports the same claim, updating those claims and citations together. Never delete required evidence just to meet the limit. Cited URLs: ${[...required].join(", ")}`);
  }
  return { candidate, issues: [...new Set(issues)] };
}
