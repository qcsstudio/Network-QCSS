import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import sharp from "sharp";

let state;
let writes;
let network;
let generated;
let capturedEvidence;
let eligible = true;
let graphMode = "success";
const pixels = await sharp({ create: { width: 1440, height: 810, channels: 3, background: "#4264bb" } }).jpeg().toBuffer();
const asset = { id: "image-1", generatedAt: new Date("2026-10-01T01:00:00Z"), status: "ready", heroImage: pixels, socialImage: pixels, provider: "black-forest-labs", agentTrace: { lineage: { hash: "reviewed-hash" } }, altText: "A specific routing scene" };
const prisma = {
  socialPublication: {
    findMany: async () => [],
    findFirst: async ({ where }) => where.status.in.includes(state.status) ? structuredClone(state) : null,
    updateMany: async ({ where, data }) => {
      if (where.status !== state.status) return { count: 0 };
      Object.assign(state, { ...data, attempts: data.attempts?.increment ? state.attempts + data.attempts.increment : state.attempts });
      writes.push(structuredClone(data));
      return { count: 1 };
    },
    update: async ({ data }) => { Object.assign(state, data); writes.push(structuredClone(data)); return state; }
  },
  editorialImage: { findUnique: async () => asset }
};
globalThis.__qcsMetaQueueTest = {
  prisma,
  published: () => eligible ? { slug: "routing-test", revision: "1", path: "/resources/routing-test" } : null,
  generate: (evidence) => { generated++; capturedEvidence = evidence; return { caption: "A reviewed platform caption.\n\nhttps://www.qcsstudio.com/resources/routing-test\n\n#BGP #RPKI #RoutingSecurity", trace: { approved: true } }; }
};
const mockModules = {
  "./prisma.ts": "export const getPrismaClient = () => globalThis.__qcsMetaQueueTest.prisma;",
  "./content.ts": "export const siteConfig = {url:'https://www.qcsstudio.com'};",
  "./editorial-delivery.ts": "export const publishedRevision = async () => globalThis.__qcsMetaQueueTest.published(); export const editorialDeliveryImageUrl = (_origin,_image,variant) => 'https://www.qcsstudio.com/api/editorial-media/image-1?variant='+variant;",
  "./editorial-image-generation.ts": "export const editorialImageInputForPublication = async () => ({title:'Routing test', context:'Complete reviewed source', lineage:{hash:'reviewed-hash'}});",
  "./editorial-revision-snapshots.ts": "export const resolveContentPostRevision = async () => ({content:{title:'Routing test', questions:[{question:'Limits?',answer:'FAQ-only safety qualification'}]}}); export const resolveSecurityAdvisoryRevision = async () => ({advisory:{fixedVersions:['7.0','7.2','7.4','7.6','7.7','10.0'],workaround:'No workaround',editorialTrace:{internal:true}}}); export const advisoryEditorialSnapshot = (value) => value;",
  "./editorial-story-lineage.ts": "export const lineageFromMetadata = (value) => value?.lineage;",
  "./meta-content-agents.ts": "export const createMetaCaption = async (_channel,evidence) => globalThis.__qcsMetaQueueTest.generate(evidence);"
};
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.endsWith("/meta-publications.ts") && mockModules[specifier]) return { url: `data:text/javascript,${encodeURIComponent(mockModules[specifier])}`, shortCircuit: true };
  return next(specifier, context);
} });
const { processMetaQueue } = await import("../src/lib/meta-publications.ts");
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
Object.assign(process.env, { META_PAGE_ACCESS_TOKEN: "test-token", META_APP_SECRET: "test-secret", META_FACEBOOK_PAGE_ID: "123", META_INSTAGRAM_ACCOUNT_ID: "456", META_INSTAGRAM_USERNAME: "qcsstudio", META_PUBLISHING_START_AT: "2026-10-01T00:00:00Z", META_PUBLISHING_ENABLED: "1" });
globalThis.fetch = async (url, options) => {
  const path = new URL(url).pathname;
  network.push({ path, method: options.method });
  const json = (value) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
  if (path.endsWith("/me")) return json({ id: "123", name: "QCS" });
  if (path.endsWith("/123")) return json({ instagram_business_account: { id: "456", username: "qcsstudio" } });
  if (path.endsWith("/content_publishing_limit")) return json({ data: [{ quota_usage: 0, config: { quota_total: 10 } }] });
  if (path.endsWith("/media")) return json({ id: "789" });
  if (path.endsWith("/789")) return json({ status_code: "FINISHED" });
  if (path.endsWith("/photos") || path.endsWith("/media_publish")) {
    assert.ok(state.metadata.dispatchStartedAt, "Dispatch marker must be durable before posting");
    if (graphMode === "timeout") throw new Error("Connection reset");
    return json({ id: "999", post_id: "123_999" });
  }
  if (path.endsWith("/999")) return json({ permalink: "https://www.instagram.com/p/test-post/" });
  throw new Error(`Unexpected test request ${path}`);
};
function reset(channel = "facebook") {
  writes = []; network = []; generated = 0; capturedEvidence = ''; eligible = true; graphMode = "success";
  state = { id: "job1", contentType: "content_post", contentId: "post1", contentRevision: "1", channel, status: "queued", commentary: "", attempts: 0, updatedAt: new Date(), metadata: null };
}

