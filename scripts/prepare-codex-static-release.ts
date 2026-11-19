import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import manifest from "../src/content/editorial-static-manifest.json" with { type: "json" };
import { digest, objectDigest, type ValidatedCodexCandidate } from "../src/lib/codex-image-workflow.ts";
import { staticEditorialEntry, type StaticMediaEntry } from "../src/lib/editorial-static-media.ts";

export async function prepareStaticRelease(candidate: ValidatedCodexCandidate, assetRoot: string, output: string,
  existingId?: string, entries: readonly StaticMediaEntry[] = manifest.entries) {
  const allowed = path.resolve("test-results/editorial-static-releases");
  const relative = path.relative(allowed, path.resolve(output));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Stage only in a new test-results/editorial-static-releases subfolder.");
  const identity = { id: existingId || randomUUID(), contentType: candidate.pack.source.contentType,
    contentId: candidate.pack.source.contentId, contentRevision: candidate.pack.source.contentRevision, generatedAt: new Date().toISOString() };
  const additions: StaticMediaEntry[] = ["hero", "social"].map(variant => {
    const bytes = candidate[variant as "hero" | "social"];
    const hash = digest(bytes);
    return { ...identity, variant, sha256: hash, bytes: bytes.length, mimeType: "image/jpeg",
      width: variant === "hero" ? 1440 : 1200, height: variant === "hero" ? 810 : 627, path: `/assets/${hash}.jpg`,
      importManifestHash: objectDigest(candidate.manifest), sourceHash: candidate.pack.sourceHash };
  });
  if (entries.some(entry => entry.importManifestHash === additions[0].importManifestHash && entry.sourceHash === additions[0].sourceHash))
    throw new Error("This reviewed pack already has a release binding. Reuse it; do not make another identity.");
  const all = [...entries, ...additions];
  if (new Set(all.map(entry => entry.path)).size > 20000) throw new Error("Workers Free file allowance reached. No upgrade or deletion attempted.");
  const prepared = new Map<string, Buffer>();
  for (const entry of all) {
    if (entry.variant !== "hero" && entry.variant !== "social") throw new Error("Invalid variant");
    staticEditorialEntry({ ...entry, generatedAt: new Date(entry.generatedAt) }, entry.variant, all);
    const bytes = additions.includes(entry) ? Buffer.from(candidate[entry.variant]) : await readFile(path.join(assetRoot, entry.path.slice(1)));
    if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) throw new Error("Asset changed or missing; preserve the complete prior release before deployment.");
    prepared.set(entry.path, bytes);
  }
  await mkdir(allowed, { recursive: true });
  await mkdir(output);
  await mkdir(path.join(output, "public/assets"), { recursive: true });
  for (const [assetPath, bytes] of prepared) await writeFile(path.join(output, "public", assetPath.slice(1)), bytes, { flag: "wx" });
  const next = { format: "qcs-editorial-static-manifest-v1", entries: all };
  await writeFile(path.join(output, "editorial-static-manifest.json"), JSON.stringify(next, null, 2) + "\n", { flag: "wx" });
  await copyFile("deploy/editorial-media-worker/worker.mjs", path.join(output, "worker.mjs"));
  const config = JSON.parse(await readFile("deploy/editorial-media-worker/wrangler.jsonc", "utf8"));
  if (!config.assets.run_worker_first) throw new Error("Private origin authorization is mandatory.");
  delete config.$schema;
  await writeFile(path.join(output, "wrangler.json"), JSON.stringify(config, null, 2) + "\n", { flag: "wx" });
  const receipt = { identity, manifestSha256: digest(JSON.stringify(next)), previousVariants: entries.length,
    variants: all.length, files: prepared.size, deployed: false, databaseWrites: false, paidApiCalls: 0 };
  await writeFile(path.join(output, "stage-receipt.json"), JSON.stringify(receipt, null, 2), { flag: "wx" });
  return receipt;
}
