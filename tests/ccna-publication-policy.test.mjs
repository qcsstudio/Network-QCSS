import assert from "node:assert/strict";
import test from "node:test";
import { ccnaPublicationJob, ccnaFailureSummary } from "../src/lib/ccna-publication-policy.ts";
import { ccnaCurriculum, ccnaCourseFacts, ccnaExamStatus } from "../src/lib/ccna-curriculum.ts";

test("the editorial resume endpoint is authenticated and never starts an unsolicited daily edition", async (t) => {
  const previousPrisma = globalThis.prisma;
  const previousSecret = process.env.CRON_SECRET;
  t.after(() => {
    if (previousPrisma) globalThis.prisma = previousPrisma; else delete globalThis.prisma;
    if (previousSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previousSecret;
  });
  process.env.CRON_SECRET = "isolated-ccna-test-secret";
  let lookups = 0;
  globalThis.prisma = { ccnaLesson: { findFirst: async ({ where }) => {
    lookups++;
    assert.deepEqual(where.generationTrace, { path: ["publicationJob", "delivery"], equals: "pending" });
    return null;
  } } };
  const { GET } = await import("../src/app/api/cron/ccna-daily/route.ts");
  const url = "https://www.qcsstudio.com/api/cron/ccna-daily?queuedOnly=1";
  assert.equal((await GET(new Request(url))).status, 401);
  assert.equal(lookups, 0);
  const response = await GET(new Request(url, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result.action, "not_due");
  assert.equal(lookups, 1);
});

test("publication intent requires a bounded structured job, never an arbitrary truthy flag", () => {
  for (const trace of [null, {}, { publicationJob: true }, { publicationJob: { runs: 99 } }]) assert.equal(ccnaPublicationJob(trace), null);
  const publicationJob = { requestedAt: "2026-09-15T10:00:00Z", actor: "admin", runs: 0, delivery: "pending" };
  assert.deepEqual(ccnaPublicationJob({ publicationJob }), publicationJob);
});

test("billing and schema errors are distinguished from temporary capacity waits", () => {
  assert.match(ccnaFailureSummary("429 You have no credits remaining"), /billing.*waiting does not resolve/);
  assert.match(ccnaFailureSummary("400 Invalid schema Unsupported keywords allOf"), /compatibility.*not a lesson quality/);
  assert.equal(ccnaFailureSummary("Provider capacity pause"), "Provider capacity pause");
});

test("exam transition changes on the announced date and never treats an announcement as current early", () => {
  assert.match(ccnaExamStatus(new Date("2027-02-02T23:59:59Z")).activeVersion, /v1.1/);
  assert.match(ccnaExamStatus(new Date("2027-02-03T00:00:00Z")).activeVersion, /v2.0/);
  assert.equal(ccnaExamStatus(new Date("2026-10-16T00:00:00Z")).verificationDue, true);
  assert.equal(ccnaCourseFacts.verifiedAt, "2026-09-15");
});

test("corrected syllabus maps retain all 60 stable lesson URLs and mark supporting content honestly", () => {
  assert.equal(ccnaCurriculum.length, 60);
  const bySlug = new Map(ccnaCurriculum.map((topic) => [topic.slug, topic]));
  for (const [slug, reference] of [["tcp-versus-udp", "1.5"], ["ipv4-addressing-foundations", "1.6"], ["ipv6-notation-and-prefixes", "1.8"], ["ethernet-switching-and-mac-learning", "1.13"], ["virtualization-containers-and-cloud-networks", "1.12"]]) assert.equal(bySlug.get(slug).v11, reference);
  for (const slug of ["ntp-and-network-time", "qos-foundations", "rest-api-foundations", "json-for-network-engineers"]) assert.match(bySlug.get(slug).v20, /not a named objective/);
  assert.match(bySlug.get("wireless-client-troubleshooting").objective, /Windows, macOS and Linux/);
  assert.match(bySlug.get("ssh-scp-and-secure-administration").objective, /SFTP\/SCP/);
  assert.match(bySlug.get("ansible-and-terraform").objective, /Execute.*Ansible/);
});
