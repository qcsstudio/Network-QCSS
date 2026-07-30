const trustedEditorialHosts = [
  "apnic.net",
  "aws.amazon.com",
  "azure.microsoft.com",
  "cert-in.org.in",
  "checkpoint.com",
  "cisco.com",
  "cisa.gov",
  "cloud.google.com",
  "docs.cloud.google.com",
  "cloudapps.cisco.com",
  "cloudflare.com",
  "f5.com",
  "fortiguard.com",
  "fortinet.com",
  "googleblog.com",
  "ietf.org",
  "juniper.net",
  "microsoft.com",
  "mist.com",
  "ncsc.gov.uk",
  "nist.gov",
  "paloaltonetworks.com",
  "qcsstudio.com",
  "redhat.com",
  "ripe.net",
  "sans.edu",
  "talosintelligence.com",
  "ubuntu.com"
] as const;

function normalizedHost(value: string) {
  return value.toLowerCase().replace(/^www\./, "");
}

export function isTrustedEditorialUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = normalizedHost(url.hostname);
    return trustedEditorialHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

export function assertTrustedEditorialUrl(value: string) {
  if (!isTrustedEditorialUrl(value)) throw new Error("Editorial research requires an approved primary-source URL.");
  return value;
}

function decodeEditorialText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type EditorialEvidenceSource = {
  label: string;
  url: string;
  suppliedSummary?: string;
};

export type EditorialEvidence = EditorialEvidenceSource & {
  fetched: boolean;
  text: string;
};

export async function collectEditorialEvidence(sources: EditorialEvidenceSource[], maxSources = 4) {
  const unique = new Map<string, EditorialEvidenceSource>();
  for (const source of sources) {
    if (!isTrustedEditorialUrl(source.url) || unique.has(source.url)) continue;
    unique.set(source.url, source);
  }

  return Promise.all(
    [...unique.values()].slice(0, maxSources).map(async (source): Promise<EditorialEvidence> => {
      try {
        const response = await fetch(source.url, {
          cache: "no-store",
          headers: {
            accept: "text/html, application/json, application/xml, text/xml, application/rss+xml",
            "user-agent": "QCS-Editorial-Research/1.0 (+https://www.qcsstudio.com/resources)"
          },
          redirect: "follow",
          signal: AbortSignal.timeout(20_000)
        });
        if (!response.ok || !isTrustedEditorialUrl(response.url)) throw new Error(`Source returned HTTP ${response.status}.`);
        const contentType = response.headers.get("content-type")?.toLowerCase() || "";
        if (!/(text|json|xml|rss|atom)/.test(contentType)) throw new Error("Source did not return editorial text.");
        const body = await response.text();
        const text = decodeEditorialText(body).slice(0, 36_000);
        return {
          ...source,
          fetched: Boolean(text),
          text: text || source.suppliedSummary?.trim().slice(0, 6_000) || ""
        };
      } catch {
        return {
          ...source,
          fetched: false,
          text: source.suppliedSummary?.trim().slice(0, 6_000) || ""
        };
      }
    })
  );
}
