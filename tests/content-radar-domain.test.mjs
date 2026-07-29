import assert from "node:assert/strict";
import test from "node:test";
import { buildRadarPublicationPost } from "../src/lib/content-radar-domain.ts";

const radarDraft = {
  slot: "Thursday",
  format: "Evidence-led security post",
  title: "Cisco Catalyst SD-WAN Controller Authenticated Privilege Escalation Vulnerability",
  slug: "cisco-catalyst-sd-wan-controller-privilege-escalation",
  metaTitle: "Cisco Catalyst SD-WAN Privilege Escalation Guidance",
  metaDescription: "Practical response guidance for a Cisco SD-WAN security advisory, including evidence, ownership, remediation planning, and validation.",
  answerBlock: "Confirm applicability before changing production controls.",
  sections: ["Short answer", "Evidence", "Next action"],
  internalLinks: ["/services/network-security-services", "/network-tools"],
  sourceUrl: "https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/example",
  sourceName: "Cisco PSIRT Advisories",
  sourceRole: "authority",
  sourcePublishedAt: "2026-07-28T00:00:00.000Z",
  sourceSummary: "Cisco SD-WAN security advisory.",
  businessAngle: "Turn the advisory into an evidence-led remediation decision.",
  servicePath: "/services/network-security-services",
  keywordCluster: ["Cisco SD-WAN", "network vulnerability", "patch validation"],
  imageRecommendation: "/brand/envato/library/security-network-shield.webp"
};

test("radar publication content is complete and passes editorial limits", () => {
  const post = buildRadarPublicationPost(radarDraft);
  const serialized = JSON.stringify(post).toLowerCase();

  assert.equal(serialized.includes("draft required"), false);
  assert.equal(serialized.includes("placeholder"), false);
  assert.ok(post.metaTitle.length <= 60);
  assert.ok(post.description.length >= 50 && post.description.length <= 160);
  assert.ok(post.excerpt.length >= 60 && post.excerpt.length <= 400);
  assert.ok(post.answer.length >= 60 && post.answer.length <= 900);
  assert.ok(post.sections.length >= 6);
  assert.ok(post.sections.every((section) => section.body.length >= 80));
  assert.ok(post.takeaways.length >= 3);
  assert.ok(post.checklist.length >= 5);
  assert.ok(post.questions.length >= 3);
  assert.equal(post.sources[0].url, radarDraft.sourceUrl);
  assert.equal(post.category, "Network Security");
});

test("internal fallback sources are normalized to public URLs", () => {
  const post = buildRadarPublicationPost({ ...radarDraft, sourceUrl: "/services/managed-network-services" });
  assert.equal(post.sources[0].url, "https://www.qcsstudio.com/services/managed-network-services");
});
