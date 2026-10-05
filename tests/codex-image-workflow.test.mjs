import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import {
  prepareCodexImage, validateCodexConcept, assembleCodexImage, validateCodexCandidate,
  objectDigest, codexImportDecision, codexHandoffInstructions
} from "../src/lib/codex-image-workflow.ts";
import { editorialImageAction, editorialImageMode, codexImageProvider } from "../src/lib/editorial-image-mode.ts";
import { importCodexCandidate, readCodexSource } from "../src/lib/codex-image-store.ts";
import { runEditorialImageAgents, runBflEditorialImageAgents, editorialAgentConfiguration } from "../src/lib/editorial-image-agents.ts";

const article = {
  title: "Prepare a maintenance rehearsal", answer: "Inventory devices before selecting software for a maintenance rehearsal.",
  excerpt: "Inventory devices before selecting software for a maintenance rehearsal. Keep a tested recovery procedure for each managed device.",
  checklist: ["Record device versions and configuration backups.", "Test restoration in a disconnected staging environment."],
  sections: [{ heading: "Validate recovery", body: "Keep a tested recovery procedure for each managed device. The rehearsal illustrates operational preparation, not proof of exploitation or vulnerability remediation." }]
};
const source = { contentType: "content_post", contentId: "test-article", contentRevision: "1", title: article.title,
  status: "draft", updatedAt: "2026-10-05T00:00:00.000Z", content: article, liveContentHash: objectDigest(article) };
const concept = {
  sceneConcept: "A maintenance bench with an inventory tray and a separate recovery rehearsal device.",
  diversitySignature: "Physical inventory tray beside a disconnected recovery rehearsal bench.",
  altText: "An inventory tray sits beside a separate device used to rehearse configuration recovery.",
  factualBoundary: "This is an operational preparation concept, not evidence of exploitation or a confirmed remediation.",
  evidence: [
    { quote: "Inventory devices before selecting software for a maintenance rehearsal.", visualElement: "An inventory tray beside the rehearsal equipment." },
    { quote: "Keep a tested recovery procedure for each managed device.", visualElement: "A separate recovery rehearsal device with a checklist." }
  ],
  verifiedSources: [{ url: "https://www.cisco.com/", checkedAt: "2026-10-05T00:00:00.000Z", finding: "Synthetic test fixture; this is not a real source verification or publishable content." }],
  prompt: "Synthetic test prompt only. Render a landscape maintenance bench and a separate recovery rehearsal device with an inventory tray, no fabricated vulnerability or exploitation claims."
};
const checks = { factualAccuracy: true, topicSpecificComposition: true, noUnsupportedClaims: true, authenticLogo: true,
  noClippingOrOverlap: true, mobileReadable: true, altTextAccurate: true };
let fixture;
const originalFetch = globalThis.fetch;
const originalMode = process.env.EDITORIAL_IMAGE_MODE;
before(async () => {
  globalThis.fetch = async () => { throw new Error("Network forbidden during local image workflow tests."); };
  const pixels = Buffer.alloc(1440 * 810 * 3);
  for (let y = 0; y < 810; y++) for (let x = 0; x < 1440; x++) {
    const p = (y * 1440 + x) * 3;
    pixels[p] = Math.floor(x / 6) % 256; pixels[p + 1] = Math.floor(y / 4) % 256; pixels[p + 2] = (x + y) % 256;
  }
  const master = await sharp(pixels, { raw: { width: 1440, height: 810, channels: 3 } }).png().toBuffer();
  const logo = await readFile("public/brand/quantumcrafters-logo.png");
  const pack = prepareCodexImage(source);
  const rendered = await assembleCodexImage({ pack, concept, master, logo });
  const review = { manifestHash: objectDigest(rendered.manifest), reviewedAt: new Date().toISOString(), reviewer: "automated test fixture",
    method: "human-visual-review", checks, notes: "Synthetic test data only; not a genuine visual review or publishable asset." };
  fixture = { pack, concept, master, logo, ...rendered, review };
});
after(() => { globalThis.fetch = originalFetch; if (originalMode === undefined) delete process.env.EDITORIAL_IMAGE_MODE; else process.env.EDITORIAL_IMAGE_MODE = originalMode; });

