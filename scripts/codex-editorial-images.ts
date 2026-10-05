import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  prepareCodexImage, codexHandoffInstructions, conceptExample, assembleCodexImage,
  validateCodexCandidate, objectDigest
} from "../src/lib/codex-image-workflow.ts";

const [command, ...raw] = process.argv.slice(2);
const allowed: Record<string, string[]> = {
  list: [], prepare: ["source", "type", "id", "out"],
  assemble: ["pack", "image", "background"], check: ["pack"], import: ["pack", "apply"]
};
const options: Record<string, string> = {};
if (!allowed[command]) throw new Error("Usage: npm run content:images:codex -- list|prepare|assemble|check|import --option=value. See docs/codex-editorial-images.txt.");
for (const arg of raw) {
  const match = /^--([a-z]+)(?:=(.+))?$/.exec(arg);
  if (!match || !allowed[command].includes(match[1]) || Object.hasOwn(options, match[1]) ||
    (match[1] !== "apply" && !match[2]) || (match[1] === "apply" && match[2])) throw new Error(`Invalid or duplicate option: ${arg.split("=")[0]}`);
  options[match[1]] = match[2] || "true";
}
function required(key: string) { if (!options[key]) throw new Error(`Missing --${key}=...`); return options[key]; }
async function json(file: string) { return JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, "")); }
async function save(file: string, value: unknown) { await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" }); }
const logoPath = path.resolve("public/brand/quantumcrafters-logo.png");

async function main() {
  if (command === "list") {
    const store = await import("../src/lib/codex-image-store.ts");
    console.log(JSON.stringify(await store.listCodexImageHandoffs(), null, 2));
    return;
  }
  if (command === "prepare") {
    if (options.source && (options.type || options.id)) throw new Error("Use either --source for offline work or --type and --id for database export.");
    const exported = options.source ? { source: await json(options.source), recent: [] } :
      await (await import("../src/lib/codex-image-store.ts")).exportCodexSource(required("type"), required("id"));
    const pack = prepareCodexImage(exported.source, exported.recent);
    const folder = path.resolve(required("out"));
    await mkdir(path.dirname(folder), { recursive: true });
    await mkdir(folder); // Never overwrite an existing reviewed package.
    await save(path.join(folder, "pack.json"), pack);
    await save(path.join(folder, "source.json"), pack.source);
    await save(path.join(folder, "concept.example.json"), conceptExample);
    await writeFile(path.join(folder, "HANDOFF.txt"), codexHandoffInstructions(pack), { flag: "wx" });
    console.log(JSON.stringify({ action: "prepared", folder, sourceHash: pack.sourceHash, offline: Boolean(options.source), paidApiCalls: 0 }));
    return;
  }
  const folder = path.resolve(required("pack"));
  const pack = await json(path.join(folder, "pack.json"));
  const concept = await json(path.join(folder, "concept.json"));
  const logo = await readFile(logoPath);
  if (command === "assemble") {
    const output = path.join(folder, "render");
    try { await access(output); throw new Error("Render already exists. Prepare a new package for revisions; do not overwrite a reviewed candidate."); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const master = await readFile(required("image"));
    const result = await assembleCodexImage({ pack, concept, master, logo, background: options.background });
    await mkdir(output);
    await writeFile(path.join(output, "master.bin"), master, { flag: "wx" });
    await writeFile(path.join(output, "hero.jpg"), result.hero, { flag: "wx" });
    await writeFile(path.join(output, "social.jpg"), result.social, { flag: "wx" });
    await sharp(result.hero).resize({ width: 360 }).jpeg({ quality: 90 }).toFile(path.join(output, "hero-mobile.jpg"));
    await sharp(result.social).resize({ width: 360 }).jpeg({ quality: 90 }).toFile(path.join(output, "social-mobile.jpg"));
    await save(path.join(output, "manifest.json"), result.manifest);
    await writeFile(path.join(output, "prompt.txt"), concept.prompt, { flag: "wx" });
    await save(path.join(folder, "review.example.json"), {
      manifestHash: objectDigest(result.manifest), reviewedAt: "REPLACE after inspecting both full-size and mobile images",
      reviewer: "REPLACE", method: "human-visual-review", notes: "REPLACE with actual findings and limitations.",
      checks: { factualAccuracy: false, topicSpecificComposition: false, noUnsupportedClaims: false, authenticLogo: false,
        noClippingOrOverlap: false, mobileReadable: false, altTextAccurate: false }
    });
    console.log(JSON.stringify({ action: "assembled", output, manifestHash: objectDigest(result.manifest), reviewRequired: true, paidApiCalls: 0 }));
    return;
  }
  const render = path.join(folder, "render");
  const candidate = await validateCodexCandidate({ pack, concept, logo,
    manifest: await json(path.join(render, "manifest.json")), review: await json(path.join(folder, "review.json")),
    master: await readFile(path.join(render, "master.bin")), hero: await readFile(path.join(render, "hero.jpg")), social: await readFile(path.join(render, "social.jpg")) });
  if (command === "check") {
    console.log(JSON.stringify({ action: "validated", sourceHash: candidate.pack.sourceHash, manifestHash: objectDigest(candidate.manifest),
      paidApiCalls: 0, databaseChecked: false, reviewMethod: candidate.review.method, independentAutomatedReview: false }));
  } else {
    console.log(JSON.stringify(await (await import("../src/lib/codex-image-store.ts")).importCodexCandidate(candidate, options.apply === "true")));
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Codex image workflow failed."); process.exitCode = 1; })
  .finally(async () => {
    if (command === "list" || command === "import" || (command === "prepare" && !options.source)) {
      const { getPrismaClient } = await import("../src/lib/prisma.ts");
      await getPrismaClient().$disconnect();
    }
  });
