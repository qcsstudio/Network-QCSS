import assert from "node:assert/strict";
import test from "node:test";
import { evaluateEditorialReadiness } from "../src/lib/editorial-publication-policy.ts";

const urls = [
  "https://www.cisa.gov/example-guidance",
  "https://www.nist.gov/example-standard",
  "https://www.cisco.com/example-implementation"
];

const technicalParagraph = [
  "Operators first identify the affected service boundary, accountable owner, current configuration, and observable symptom before changing production.",
  "They compare the collected evidence with authoritative guidance, separate verified facts from assumptions, and record any uncertainty that changes the decision.",
  "The controlled response uses a pilot scope, approved maintenance window, explicit success criteria, monitoring, and a recovery owner.",
  "After the action, the team validates service behavior, logs, configuration state, and user impact, then retains before-and-after evidence for review."
].join(" ");

function article(overrides = {}) {
  const section = (heading, index) => ({
    heading,
    body: `${technicalParagraph} ${technicalParagraph} ${technicalParagraph}`,
    sourceUrls: [urls[index % urls.length]]
  });
  return {
    contentVersion: 3,
    contentType: "blog",
    slug: "evidence-led-network-change",
    title: "Evidence-led network change control for production services",
    metaTitle: "Evidence-led network change control",
    description: "A source-backed technical guide to scope, implement, validate, and recover production network changes.",
    excerpt: "Use authoritative evidence and a controlled technical sequence to make production network changes measurable and reversible.",
    answer: "A safe production network change starts with verified scope and evidence, proceeds through a controlled implementation, and closes only after explicit validation and recovery readiness are recorded.",
    category: "Network Operations",
    audience: "Network and security operations teams",
    primaryKeyword: "evidence-led network change control",
    keywords: ["network change", "validation", "rollback"],
    publishedAt: "2026-09-01",
    updatedAt: "2026-09-01",
    readTime: "9 min read",
    image: "/resources/evidence-led-network-change/visual",
    imageAlt: "Evidence-led production network change sequence with validation and rollback",
    readerOutcome: "The reader can plan a measurable, reversible production network change.",
    reviewedBy: { name: "QCS Network Engineering", role: "Technical review team" },
    editorialMethod: "Research uses authoritative sources, claim-level citations, technical review, and a documented validation gate.",
    definitions: [
      { term: "Success criterion", definition: "An observable condition that proves the intended service state after a change." },
      { term: "Rollback", definition: "A controlled action that restores the last verified service and configuration state." }
    ],
    visualBrief: {
      storyThesis: "Evidence moves a network change from scoped problem to verified production state.",
      sceneConcept: "A production service passes through evidence capture, controlled implementation, validation, and recovery checkpoints.",
      factualAnchors: ["Verified service scope", "Controlled implementation", "Observable validation evidence"],
      avoid: ["Generic cyber shield", "Unrelated cloud icons", "Unverified performance claims"]
    },
    storySpine: {
      primarySubject: "Evidence-led network change control for production services",
      trigger: "A production network service requires a controlled technical change backed by verified operational evidence.",
      mechanism: "The team maps scope, evidence, implementation controls, validation signals, and recovery actions before changing production.",
      consequence: "Without those controls, an incomplete change can create service disruption, weak ownership, and uncertain closure evidence.",
      operatorDecision: "Proceed only with approved scope, a pilot, explicit success criteria, and a named recovery owner.",
      verification: "Confirm service behavior, logs, configuration state, and user impact, then preserve before-and-after evidence.",
      secondaryContext: [],
      visualSequence: [
        "Establish the scoped production service and verified evidence.",
        "Explain the controlled network change and decision checkpoints.",
        "Resolve with validation evidence and a ready recovery path."
      ]
    },
    relatedTools: [{ label: "Network Tools", href: "/network-tools" }],
    relatedServices: [{ label: "Managed Network Services", href: "/services/managed-network-services" }],
    takeaways: ["Verify scope before action.", "Use observable success criteria.", "Retain a tested recovery path."],
    sections: [
      section("Define the problem and production scope", 0),
      section("Technical mechanism and evidence", 1),
      section("Compare practical solution options", 2),
      section("Step-by-step implementation guide", 0),
      section("Validate success with observable proof", 1),
      section("Limitations, rollback, and escalation", 2)
    ],
    checklist: [
      "Confirm the affected service scope and accountable owner.",
      "Capture current configuration, logs, topology, and baseline behavior.",
      "Compare the evidence with the authoritative technical sources.",
      "Approve a bounded pilot and maintenance window.",
      "Apply the controlled change in the documented sequence.",
      "Validate service behavior, logs, and configuration state.",
      "Rollback or restore the last verified state when success criteria fail.",
      "Record exceptions, ownership, evidence, and the next review date."
    ],
    questions: [
      { question: "What evidence is required before the change?", answer: "Record the current configuration, logs, topology, service baseline, affected owner, and the authoritative guidance used for the decision.", sourceUrls: [urls[0]] },
      { question: "How should the implementation begin?", answer: "Begin with an approved, representative pilot and explicit pause points before expanding the change to the wider production scope.", sourceUrls: [urls[1]] },
      { question: "How is success verified?", answer: "Verify service behavior, logs, configuration state, monitoring, and user impact against the success criteria recorded before the change.", sourceUrls: [urls[2]] },
      { question: "When should the team roll back?", answer: "Use the documented recovery path when a success criterion fails, service impact expands, or the observed state cannot be explained safely.", sourceUrls: [urls[0]] }
    ],
    sources: urls.map((url, index) => ({ label: `Authority ${index + 1}`, url })),
    ...overrides
  };
}

test("version 3 approval checks require broad evidence and decision-complete guidance", () => {
  const readiness = evaluateEditorialReadiness(article());
  const targeted = readiness.issues.filter((issue) => /three authoritative|claim-level evidence|dedicated section|technical checklist/i.test(issue));
  assert.deepEqual(targeted, []);
  assert.equal(readiness.citedSections, 6);
  assert.equal(readiness.minimumCitedSections, 5);
});

test("version 3 approval checks reject thin sourcing and missing operational stages", () => {
  const weak = article({
    sources: [{ label: "Only source", url: urls[0] }],
    sections: article().sections.slice(0, 4).map((section) => ({ ...section, sourceUrls: [urls[0]] })),
    checklist: article().checklist.slice(0, 6).filter((item) => !/rollback|restore/i.test(item))
  });
  const issues = evaluateEditorialReadiness(weak).issues.join(" ");
  assert.match(issues, /at least six substantive sections/i);
  assert.match(issues, /at least eight actionable technical-guide steps/i);
  assert.match(issues, /at least three authoritative sources/i);
  assert.match(issues, /rollback or recovery/i);
});