test("exports full article evidence and explicitly names subscription/session limitations", () => {
  assert.deepEqual(fixture.pack.source.content, article);
  assert.match(codexHandoffInstructions(fixture.pack), /not local inference or unlimited free/);
  assert.throws(() => prepareCodexImage({ ...source, content: { title: "headline only" } }), /complete article/);
});
test("same workflow accepts advisory evidence without inventing CVEs or ratings", () => {
  const pack = prepareCodexImage({ ...source, contentType: "security_advisory", contentId: "test-advisory" });
  assert.equal(validateCodexConcept(pack, concept).pack.source.contentType, "security_advisory");
});
test("rejects altered evidence, repeated anchors, clipped alt text, and reused scene concepts", () => {
  assert.throws(() => validateCodexConcept({ ...fixture.pack, sourceHash: "0".repeat(64) }, concept), /modified/);
  assert.throws(() => validateCodexConcept(fixture.pack, { ...concept, evidence: [concept.evidence[0], concept.evidence[0]] }), /distinct/);
  assert.throws(() => validateCodexConcept(fixture.pack, { ...concept, altText: "The path ends at..." }), /complete/);
  assert.throws(() => validateCodexConcept({ ...fixture.pack, recent: [{ contentId: "other", sceneConcept: concept.sceneConcept, diversitySignature: "different" }] }, concept), /repeats/);
  assert.throws(() => validateCodexConcept(fixture.pack, { ...concept, evidence: [{ ...concept.evidence[0], quote: "An invented claim never present in the source material." }, concept.evidence[1]] }), /verbatim/);
});
test("creates branded retina variants without network requests and keeps the full composition", async () => {
  const candidate = await validateCodexCandidate(fixture);
  const hero = await sharp(candidate.hero).metadata();
  const social = await sharp(candidate.social).metadata();
  assert.deepEqual([hero.width, hero.height, social.width, social.height], [1440, 810, 1200, 627]);
  assert.equal(candidate.manifest.fit, "contain");
  assert.equal(candidate.manifest.provider, codexImageProvider);
  assert.ok(candidate.hero.length < 2_000_000 && candidate.social.length < 2_000_000);
});
test("rejects low resolution, blank, malformed, and duplicate masters", async () => {
  const blank = await sharp({ create: { width: 1440, height: 810, channels: 3, background: "white" } }).png().toBuffer();
  const small = await sharp(fixture.master).resize(720, 405).png().toBuffer();
  for (const [master, message] of [[blank, /blank/], [small, /native pixels/], [Buffer.from("not an image"), /unsupported image format/]]) {
    await assert.rejects(assembleCodexImage({ ...fixture, master }), message);
  }
  await assert.rejects(assembleCodexImage({ ...fixture, pack: { ...fixture.pack, recent: [{ contentId: "other", sceneConcept: "different", diversitySignature: "different", perceptualHash: fixture.manifest.perceptualHash }] } }), /visually repeats/);
});
test("review cannot be omitted, copied to a new candidate, backdated, or used after tampering", async () => {
  await assert.rejects(validateCodexCandidate({ ...fixture, review: undefined }));
  await assert.rejects(validateCodexCandidate({ ...fixture, review: { ...fixture.review, manifestHash: "a".repeat(64) } }), /fingerprint/);
  await assert.rejects(validateCodexCandidate({ ...fixture, review: { ...fixture.review, reviewedAt: "2020-01-01T00:00:00.000Z" } }), /dated/);
  await assert.rejects(validateCodexCandidate({ ...fixture, hero: Buffer.concat([fixture.hero, Buffer.from("changed")]) }), /fingerprint/);
  await assert.rejects(validateCodexCandidate({ ...fixture, review: { ...fixture.review, checks: { ...checks, mobileReadable: false } } }));
});
test("review cannot approve a derivative with a fabricated branding recipe", async () => {
  const hero = await sharp(fixture.master).resize(1440, 810).jpeg().toBuffer();
  const { digest } = await import("../src/lib/codex-image-workflow.ts");
  const manifest = { ...fixture.manifest, heroHash: digest(hero) };
  await assert.rejects(validateCodexCandidate({ ...fixture, hero, manifest, review: { ...fixture.review, manifestHash: objectDigest(manifest) } }), /recipe/);
});
test("stale source, active jobs, and existing ready artwork are protected; same import is idempotent", async () => {
  const candidate = await validateCodexCandidate(fixture);
  assert.throws(() => codexImportDecision(candidate, { ...source, contentRevision: "2" }, null), /changed/);
  assert.throws(() => codexImportDecision(candidate, source, { status: "generating", provider: null }), /owns/);
  assert.throws(() => codexImportDecision(candidate, source, { status: "ready", provider: "openai-direct" }), /overwrite/);
  assert.equal(codexImportDecision(candidate, source, { status: "ready", provider: codexImageProvider, manifestHash: objectDigest(candidate.manifest) }), "unchanged");
});
test("Codex mode preserves ready assets even on forced backfill and never chooses a paid provider", () => {
  for (const status of ["pending", "failed", "budget_wait", "awaiting_codex"]) for (const force of [true, false]) {
    assert.equal(editorialImageAction({ mode: "codex-assisted", status, complete: false, provider: null, force }), "handoff");
  }
  assert.equal(editorialImageAction({ mode: "provider-api", status: "ready", complete: true, provider: codexImageProvider, force: true }), "preserve");
  assert.throws(() => editorialImageMode("typo"), /no image provider/);
});
test("both paid agent entry points fail closed in Codex mode even if credentials exist", async () => {
  process.env.EDITORIAL_IMAGE_MODE = "codex-assisted";
  assert.equal(editorialAgentConfiguration().premiumConfigured, false);
  await assert.rejects(runEditorialImageAgents("test", []), /disabled/);
  await assert.rejects(runBflEditorialImageAgents("test", []), /disabled/);
});
test("transactional import defaults to no writes and only imports an image plus audit on explicit apply", async () => {
  const candidate = await validateCodexCandidate(fixture);
  const calls = [];
  let saved = null;
  const tx = {
    contentPost: { findUnique: async () => ({ ...source, id: source.contentId, updatedAt: new Date(source.updatedAt), revisions: [{ version: 1, content: article }] }) },
    editorialImage: {
      findUnique: async () => saved, findMany: async () => [],
      upsert: async ({ create }) => { calls.push("image"); saved = create; }
    },
    auditLog: { create: async () => { calls.push("audit"); } }
  };
  const db = { $transaction: async (fn, options) => { assert.equal(options.isolationLevel, "Serializable"); return fn(tx); } };
  assert.equal((await importCodexCandidate(candidate, false, db)).dryRun, true);
  assert.deepEqual(calls, []);
  assert.equal((await importCodexCandidate(candidate, true, db)).applied, true);
  assert.deepEqual(calls, ["image", "audit"]);
  assert.equal(saved.qaScore, null);
  assert.equal(saved.agentTrace.independentAutomatedReview, false);
  assert.equal(saved.agentTrace.lineage.contentRevision, "1");
  assert.equal((await importCodexCandidate(candidate, true, db)).action, "unchanged");
  assert.deepEqual(calls, ["image", "audit"]);
});
test("advisory export rejects deleted content and binds live edits as well as the reviewed revision", async () => {
  const base = { id: "advisory", title: "Advisory", vendor: "Vendor", status: "published", severity: "high", cvssScore: null,
    priorityScore: 80, summary: article.excerpt, remediation: "Check the primary source.", workaround: null, exploitationStatus: "unknown",
    sourceUrl: "https://www.cisco.com/", cves: [], products: [], affectedVersions: [], fixedVersions: [], updatedAt: new Date(source.updatedAt),
    revisions: [{ version: 1, payload: { editorialSnapshot: { summary: "Frozen reviewed summary" } } }] };
  let row = base;
  const db = { securityAdvisory: { findUnique: async () => row } };
  const first = await readCodexSource(db, "security_advisory", "advisory");
  row = { ...base, summary: "A concurrent editorial change" };
  const changed = await readCodexSource(db, "security_advisory", "advisory");
  assert.equal(first.content.summary, changed.content.summary);
  assert.notEqual(first.liveContentHash, changed.liveContentHash);
  row = { ...base, deletedAt: new Date() };
  await assert.rejects(readCodexSource(db, "security_advisory", "advisory"), /deleted/);
});
