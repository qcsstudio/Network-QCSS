import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { evaluateEditorialReadiness } from "../src/lib/editorial-publication-policy.ts";
import { createEditorialLineage, storySpineQualityIssues } from "../src/lib/editorial-story-lineage.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const spine = {
  primarySubject: "  Evidence-led network change control  ",
  trigger: "A network service requires a controlled change with verified evidence.",
  mechanism: "Operators map the service scope, configuration, validation signals, and recovery steps.",
  consequence: "An incomplete network change can disrupt service and leave uncertain closure evidence.",
  operatorDecision: "Proceed with approved service scope, a pilot, success criteria, and a recovery owner.",
  verification: "Confirm service logs and configuration, then preserve before-and-after evidence.",
  secondaryContext: [],
  visualSequence: [
    "Establish the network service scope and evidence.",
    "Explain the controlled change and validation signals.",
    "Resolve with service verification and recovery evidence."
  ]
};

function browserBuild(entry, options = {}) {
  // Resolve the actual dependency graph, including packages, without Node shims or externals.
  return build({
    absWorkingDir: root,
    entryPoints: [entry],
    bundle: true,
    platform: "browser",
    format: "esm",
    treeShaking: false,
    write: false,
    metafile: true,
    logLevel: "silent",
    ...options
  });
}

test("the real content radar client graph bundles without server lineage or Node builtins", async () => {
  const result = await browserBuild("src/components/content-radar-panel.tsx");
  const inputs = Object.keys(result.metafile.inputs).map((path) => path.replaceAll("\\", "/"));
  assert.ok(inputs.includes("src/lib/editorial-publication-policy.ts"));
  assert.ok(inputs.includes("src/lib/editorial-story-spine.ts"));
  assert.ok(!inputs.includes("src/lib/editorial-story-lineage.ts"));
  assert.ok(!inputs.includes("src/lib/blog.ts"), "type-only BlogPost imports must not enter the client graph");
  assert.ok(Object.values(result.metafile.inputs).every((input) => input.imports.every((item) => !item.external)));
  assert.match(result.outputFiles[0].text, /Add a complete single-story chronology before publication/);
});

test("browser readiness keeps the same story and publication gates as the server", async () => {
  const result = await browserBuild("src/lib/editorial-publication-policy.ts", { format: "iife", globalName: "EditorialPolicy" });
  const context = {};
  runInNewContext(result.outputFiles[0].text, context, { timeout: 1_000 });
  const post = {
    contentVersion: 3,
    contentType: "blog",
    title: "Evidence-led network change control",
    primaryKeyword: "network change control",
    metaTitle: "Evidence-led network change control",
    description: spine.consequence,
    excerpt: spine.consequence,
    answer: spine.trigger,
    sections: [{ heading: "Network change validation", body: Object.values(spine).filter((value) => typeof value === "string").join(" ") }],
    checklist: [spine.operatorDecision, spine.verification],
    questions: [],
    sources: [],
    takeaways: [],
    storySpine: spine
  };
  assert.deepEqual(storySpineQualityIssues(post), []);
  const cases = [
    [post, /Research at least three authoritative sources/],
    [{ ...post, storySpine: undefined }, /Add a complete single-story chronology/],
    [{ ...post, storySpine: { ...spine, visualSequence: Array(3).fill(spine.visualSequence[0]) } }, /Use three distinct visual frames/],
    [{ ...post, title: "DNS resolver cache", primaryKeyword: "recursive lookup" }, /Make the story spine primary subject match/]
  ];
  for (const [candidate, expectedIssue] of cases) {
    const browserResult = JSON.parse(JSON.stringify(context.EditorialPolicy.evaluateEditorialReadiness(candidate)));
    assert.deepEqual(browserResult, evaluateEditorialReadiness(candidate));
    assert.match(browserResult.issues.join("\n"), expectedIssue);
  }
});

test("server lineage retains the pre-extraction SHA-256 receipt and revision sensitivity", () => {
  const input = { contentType: "content_post", contentId: "boundary-fixture", contentRevision: "7", storySpine: spine };
  const lineage = createEditorialLineage(input);
  assert.equal(lineage.hash, "ca57f006e51be88a9ce815e8369af3230653b8f9eb9bb7b810eaa3586ef829b7");
  assert.equal(lineage.policyVersion, 1);
  assert.equal(lineage.storySpine.primarySubject, spine.primarySubject.trim());
  assert.deepEqual(lineage.stages, ["source_evidence", "approved_revision", "visual_storyboard", "article_image", "linkedin_derivative"]);
  assert.notEqual(createEditorialLineage({ ...input, contentRevision: "8" }).hash, lineage.hash);
});
