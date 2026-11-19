import manifest from "../content/editorial-static-manifest.json" with { type: "json" };
import { digest, objectDigest, type ValidatedCodexCandidate } from "./codex-image-workflow.ts";
import { readStaticEditorialImage, staticEditorialEntry, staticMediaManifestHash, staticEditorialMediaEnabled,
  type StaticMediaEntry } from "./editorial-static-media.ts";

export function codexStaticBinding(candidate: ValidatedCodexCandidate, entries: readonly StaticMediaEntry[] = manifest.entries) {
  const source = candidate.pack.source;
  const matches = entries.filter(entry => entry.contentType === source.contentType && entry.contentId === source.contentId &&
    entry.contentRevision === source.contentRevision && entry.importManifestHash === objectDigest(candidate.manifest) &&
    entry.sourceHash === candidate.pack.sourceHash);
  if (matches.length !== 2) throw new Error("Stage and deploy this exact reviewed image pack to Cloudflare and QCS before import.");
  const identity = { ...matches[0], generatedAt: new Date(matches[0].generatedAt) };
  for (const variant of ["hero", "social"] as const) {
    const entry = staticEditorialEntry(identity, variant, matches);
    if (!entry || entry.sha256 !== digest(candidate[variant]) || entry.bytes !== candidate[variant].length || entry.mimeType !== "image/jpeg")
      throw new Error("Reviewed image does not match its static release binding.");
  }
  return { id: identity.id, generatedAt: identity.generatedAt };
}

export async function verifyCodexStaticImport(candidate: ValidatedCodexCandidate) {
  if (!staticEditorialMediaEnabled()) throw new Error("Cloudflare storage must be enabled. Neon image writes are disabled for new imports.");
  const binding = codexStaticBinding(candidate);
  const release = await fetch("https://www.qcsstudio.com/api/editorial-media/version", {
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000)
  });
  if (!release.ok) throw new Error("Cannot verify the live QCS image release.");
  const live = await release.json();
  if (live.manifestSha256 !== staticMediaManifestHash || live.cloudflareEnabled !== true || live.storageProtocol !== "qcs-static-local-v2")
    throw new Error("Live QCS does not yet serve this exact static release.");
  for (const variant of ["hero", "social"] as const) {
    const stored = await readStaticEditorialImage({ ...candidate.pack.source, ...binding }, variant);
    if (!stored || digest(stored.image) !== digest(candidate[variant])) throw new Error("Cloudflare image verification failed; no image record was changed.");
  }
  return binding;
}
