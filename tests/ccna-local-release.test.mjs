import assert from "node:assert/strict";
import test from "node:test";
import { ccnaLocalReleaseEntry, ccnaLocalReleasePolicy, localReleaseSha, assertLocalReleaseQa, assertLocalCaption } from "../src/lib/ccna-local-release-policy.ts";
import { composeLinkedInProtocolCommentary } from "../src/lib/linkedin-commentary.ts";

test("daily course slots follow Day 10 at 11am IST, including weekends", () => {
  const entries = Array.from({ length: 50 }, (_, i) => ccnaLocalReleaseEntry(i + 11));
  assert.equal(entries[0].requestedLinkedInTime, "2026-10-19T05:30:00.000Z");
  assert.equal(entries[5].requestedLinkedInTime, "2026-10-24T05:30:00.000Z");
  assert.equal(entries.at(-1).requestedLinkedInTime, "2026-12-07T05:30:00.000Z");
  assert.equal(new Set(entries.map(x => x.websiteUrl)).size, 50);
  assert.ok(entries.every(x => x.state === "planned-not-generated" && x.linkedinState === "not-scheduled"));
  assert.equal(ccnaLocalReleasePolicy.cadence, "daily-including-weekends");
});

test("release plan cannot overwrite prior batch or invent days", () => {
  for (const day of [0, 7, 10, 61, NaN, 11.5]) assert.throws(() => ccnaLocalReleaseEntry(day));
});

test("visual QA binds all exact release artifacts and cannot be assumed", () => {
  const raw = "test content", caption = "test caption", image = new Uint8Array([1, 2, 3]);
  const qa = { day: 11, contentSha256: localReleaseSha(raw), captionSha256: localReleaseSha(caption), imageSha256: localReleaseSha(image), visualChecked: true, sourceLinksChecked: true, checkedAt: "2026-10-15T10:00:00Z", notes: "Synthetic unit-test fixture, not an actual lesson approval." };
  assert.doesNotThrow(() => assertLocalReleaseQa(qa, 11, raw, caption, image));
  assert.throws(() => assertLocalReleaseQa(qa, 11, raw + "changed", caption, image));
  assert.throws(() => assertLocalReleaseQa(qa, 11, raw, caption + "changed", image));
  assert.throws(() => assertLocalReleaseQa(qa, 11, raw, caption, new Uint8Array([4])));
  assert.throws(() => assertLocalReleaseQa({ ...qa, visualChecked: false }, 11, raw, caption, image));
});

test("caption must retain the exact chapter URL and distinct hashtags", () => {
  const caption = composeLinkedInProtocolCommentary({ hook: "CCNA Day 11 | Understand the return route before changing a gateway.", evidence: "The lesson uses a disconnected two-subnet practice network to compare a working gateway with a deliberately incorrect one.", interpretation: "A ping requires a reply path; a local address alone does not establish remote reachability or application health.", actions: ["Record the working settings and remote baseline", "Change only the return gateway in the isolated lab", "Restore the recorded gateway and repeat the same checks"], verification: "Record actual baseline, fault and rollback results, not assumed outputs.", question: "What evidence distinguishes a local link from a remote reply path?", hashtags: ["#CCNA", "#IPv4", "#GNS3", "#Networking", "#NetworkEngineering"], url: ccnaLocalReleaseEntry(11).websiteUrl, linkLabel: "Original QCS analysis", maxLength: 2700 });
  assert.doesNotThrow(() => assertLocalCaption(caption, 11));
  assert.throws(() => assertLocalCaption(caption.replace("ipv4-address-types-and-gateways", "wrong-lesson"), 11));
  assert.throws(() => assertLocalCaption(caption.replace("#IPv4", "#CCNA"), 11));
});

test("publication rejects a stale expected candidate before changing anything", async t => {
  const prior = globalThis.prisma;
  t.after(() => { if (prior) globalThis.prisma = prior; else delete globalThis.prisma; });
  let writes = 0;
  globalThis.prisma = { ccnaLesson: { findUnique: async () => ({ id: "fixture", content: { changed: true }, status: "draft" }), updateMany: async () => { writes++; } } };
  const { publishCcnaLesson } = await import("../src/lib/ccna-learning.ts");
  await assert.rejects(publishCcnaLesson("fixture", "test", false, "different-reviewed-digest"), /independently reviewed release candidate/);
  assert.equal(writes, 0);
});
