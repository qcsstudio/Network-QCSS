import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStorySpineContext,
  createEditorialLineage,
  storySpineQualityIssues
} from "../src/lib/editorial-story-lineage.ts";

const spine = {
  primarySubject: "Cisco Crosswork, Secure Workload, and BroadWorks advisory triage",
  trigger: "Cisco published separate August 2026 advisories for three product workstreams.",
  mechanism: "Each bulletin describes a different affected product boundary and remediation path; they do not share a BGP cause.",
  consequence: "Treating the notices as one routing issue can send operators toward the wrong inventory and evidence.",
  operatorDecision: "Separate the affected inventory, owner, fixed release, and maintenance decision for each product.",
  verification: "Confirm the running fixed release and retain product-specific service and security evidence after each change.",
  secondaryContext: ["BGP and RPKI change control is a separate operational topic."],
  visualSequence: [
    "Establish one Cisco advisory intake entering the triage desk.",
    "Split the intake into Crosswork, Secure Workload, and BroadWorks workstreams.",
    "Resolve each workstream with its own remediation and verification evidence."
  ]
};

function article(overrides = {}) {
  return {
    contentVersion: 3,
    contentType: "blog",
    slug: "cisco-advisory-triage",
    title: "How to triage Cisco Crosswork, Secure Workload, and BroadWorks advisories",
    metaTitle: "Cisco advisory triage for network teams",
    description: "A practical workflow for separating Cisco advisory scope, remediation, ownership, and validation evidence.",
    excerpt: "Separate each Cisco product advisory into its own evidence-led remediation workstream.",
    answer: "Network teams should triage each Cisco product advisory independently and preserve product-specific scope, fixes, ownership, and closure evidence.",
    category: "Network Security",
    audience: "Network and security operations teams",
    primaryKeyword: "Cisco advisory triage",
    keywords: ["Cisco security", "Crosswork", "Secure Workload"],
    publishedAt: "2026-08-31",
    updatedAt: "2026-08-31",
    readTime: "8 min read",
    image: "/resources/cisco-advisory-triage/visual",
    imageAlt: "Cisco advisory triage separated into three product remediation workstreams",
    readerOutcome: "The reader can separate affected products and close each remediation with evidence.",
    storySpine: spine,
    visualBrief: {
      storyThesis: "Cisco product advisories require separate product-specific remediation and verification workstreams.",
      sceneConcept: "One advisory intake divides into three product lanes and ends in separate verified closure records.",
      factualAnchors: ["Cisco advisory intake", "Three product workstreams", "Product-specific closure evidence"],
      avoid: ["BGP route map", "RPKI validator", "Generic cyber shield"]
    },
    relatedTools: [{ label: "Network Tools", href: "/network-tools" }],
    relatedServices: [{ label: "Network Security", href: "/services/network-security-services" }],
    takeaways: ["Separate the product scopes.", "Use the correct fixed release.", "Verify closure evidence."],
    sections: [
      {
        heading: "Separate product scope and verify closure",
        body: `${spine.trigger} ${spine.mechanism} ${spine.consequence} ${spine.operatorDecision} ${spine.verification}`
      }
    ],
    checklist: ["Map each product", "Record each release", "Assign each owner"],
    questions: [],
    sources: [{ label: "Cisco PSIRT", url: "https://sec.cloudapps.cisco.com/security/center/publicationListing.x" }],
    ...overrides
  };
}

test("editorial lineage is stable for one approved revision and changes with the revision", () => {
  const first = createEditorialLineage({ contentType: "content_post", contentId: "post-1", contentRevision: "7", storySpine: spine });
  const repeated = createEditorialLineage({ contentType: "content_post", contentId: "post-1", contentRevision: "7", storySpine: spine });
  const revised = createEditorialLineage({ contentType: "content_post", contentId: "post-1", contentRevision: "8", storySpine: spine });
  assert.equal(first.hash, repeated.hash);
  assert.notEqual(first.hash, revised.hash);
  assert.deepEqual(first.stages, ["source_evidence", "approved_revision", "visual_storyboard", "article_image", "linkedin_derivative"]);
});

test("locked story context keeps secondary topics subordinate", () => {
  const context = buildStorySpineContext(spine);
  assert.match(context, /LOCKED SINGLE-STORY CHRONOLOGY/);
  assert.match(context, /1\. Trigger or change/);
  assert.match(context, /5\. Closure evidence/);
  assert.match(context, /must remain visually subordinate/);
});

test("story quality gate rejects a visual brief that switches to an adjacent topic", () => {
  const valid = storySpineQualityIssues(article());
  const invalid = storySpineQualityIssues(
    article({
      visualBrief: {
        storyThesis: "DNS cache warm-up prevents recursive lookup delay after resolver startup.",
        sceneConcept: "A cold DNS resolver fills its cache from root and authoritative servers.",
        factualAnchors: ["Empty DNS cache", "Recursive lookup", "Authoritative response"],
        avoid: ["Cisco products", "Advisory triage", "Remediation lanes"]
      }
    })
  );
  assert.deepEqual(valid, []);
  assert.ok(invalid.some((issue) => /Align the visual brief/i.test(issue)));
});
