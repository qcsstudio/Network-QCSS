import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { CATALOG_REVIEWED, LENS_VERSION, profiles } from "./catalog";

export const updateSources = [
  { id: "cisco-psirt", vendor: "Cisco", kind: "advisories", url: "https://sec.cloudapps.cisco.com/security/center/psirtrss20/CiscoSecurityAdvisory.xml" },
  { id: "fortinet-psirt", vendor: "Fortinet", kind: "advisories", url: "https://filestore.fortinet.com/fortiguard/rss/ir.xml" },
  { id: "fortinet-firmware", vendor: "Fortinet", kind: "firmware", url: "https://pub.kb.fortinet.com/rss/firmware.xml" },
  ...Array.from(new Map(profiles.map(p => [p.source, { id: `docs-${p.id}`, vendor: p.vendor === "cisco" ? "Cisco" : "Fortinet", kind: "documentation", url: p.id === "cisco-nexus" ? "https://www.cisco.com/c/en/us/td/docs/dcn/nx-os/nexus9000/104x/unicast-routing-configuration/cisco-nexus-9000-series-nx-os-unicast-routing-configuration-guide/m_configuring_layer_3_virtualization.html" : p.source }])).values())
];
type FeedItem = { title: string; url: string; date: string };
export type SourceCheck = { id: string; vendor: string; kind: string; url: string; status: "checked" | "unavailable"; fingerprint?: string; bytes?: number; items: FeedItem[]; message: string };
export type VendorUpdateReport = { schemaVersion: 1; checkedAt: string; catalogReviewed: string; engine: string; activation: "review-required"; sources: SourceCheck[] };
const maxBytes = 2 * 1024 * 1024;
const allowedHosts = new Set(["sec.cloudapps.cisco.com", "www.cisco.com", "docs.fortinet.com", "filestore.fortinet.com", "pub.kb.fortinet.com", "community.fortinet.com"]);
export function allowedSourceUrl(value: string) {
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && (!u.port || u.port === "443") && allowedHosts.has(u.hostname); } catch { return false; }
}
function safeItemUrl(value: unknown) {
  if (typeof value !== "string") return "";
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && (!u.port || u.port === "443") && /^(?:[a-z0-9-]+\.)*(?:cisco\.com|fortinet\.com|fortiguard\.com)$/.test(u.hostname) ? u.href : ""; } catch { return ""; }
}
const clean = (value: unknown, max = 300) => typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
export function parseUpdateFeed(xml: string): FeedItem[] {
  if (Buffer.byteLength(xml) > maxBytes || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Unsafe or oversized feed.");
  if (XMLValidator.validate(xml) !== true) throw new Error("Invalid XML feed.");
  const data = new XMLParser({ processEntities: false, ignoreAttributes: false, parseTagValue: false }).parse(xml);
  if (!data.rss?.channel) throw new Error("Expected an RSS feed, not an HTML error or login page.");
  const items = data.rss.channel.item;
  return (Array.isArray(items) ? items : items ? [items] : []).slice(0, 60).map((item: Record<string, unknown>) => ({ title: clean(item.title), url: safeItemUrl(item.link), date: clean(item.pubDate, 100) })).filter((item: FeedItem) => item.title && item.url);
}
export async function readBounded(response: Response) {
  if (Number(response.headers.get("content-length") || 0) > maxBytes || !response.body) throw new Error("Response exceeds the size limit or has no body.");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("Response exceeds the size limit.");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString("utf8");
}
export async function checkSource(source: typeof updateSources[number], fetcher: typeof fetch = fetch): Promise<SourceCheck> {
  try {
    let url = source.url; let response: Response | undefined;
    const signal = AbortSignal.timeout(12000);
    for (let count = 0; count < 4; count++) {
      if (!allowedSourceUrl(url)) throw new Error("Source or redirect is not allowlisted.");
      response = await fetcher(url, { redirect: "manual", cache: "no-store", signal, headers: { "User-Agent": "QCS-ConfigLens-SourceReview/1.0", Accept: "application/rss+xml, application/xml, text/xml, text/html, */*;q=0.1" } });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location"); await response.body?.cancel();
      if (!location || count === 3) throw new Error("Source redirect could not be verified.");
      url = new URL(location, url).href;
    }
    if (!response?.ok) throw new Error(`Vendor returned HTTP ${response?.status || "unavailable"}.`);
    const text = await readBounded(response);
    const items = source.kind === "documentation" ? [] : parseUpdateFeed(text);
    if (source.kind === "documentation" && (!/<html|<!doctype html/i.test(text) || /<title[^>]*>\s*(?:access denied|just a moment|sign in|forbidden)/i.test(text))) throw new Error("Documentation was blocked or did not return a public HTML page.");
    return { ...source, status: "checked", fingerprint: createHash("sha256").update(text).digest("hex"), bytes: Buffer.byteLength(text), items, message: source.kind === "documentation" ? "Public documentation retrieved. A changed fingerprint is a review signal, not proof of a new OS version." : "Feed retrieved. Entries require product/version applicability review; none have been applied to the parser." };
  } catch (error) { return { ...source, status: "unavailable", items: [], message: error instanceof Error && /^(?:Vendor returned|Source|Documentation|Expected|Invalid XML|Unsafe|Response)/.test(error.message) ? error.message : "Source could not be read within the bounded request. No cached success is being substituted." }; }
}
export async function collectVendorUpdates(): Promise<VendorUpdateReport> {
  return { schemaVersion: 1, checkedAt: new Date().toISOString(), catalogReviewed: CATALOG_REVIEWED, engine: LENS_VERSION, activation: "review-required", sources: await Promise.all(updateSources.map(source => checkSource(source))) };
}
