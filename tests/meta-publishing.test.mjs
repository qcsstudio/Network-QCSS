import assert from "node:assert/strict";
import test from "node:test";
import { createMetaClient, metaConfiguration } from "../src/lib/meta-publishing.ts";
import { composeMetaCaption } from "../src/lib/meta-caption-policy.ts";

const env = { META_PAGE_ACCESS_TOKEN: "fake-test-token", META_APP_SECRET: "fake-secret", META_FACEBOOK_PAGE_ID: "123", META_INSTAGRAM_ACCOUNT_ID: "456", META_INSTAGRAM_USERNAME: "qcsstudio", META_PUBLISHING_START_AT: "2026-10-01T00:00:00Z" };
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });

test("Meta is off by default and its public configuration never exposes credentials", () => {
  assert.equal(metaConfiguration({}).configured, false);
  assert.equal(metaConfiguration(env).configured, true);
  assert.equal(metaConfiguration(env).enabled, false);
  assert.ok(!JSON.stringify(metaConfiguration(env)).includes("fake-test-token"));
  assert.equal(metaConfiguration({ ...env, META_FACEBOOK_PAGE_ID: "https://facebook.com/share/abc" }).configured, false);
  assert.equal(metaConfiguration({ ...env, META_PUBLISHING_START_AT: "2026-10-01" }).configured, false);
});

test("Page ownership and linked Instagram identity must match", async () => {
  let calls = 0;
  const api = createMetaClient(async (url, options) => {
    assert.ok(!String(url).includes("fake-test-token"));
    assert.equal(options.headers.Authorization, "Bearer fake-test-token");
    assert.equal(options.redirect, "error");
    calls++;
    return calls === 1 ? json({ id: "123", name: "QCS" }) : json({ instagram_business_account: { id: "456", username: "qcsstudio" } });
  }, env);
  assert.equal((await api.verifyAccounts()).instagramUsername, "qcsstudio");
  const wrong = createMetaClient(async () => json({ id: "987", name: "Other" }), env);
  await assert.rejects(wrong.verifyAccounts(), (error) => error.state === "blocked");
});

test("wrong linked Instagram username blocks publication", async () => {
  let call = 0;
  const api = createMetaClient(async () => ++call === 1 ? json({ id: "123" }) : json({ instagram_business_account: { id: "456", username: "someoneelse" } }), env);
  await assert.rejects(api.verifyAccounts(), /does not match/);
});

test("Facebook uses caption, public image and accessibility fields and requires a post receipt", async () => {
  const api = createMetaClient(async (url, options) => {
    assert.equal(new URL(url).pathname, "/v26.0/123/photos");
    const body = JSON.parse(options.body);
    assert.equal(body.caption, "Verified caption");
    assert.equal(body.message, undefined);
    assert.equal(body.alt_text_custom, "A specific technical relationship");
    assert.ok(body.appsecret_proof);
    return json({ id: "789", post_id: "123_789" });
  }, env);
  assert.equal((await api.publishFacebook("https://www.qcsstudio.com/media.jpg", "Verified caption", "A specific technical relationship")).externalId, "123_789");
  await assert.rejects(createMetaClient(async () => json({ id: "789" }), env).publishFacebook("image", "text", "alt"), (e) => e.state === "needs_review");
});

test("Instagram container has AI disclosure and alt text, then publishes the persisted container ID", async () => {
  const calls = [];
  const api = createMetaClient(async (url, options) => { calls.push({ url: String(url), body: JSON.parse(options.body) }); return json({ id: "789" }); }, env);
  assert.equal(await api.createInstagramContainer("https://www.qcsstudio.com/image.jpg", "Caption", "Full scene"), "789");
  assert.equal(calls[0].body.is_ai_generated, "true");
  assert.equal(calls[0].body.alt_text, "Full scene");
  await api.publishInstagram("789");
  assert.equal(calls[1].body.creation_id, "789");
  assert.ok(calls[1].url.endsWith("456/media_publish"));
});

test("Instagram quota is checked dynamically; missing or exhausted quota never permits publishing", async () => {
  await createMetaClient(async () => json({ data: [{ quota_usage: 1, config: { quota_total: 5 } }] }), env).checkInstagramQuota();
  await assert.rejects(createMetaClient(async () => json({ data: [{ quota_usage: 5, config: { quota_total: 5 } }] }), env).checkInstagramQuota(), (e) => e.state === "retry");
  await assert.rejects(createMetaClient(async () => json({ data: [] }), env).checkInstagramQuota(), (e) => e.state === "blocked");
});

test("rate limiting respects Retry-After and never leaks provider error text", async () => {
  const api = createMetaClient(async () => json({ error: { code: 4, message: "fake-test-token" } }, 429, { "Retry-After": "77" }), env);
  await assert.rejects(api.publishInstagram("789"), (e) => e.state === "retry" && e.retrySeconds === 77 && !e.message.includes("fake-test-token"));
});

test("network errors or 5xx after final dispatch require reconciliation, not automatic reposting", async () => {
  for (const fetcher of [async () => { throw new Error("fake-test-token"); }, async () => json({}, 502)]) {
    await assert.rejects(createMetaClient(fetcher, env).publishInstagram("789"), (e) => e.state === "needs_review" && !e.message.includes("fake-test-token"));
  }
});

const evidence = "The router compares the origin ASN with the published ROA. A valid origin does not validate the complete AS path.";
const draft = {
  hook: "A valid route origin is useful evidence, not proof of the entire route.",
  explanation: "RPKI origin validation compares a route's origin with published authorization. It helps an operator decide which advertisements need investigation, without proving the entire AS path is safe.",
  actions: ["Compare the observed origin with the ROA before changing policy.", "Record the validation state and investigate unexpected changes."],
  qualification: "Origin validity does not validate the complete AS path.",
  hashtags: ["#RPKI", "#BGP", "#RoutingSecurity", "#NetworkEngineering", "#NetworkSecurity"],
  evidence: [{ claim: "The origin is compared with authorization.", quote: "The router compares the origin ASN with the published ROA." }, { claim: "An origin check does not prove the full path.", quote: "A valid origin does not validate the complete AS path." }]
};
const source = "https://www.qcsstudio.com/resources/rpki-route-validation";

test("platform captions have spacing, a full original link and precise hashtags without pretending Instagram links are clickable", () => {
  for (const channel of ["facebook", "instagram"]) {
    const caption = composeMetaCaption(channel, draft, source, evidence);
    assert.ok(caption.includes(source));
    assert.match(caption, /\n\n/);
    assert.match(caption, /#RPKI #BGP #RoutingSecurity/);
    assert.ok([...caption].length <= 2200);
    if (channel === "instagram") assert.match(caption, /may not be clickable/);
    else assert.doesNotMatch(caption, /link.*bio/i);
  }
});

test("unsupported evidence, clipped text and wrong-domain links are blocked", () => {
  assert.throws(() => composeMetaCaption("instagram", draft, source, "Unrelated evidence"), /quote/);
  assert.throws(() => composeMetaCaption("instagram", { ...draft, hook: "This is an incomplete and misleading hook..." }, source, evidence), /clipped/);
  assert.throws(() => composeMetaCaption("facebook", draft, "https://attacker.example/resources/rpki", evidence), /original/);
});