test("preview prepares and saves copy without any network publishing", async () => {
  reset();
  assert.equal((await processMetaQueue(false))[0].status, "ready");
  assert.equal(generated, 1);
  assert.equal(network.length, 0);
  assert.ok(state.commentary.includes("qcsstudio.com"));
  assert.ok(capturedEvidence.includes("FAQ-only safety qualification"));
});

test("advisory caption sees all fixed releases and qualifications without internal reviewer traces", async () => {
  reset(); state.contentType = "security_advisory";
  assert.equal((await processMetaQueue(false))[0].status, "ready");
  assert.deepEqual(JSON.parse(capturedEvidence).fixedVersions, ['7.0', '7.2', '7.4', '7.6', '7.7', '10.0']);
  assert.equal(JSON.parse(capturedEvidence).workaround, "No workaround");
  assert.equal(JSON.parse(capturedEvidence).editorialTrace, undefined);
});

test("unpublished or changed source fails before caption generation or upload", async () => {
  reset(); eligible = false;
  assert.equal((await processMetaQueue(true))[0].status, "blocked");
  assert.equal(generated, 0);
  assert.equal(network.length, 0);
});

test("Facebook records receipt and never republishes the same queued job", async () => {
  reset();
  assert.equal((await processMetaQueue(true))[0].status, "published");
  assert.equal(state.externalId, "123_999");
  assert.ok(state.metadata.deliveryReceipt.acceptedAt);
  assert.deepEqual(await processMetaQueue(true), []);
  assert.equal(network.filter((call) => call.path.endsWith("/photos")).length, 1);
});

test("Instagram saves its container before returning, then resumes without creating another or regenerating copy", async () => {
  reset("instagram");
  assert.equal((await processMetaQueue(true))[0].status, "retry");
  assert.equal(state.metadata.containerId, "789");
  assert.equal(network.filter((call) => call.path.endsWith("/media_publish")).length, 0);
  assert.equal((await processMetaQueue(true))[0].status, "published");
  assert.equal(state.externalId, "999");
  assert.equal(state.metadata.permalink, "https://www.instagram.com/p/test-post/");
  assert.equal(network.filter((call) => call.path.endsWith("/media")).length, 1);
  assert.equal(generated, 1);
});

test("uncertain dispatch is held for reconciliation and never retried automatically", async () => {
  reset(); graphMode = "timeout";
  assert.equal((await processMetaQueue(true))[0].status, "needs_review");
  assert.ok(state.metadata.dispatchStartedAt);
  assert.deepEqual(await processMetaQueue(true), []);
  assert.equal(network.filter((call) => call.path.endsWith("/photos")).length, 1);
});

test.after(() => {
  hook.deregister();
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env).filter((key) => key.startsWith("META_"))) {
    if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
  }
  delete globalThis.__qcsMetaQueueTest;
});
