// Server/CLI read path; no client component imports this module.
import { createHash } from "node:crypto";
import manifest from "../content/editorial-static-manifest.json" with { type: "json" };

export type StaticMediaIdentity = {
  id: string; contentType: string; contentId: string; contentRevision: string; generatedAt: Date | null;
};
export type StaticMediaEntry = Omit<StaticMediaIdentity, "generatedAt"> & {
  generatedAt: string; variant: string; sha256: string; bytes: number; mimeType: string;
  width: number; height: number; path: string;
  importManifestHash?: string; sourceHash?: string;
};

export const staticMediaManifestHash = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
export const staticMediaImageIds = [...new Set(manifest.entries.map(entry => entry.id))];

export function staticEditorialMediaEnabled() {
  return process.env.EDITORIAL_STATIC_ENABLED === "1";
}

export function staticEditorialEntry(
  identity: StaticMediaIdentity,
  variant: "hero" | "social",
  entries: readonly StaticMediaEntry[] = manifest.entries,
) {
  if (!identity.generatedAt) return null;
  const matches = entries.filter(item => item.id === identity.id && item.variant === variant &&
    item.contentType === identity.contentType && item.contentId === identity.contentId &&
    item.contentRevision === identity.contentRevision && item.generatedAt === identity.generatedAt?.toISOString());
  if (!matches.length) return null;
  if (matches.length !== 1) throw new Error("Ambiguous static image identity");
  const entry = matches[0];
  if (!/^[a-f0-9]{64}$/.test(entry.sha256) || !/^\/assets\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(entry.path) ||
    entry.path.split("/").at(-1)?.split(".")[0] !== entry.sha256 ||
    !Number.isSafeInteger(entry.bytes) || entry.bytes < 1 || entry.bytes > 25 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(entry.mimeType) ||
    !entry.path.endsWith(({ "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" } as Record<string, string>)[entry.mimeType]))
    throw new Error("Invalid static image manifest");
  return entry;
}

export function hasStaticEditorialPair(identity: StaticMediaIdentity) {
  return Boolean(staticEditorialEntry(identity, "hero") && staticEditorialEntry(identity, "social"));
}

export async function readStaticEditorialImage(
  identity: StaticMediaIdentity,
  variant: "hero" | "social",
  entries: readonly StaticMediaEntry[] = manifest.entries,
) {
  if (!staticEditorialMediaEnabled()) return null;
  const entry = staticEditorialEntry(identity, variant, entries);
  if (!entry) return null; // Only legacy, unmigrated assets may use the DB fallback.
  const origin = new URL(process.env.EDITORIAL_STATIC_ORIGIN || "");
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.port || origin.pathname !== "/" || origin.search || origin.hash ||
    !/^qcs-editorial-media(?:-[a-z0-9-]+)?\.[a-z0-9-]+\.workers\.dev$/.test(origin.hostname)) throw new Error("Invalid static image origin");
  const token = process.env.EDITORIAL_STATIC_TOKEN || "";
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Static image credentials are unavailable");
  const response = await fetch(new URL(entry.path, origin), {
    headers: { Authorization: `Bearer ${token}` }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (response.status !== 200 || !response.body || response.headers.get("Content-Type")?.split(";")[0] !== entry.mimeType)
    throw new Error("Static image unavailable");
  const declared = response.headers.get("Content-Length");
  if (declared !== null && Number(declared) !== entry.bytes) throw new Error("Static image length mismatch");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > entry.bytes) throw new Error("Static image exceeds its manifest size");
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const image = Buffer.concat(chunks);
  if (size !== entry.bytes || createHash("sha256").update(image).digest("hex") !== entry.sha256)
    throw new Error("Static image integrity mismatch");
  return { image, mimeType: entry.mimeType };
}
