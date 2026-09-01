import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateEditorialReadiness } from "../src/lib/editorial-publication-policy.ts";

test("production cadence separates ingestion, drafting, and social delivery", async () => {
  const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const workflow = await readFile(new URL("../.github/workflows/editorial-automation.yml", import.meta.url), "utf8");
  const schedules = new Map(vercel.crons.map((cron) => [cron.path, cron.schedule]));

  assert.equal(schedules.get("/api/cron/advisory-discovery"), "17 3 * * *");
  assert.equal(schedules.get("/api/cron/content-editorial"), "47 3 * * *");
  assert.equal(schedules.has("/api/cron/social-publisher"), false);
  assert.equal(schedules.get("/api/admin/content-radar"), "0 4 * * 1,4");
  assert.match(workflow, /cron: "\*\/5 \* \* \* \*"/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /scan-advisories:/);
  assert.match(workflow, /publish-social:/);
  assert.match(workflow, /complete-content:/);
  assert.match(workflow, /api\/cron\/advisory-discovery/);
  assert.match(workflow, /api\/cron\/content-editorial/);
  assert.match(workflow, /api\/cron\/social-publisher/);
});

test("live research reserves enough structured-output capacity and rejects truncation", async () => {
  const agents = await readFile(new URL("../src/lib/editorial-content-agents.ts", import.meta.url), "utf8");

  assert.match(agents, /Keep the dossier concise and decision-focused/);
  assert.match(agents, /max_output_tokens: 6_000/);
  assert.match(agents, /response\.status === "incomplete"/);
});

function publicationReadyPost(sectionWords = 190, includeCitation = true) {
  const sourceUrl = "https://www.cisa.gov/news-events/cybersecurity-advisories";
  const body = Array.from({ length: sectionWords }, (_, index) => `evidence${index}`).join(" ");
  return {
    contentVersion: 2,
    contentType: "blog",
    slug: "evidence-led-network-review",
    title: "Evidence-led network review for operational teams",
    metaTitle: "Evidence-led network review | QCS",
    description: "A practical network review that maps primary-source evidence to controlled engineering decisions and validation.",
    excerpt: "Learn how network teams can collect authoritative evidence, assess operational risk, record ownership, and validate a controlled response.",
    answer: "Network teams should connect each material claim to an authoritative primary source, record the affected scope and accountable owner, and validate the chosen action before closing the review.",
    category: "Network Security",
    audience: "Network engineers, security leaders, and managed service teams",
    primaryKeyword: "evidence-led network review",
    keywords: ["network review", "primary sources", "network evidence"],
    publishedAt: "2026-08-21",
    updatedAt: "2026-08-21",
    readTime: "8 min read",
    image: "/resources/evidence-led-network-review/visual",
    imageAlt: "Network evidence map showing source-backed operational review and validation",
    readerOutcome: "The reader can map technical evidence to an accountable and verifiable network decision.",
    reviewedBy: { name: "QCS Network and Security Engineering", role: "Technical review team" },
    editorialMethod: "Primary-source research, original operational analysis, deterministic publication checks, and technical editorial review.",
    definitions: [
      { term: "Primary source", definition: "The vendor, standards body, or authority responsible for the original technical information." },
      { term: "Validation", definition: "A recorded check that confirms the intended network or security outcome after an action." }
    ],
    visualBrief: {
      storyThesis: "Primary evidence should lead to a controlled and verifiable network decision.",
      sceneConcept: "A network operations workspace connects an official source, affected systems, decision owner, and validation record.",
      factualAnchors: ["Official source record", "Affected network scope", "Recorded validation result"],
      avoid: ["Generic padlock imagery", "Unsupported vendor branding", "Decorative code without meaning"]
    },
    relatedTools: [{ label: "Network Tools", href: "/network-tools" }],
    relatedServices: [{ label: "Managed Network Services", href: "/services/managed-network-services" }],
    takeaways: [
      "Use primary sources for material technical claims and preserve the source URL.",
      "Record affected scope and ownership before changing production controls.",
      "Validate and preserve evidence after the controlled action is complete."
    ],
    sections: Array.from({ length: 5 }, (_, index) => ({
      heading: `Decision stage ${index + 1}`,
      body,
      bullets: ["Record the technical evidence and affected scope.", "Confirm ownership and the required validation step."],
      sourceUrls: includeCitation && index === 0 ? [sourceUrl] : []
    })),
    checklist: [
      "Identify the affected network scope and business owner.",
      "Capture the current version and configuration evidence.",
      "Verify the primary technical source and publication date.",
      "Record the proposed action and rollback conditions.",
      "Execute the approved change within the maintenance window.",
      "Validate the intended outcome and preserve the result."
    ],
    questions: Array.from({ length: 4 }, (_, index) => ({
      question: `What evidence is required at decision stage ${index + 1}?`,
      answer: "Collect authoritative source material, affected-scope evidence, accountable ownership, and a repeatable validation record.",
      sourceUrls: []
    })),
    sources: [{ label: "CISA Cybersecurity Advisories", url: sourceUrl }]
  };
}

test("editorial readiness blocks short uncited drafts before approval", () => {
  const readiness = evaluateEditorialReadiness(publicationReadyPost(70, false));
  assert.equal(readiness.usefulWords < readiness.minimumUsefulWords, true);
  assert.equal(readiness.citationCount, 0);
  assert.ok(readiness.issues.includes("Add original technical analysis; this format requires at least 1000 useful words."));
  assert.ok(readiness.issues.includes("Attach primary-source citations to the claims they support."));
});

test("editorial readiness accepts a complete source-mapped article", () => {
  const readiness = evaluateEditorialReadiness(publicationReadyPost());
  assert.equal(readiness.usefulWords >= readiness.minimumUsefulWords, true);
  assert.equal(readiness.citationCount, 1);
  assert.deepEqual(readiness.issues, []);
});
