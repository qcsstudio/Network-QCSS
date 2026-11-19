import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AutomatedMetaTransportError, createAutomatedMetaTransport } from "../src/lib/automated-advisory-transports.ts";

const env = Object.freeze({
  META_PAGE_ACCESS_TOKEN: "mock-page-token-not-a-secret",
  META_APP_SECRET: "mock-app-secret",
  META_FACEBOOK_PAGE_ID: "123",
  META_INSTAGRAM_ACCOUNT_ID: "456",
  META_INSTAGRAM_USERNAME: "qcsstudio",
  META_GRAPH_VERSION: "v26.0",
  AUTOMATED_ADVISORY_META_POLL_INTERVAL_MS: "0"
});
const input = Object.freeze({ caption: "A prospective advisory caption.", title: "A prospective advisory", videoUrl: "https://www.qcsstudio.com/automated-advisories/example/reel.mp4" });
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers });
const noopHooks = Object.freeze({ beforePublish: async () => {}, checkpoint: async () => {} });
const igQuota = { data: [{ quota_usage: 1, config: { quota_total: 100 } }] };
const igMedia = { id: "901", owner: { id: "456" }, permalink: "https://www.instagram.com/reel/QCS_abc/" };
const fbReady = { id: "789", status: { video_status: "ready" } };
const fbMedia = {
  id: "789", from: { id: "123" }, permalink_url: "https://www.facebook.com/reel/789/",
  status: { video_status: "ready", publishing_phase: { status: "completed", publish_status: "published" } }
};
const accounts = () => [
  { path: "/me", value: { id: "123" } },
  { path: "/123", value: { id: "123", instagram_business_account: { id: "456", username: "qcsstudio" } } }
];
const iq = (value = igQuota) => ({ path: "/456/content_publishing_limit", value });
const igSteps = () => [
  ...accounts(), iq(),
  { path: "/456/media", method: "POST", value: { id: "678" } },
  { path: "/678", value: { id: "678", status_code: "FINISHED" } },
  iq(),
  { path: "/456/media_publish", method: "POST", value: { id: "901" } },
  { path: "/901", value: igMedia }
];
const fbSteps = () => [
  ...accounts(),
  { path: "/123/video_reels", method: "POST", value: { video_id: "789", upload_url: "https://rupload.facebook.com/video-upload/v26.0/789" } },
  { path: "/video-upload/v26.0/789", host: "rupload.facebook.com", method: "POST", value: { success: true } },
  { path: "/789", value: fbReady },
  { path: "/123/video_reels", method: "POST", value: { success: true } },
  { path: "/789", value: fbMedia }
];

function mock(steps, config = env, hooks = noopHooks) {
  const calls = [];
  const fetcher = async (target, options) => {
    const url = new URL(target);
    const body = options.body ? JSON.parse(options.body) : undefined;
    const call = { url, options, body };
    calls.push(call);
    const step = steps[calls.length - 1];
    assert.ok(step, `Unexpected mock request: ${url.pathname}`);
    assert.equal(url.protocol, "https:");
    assert.equal(url.host, step.host || "graph.facebook.com");
    assert.equal(url.pathname, step.host ? step.path : `/${config.META_GRAPH_VERSION || "v26.0"}${step.path}`);
    assert.equal(options.method, step.method || "GET");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    assert.ok(!url.href.includes(env.META_PAGE_ACCESS_TOKEN));
    if (!step.host) {
      assert.equal(options.headers.Authorization, `Bearer ${config.META_PAGE_ACCESS_TOKEN}`);
      const proof = createHmac("sha256", config.META_APP_SECRET).update(config.META_PAGE_ACCESS_TOKEN).digest("hex");
      assert.equal(body?.appsecret_proof || url.searchParams.get("appsecret_proof"), proof);
    }
    step.check?.(call);
    if (step.error) throw step.error;
    if (step.respond) return step.respond(call);
    return json(step.value, step.status, step.headers);
  };
  return { api: createAutomatedMetaTransport(config, fetcher, hooks), calls };
}

function errorIs(state, stage, refs = {}) {
  return error => {
    assert.ok(error instanceof AutomatedMetaTransportError);
    assert.equal(error.state, state);
    assert.equal(error.stage, stage);
    assert.equal(error.publishAttempted, state === "needs_review");
    for (const [key, value] of Object.entries(refs)) assert.equal(error[key], value);
    const rendered = `${error.stack} ${JSON.stringify(error)}`;
    for (const forbidden of [env.META_PAGE_ACCESS_TOKEN, env.META_APP_SECRET, "provider-private-message"]) assert.ok(!rendered.includes(forbidden));
    return true;
  };
}

test("factory is dependency-injected, does not read the legacy enable flag, and verifies real Page linkage", async () => {
  const readKeys = [];
  const config = new Proxy(env, { get(target, key) { readKeys.push(key); return target[key]; } });
  const { api, calls } = mock(accounts(), config);
  assert.deepEqual(await api.verifyAccounts(), { pageId: "123", instagramId: "456" });
  assert.equal(calls.length, 2);
  assert.ok(!readKeys.includes("META_PUBLISHING_ENABLED"));
  assert.equal(calls[1].url.searchParams.get("fields"), "id,instagram_business_account{id,username}");
});

test("missing credentials, invalid IDs/version and excessive runtime bounds fail closed without fetching", () => {
  for (const change of [
    { META_PAGE_ACCESS_TOKEN: "" }, { META_APP_SECRET: "" }, { META_PAGE_ACCESS_TOKEN: "x\r\ny" },
    { META_FACEBOOK_PAGE_ID: "123/other" }, { META_INSTAGRAM_ACCOUNT_ID: "0" }, { META_GRAPH_VERSION: "v26.0/evil" },
    { AUTOMATED_ADVISORY_META_POLL_ATTEMPTS: "6" }, { AUTOMATED_ADVISORY_META_REQUEST_TIMEOUT_MS: "10001" },
    { AUTOMATED_ADVISORY_META_POLL_INTERVAL_MS: "-1" }
  ]) assert.throws(() => createAutomatedMetaTransport({ ...env, ...change }, () => assert.fail("No fetch allowed")), errorIs("blocked", "configuration"));
});

test("account verification works without hooks but every publish requires both functions before any network", async () => {
  let reads = 0;
  const readOnly = createAutomatedMetaTransport(env, async () => json(accounts()[reads++].value));
  assert.deepEqual(await readOnly.verifyAccounts(), { pageId: "123", instagramId: "456" });
  assert.equal(reads, 2);
  for (const hooks of [undefined, null, {}, { beforePublish: async () => {} }, { checkpoint: async () => {} }, { beforePublish: true, checkpoint: async () => {} }, { beforePublish: async () => {}, checkpoint: true }]) {
    let requests = 0;
    const api = createAutomatedMetaTransport(env, async () => { requests++; throw new Error("Unexpected network"); }, hooks);
    await assert.rejects(api.publishInstagram(input), errorIs("blocked", "validation"));
    await assert.rejects(api.publishFacebook(input), errorIs("blocked", "validation"));
    assert.equal(requests, 0);
  }
});

test("durable boundary hooks are awaited in order with frozen sanitized progress before upload/poll, final dispatch and receipt reads", async () => {
  for (const channel of ["Instagram", "Facebook"]) {
    const instagram = channel === "Instagram";
    const steps = instagram ? igSteps() : fbSteps();
    const events = [];
    const progressValues = [];
    for (const step of steps) step.check = () => events.push(`request:${step.method || "GET"}:${step.path}`);
    const hooks = {
      beforePublish: async () => { await Promise.resolve(); events.push("authorize"); },
      checkpoint: async progress => {
        await Promise.resolve();
        assert.ok(Object.isFrozen(progress));
        progressValues.push(progress);
        events.push(`checkpoint:${progress.stage}`);
      }
    };
    await mock(steps, env, hooks).api[`publish${channel}`](input);
    const refs = instagram ? { containerId: "678" } : { videoId: "789" };
    assert.deepEqual(progressValues, [
      { stage: "prepared", publishAttempted: false, ...refs },
      { stage: "dispatching", publishAttempted: true, ...refs },
      { stage: "accepted", publishAttempted: true, ...refs, externalId: instagram ? "901" : "789" }
    ]);
    const preparedAt = events.indexOf("checkpoint:prepared");
    assert.equal(events[preparedAt - 1], `request:POST:${instagram ? "/456/media" : "/123/video_reels"}`);
    assert.equal(events[preparedAt + 1], instagram ? "request:GET:/678" : "request:POST:/video-upload/v26.0/789");
    const dispatchingAt = events.indexOf("checkpoint:dispatching");
    assert.deepEqual(events.slice(dispatchingAt - 1, dispatchingAt + 4), [
      "authorize", "checkpoint:dispatching", "authorize", `request:POST:${instagram ? "/456/media_publish" : "/123/video_reels"}`, "checkpoint:accepted"
    ]);
    assert.equal(events[events.indexOf("checkpoint:accepted") + 1], `request:GET:/${instagram ? "901" : "789"}`);
    for (const progress of progressValues) {
      assert.ok(Object.keys(progress).every(key => ["stage", "publishAttempted", "containerId", "videoId", "externalId"].includes(key)));
      const serialized = JSON.stringify(progress);
      for (const forbidden of [env.META_PAGE_ACCESS_TOKEN, env.META_APP_SECRET, input.caption, input.videoUrl, "appsecret_proof", "provider-private-message"]) assert.ok(!serialized.includes(forbidden));
    }
  }
});

test("pending durable checkpoints prevent network progress until each write has completed", async () => {
  for (const channel of ["Instagram", "Facebook"]) {
    const instagram = channel === "Instagram";
    const gates = Object.fromEntries(["prepared", "dispatching", "accepted"].map(stage => {
      let reached;
      let release;
      const reachedPromise = new Promise(resolve => { reached = resolve; });
      const writePromise = new Promise(resolve => { release = resolve; });
      return [stage, { reached, release, reachedPromise, writePromise }];
    }));
    let authorizations = 0;
    const hooks = {
      beforePublish: async () => { authorizations++; },
      checkpoint: async progress => {
        const gate = gates[progress.stage];
        gate.reached();
        await gate.writePromise;
      }
    };
    const { api, calls } = mock(instagram ? igSteps() : fbSteps(), env, hooks);
    const outcome = api[`publish${channel}`](input);
    void outcome.catch(() => {});
    try {
      for (const [stage, expectedCalls, expectedAuthorizations] of [
        ["prepared", instagram ? 4 : 3, 0],
        ["dispatching", instagram ? 6 : 5, 1],
        ["accepted", instagram ? 7 : 6, 2]
      ]) {
        await gates[stage].reachedPromise;
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(calls.length, expectedCalls);
        assert.equal(authorizations, expectedAuthorizations);
        gates[stage].release();
      }
    } finally {
      for (const gate of Object.values(gates)) gate.release();
    }
    const received = await outcome;
    assert.equal(received.externalId, instagram ? "901" : "789");
  }
});

test("a failed prepared checkpoint retains the created ID and prevents all subsequent upload or polling", async () => {
  for (const channel of ["Instagram", "Facebook"]) {
    const instagram = channel === "Instagram";
    const steps = (instagram ? igSteps() : fbSteps()).slice(0, instagram ? 4 : 3);
    const hooks = {
      beforePublish: async () => assert.fail("No authorization expected"),
      checkpoint: async progress => {
        assert.equal(progress.stage, "prepared");
        throw new Error(`${env.META_PAGE_ACCESS_TOKEN} provider-private-message`);
      }
    };
    const { api, calls } = mock(steps, env, hooks);
    await assert.rejects(api[`publish${channel}`](input), errorIs("blocked", "preparation", instagram ? { containerId: "678" } : { videoId: "789" }));
    assert.equal(calls.length, steps.length);
    assert.ok(calls.every(call => call.url.hostname !== "rupload.facebook.com"));
  }
});

test("expired or throwing final authorization before or after checkpoint prevents the final POST", async () => {
  for (const channel of ["Instagram", "Facebook"]) for (const failOn of [1, 2]) {
    const instagram = channel === "Instagram";
    const steps = (instagram ? igSteps() : fbSteps()).slice(0, instagram ? 6 : 5);
    let authorizations = 0;
    const progressValues = [];
    let expired = false;
    const hooks = {
      beforePublish: async () => {
        authorizations++;
        if (authorizations === failOn) {
          if (failOn === 2) assert.equal(expired, true);
          throw new Error(`${env.META_APP_SECRET} provider-private-message expired proof`);
        }
      },
      checkpoint: async progress => {
        progressValues.push(progress);
        if (progress.stage === "dispatching") expired = true;
      }
    };
    const { api, calls } = mock(steps, env, hooks);
    await assert.rejects(api[`publish${channel}`](input), errorIs("blocked", "publish", instagram ? { containerId: "678" } : { videoId: "789" }));
    assert.equal(authorizations, failOn);
    assert.deepEqual(progressValues.map(progress => progress.stage), failOn === 1 ? ["prepared"] : ["prepared", "dispatching"]);
    assert.equal(calls.length, steps.length);
    assert.ok(calls.every(call => !call.url.pathname.endsWith("/media_publish") && call.body?.upload_phase !== "finish"));
  }
});

test("a failed dispatch checkpoint stops before final network with known IDs and no second authorization", async () => {
  for (const channel of ["Instagram", "Facebook"]) {
    const instagram = channel === "Instagram";
    const steps = (instagram ? igSteps() : fbSteps()).slice(0, instagram ? 6 : 5);
    let authorizations = 0;
    const hooks = {
      beforePublish: async () => { authorizations++; },
      checkpoint: async progress => {
        if (progress.stage === "dispatching") throw new Error(`${env.META_PAGE_ACCESS_TOKEN} provider-private-message`);
      }
    };
    const { api, calls } = mock(steps, env, hooks);
    await assert.rejects(api[`publish${channel}`](input), errorIs("blocked", "publish", instagram ? { containerId: "678" } : { videoId: "789" }));
    assert.equal(authorizations, 1);
    assert.equal(calls.length, steps.length);
  }
});

test("a failed accepted-ID checkpoint requires review and prevents receipt readback without losing the actual ID", async () => {
  for (const channel of ["Instagram", "Facebook"]) {
    const instagram = channel === "Instagram";
    const steps = (instagram ? igSteps() : fbSteps()).slice(0, instagram ? 7 : 6);
    const hooks = {
      beforePublish: async () => {},
      checkpoint: async progress => {
        if (progress.stage === "accepted") throw new Error(`${env.META_APP_SECRET} provider-private-message`);
      }
    };
    const { api, calls } = mock(steps, env, hooks);
    await assert.rejects(api[`publish${channel}`](input), errorIs("needs_review", "receipt", instagram ? { externalId: "901", containerId: "678" } : { externalId: "789", videoId: "789" }));
    assert.equal(calls.length, steps.length);
    assert.equal(calls.filter(call => call.url.pathname.endsWith("/media_publish") || call.body?.upload_phase === "finish").length, 1);
  }
});

test("wrong Page token, wrong linked Instagram, wrong Page response or username block every submission", async () => {
  const cases = [
    [{ path: "/me", value: { id: "999" } }],
    [accounts()[0], { path: "/123", value: { id: "999", instagram_business_account: { id: "456", username: "qcsstudio" } } }],
    [accounts()[0], { path: "/123", value: { id: "123", instagram_business_account: { id: "999", username: "qcsstudio" } } }],
    [accounts()[0], { path: "/123", value: { id: "123", instagram_business_account: { id: "456", username: "other" } } }],
    [accounts()[0], { path: "/123", value: { id: "123" } }]
  ];
  for (const steps of cases) for (const channel of ["Instagram", "Facebook"]) {
    const { api, calls } = mock(steps);
    await assert.rejects(api[`publish${channel}`](input), errorIs("blocked", "accounts"));
    assert.ok(calls.every(call => call.options.method === "GET"));
  }
});

test("static QCS video inputs reject endpoints, external hosts, credentials, queries, escapes and traversal before requests", async () => {
  for (const videoUrl of [
    "http://www.qcsstudio.com/videos/a.mp4", "https://qcsstudio.com/videos/a.mp4",
    "https://www.qcsstudio.com.evil.test/videos/a.mp4", "https://www.qcsstudio.com@evil.test/videos/a.mp4",
    "https://www.qcsstudio.com:443/videos/a.mp4", "https://www.qcsstudio.com/api/generate/a.mp4",
    "https://www.qcsstudio.com/videos/a.mp4?token=private", "https://www.qcsstudio.com/videos/a.mp4#x",
    "https://www.qcsstudio.com/videos/../a.mp4", "https://www.qcsstudio.com/videos/%2e%2e/a.mp4",
    "https://www.qcsstudio.com/videos/a.mp4\r\nheader:x", "https://www.qcsstudio.com/videos/a.svg", null
  ]) {
    const { api, calls } = mock([]);
    await assert.rejects(api.publishInstagram({ ...input, videoUrl }), errorIs("blocked", "validation"));
    await assert.rejects(api.publishFacebook({ ...input, videoUrl }), errorIs("blocked", "validation"));
    assert.equal(calls.length, 0);
  }
  const { api } = mock([]);
  await assert.rejects(api.publishInstagram({ ...input, caption: "x".repeat(2201) }), errorIs("blocked", "validation"));
  await assert.rejects(api.publishFacebook({ ...input, title: "" }), errorIs("blocked", "validation"));
});

test("Instagram uses the official REELS container, bounded status check, quota recheck, media_publish and actual owned permalink", async () => {
  const steps = igSteps();
  steps[3].check = ({ body, options }) => {
    assert.equal(options.headers["Content-Type"], "application/json");
    const { appsecret_proof, ...parameters } = body;
    assert.deepEqual(parameters, { media_type: "REELS", video_url: input.videoUrl, caption: input.caption, share_to_feed: true });
    assert.ok(appsecret_proof);
  };
  steps[6].check = ({ body }) => assert.equal(body.creation_id, "678");
  const { api, calls } = mock(steps);
  assert.deepEqual(await api.publishInstagram(input), { channel: "instagram", state: "published", externalId: "901", containerId: "678", permalink: igMedia.permalink });
  assert.equal(calls.length, steps.length);
  assert.equal(calls.filter(call => call.url.pathname.endsWith("/content_publishing_limit")).length, 2);
});

test("Facebook uses start, exact rupload with remote file_url, finish PUBLISHED, and verified actual receipt", async () => {
  const steps = fbSteps();
  steps[2].check = ({ body }) => assert.equal(body.upload_phase, "start");
  steps[3].check = ({ body, options }) => {
    assert.equal(body, undefined);
    assert.deepEqual(options.headers, { Authorization: `OAuth ${env.META_PAGE_ACCESS_TOKEN}`, file_url: input.videoUrl });
  };
  steps[5].check = ({ body }) => {
    const { appsecret_proof, ...parameters } = body;
    assert.deepEqual(parameters, { upload_phase: "finish", video_state: "PUBLISHED", video_id: "789", title: input.title, description: input.caption });
    assert.ok(appsecret_proof);
  };
  const { api, calls } = mock(steps);
  assert.deepEqual(await api.publishFacebook(input), { channel: "facebook", state: "published", externalId: "789", videoId: "789", permalink: fbMedia.permalink_url });
  assert.equal(calls.length, steps.length);
  assert.ok(calls.every(call => ["graph.facebook.com", "rupload.facebook.com"].includes(call.url.hostname)));
});

test("both official versioned and unversioned rupload paths are accepted", async () => {
  const steps = fbSteps();
  steps[2].value = { video_id: "789", upload_url: "https://rupload.facebook.com/video-upload/789" };
  steps[3].path = "/video-upload/789";
  await mock(steps).api.publishFacebook(input);
});

test("hostile upload URLs cannot receive a token or reach finish", async () => {
  for (const upload_url of [
    "http://rupload.facebook.com/video-upload/789", "https://rupload.facebook.com.evil.test/video-upload/789",
    "https://rupload.facebook.com@evil.test/video-upload/789", "https://user@rupload.facebook.com/video-upload/789",
    "https://rupload.facebook.com:443/video-upload/789", "https://rupload.facebook.com/video-upload/999",
    "https://rupload.facebook.com/video-upload/v25.0/789", "https://rupload.facebook.com/video-upload/789?access_token=x",
    "https://rupload.facebook.com/video-upload/789#x", "https://rupload.facebook.com/video-upload/%37%38%39",
    "https://rupload.facebook.com/a/../video-upload/789", "https://graph.facebook.com/video-upload/789", "//rupload.facebook.com/video-upload/789"
  ]) {
    const steps = fbSteps().slice(0, 3);
    steps[2].value = { video_id: "789", upload_url };
    const { api, calls } = mock(steps);
    await assert.rejects(api.publishFacebook(input), errorIs("blocked", "preparation", { videoId: "789" }));
    assert.equal(calls.length, 3);
  }
});

test("unverified or exhausted Instagram quota blocks preparation, and quota is checked again before final dispatch", async () => {
  for (const value of [
    { data: [] }, { data: [{ quota_usage: "1", config: { quota_total: 100 } }] },
    { data: [{ quota_usage: -1, config: { quota_total: 100 } }] }, { data: [{ quota_usage: 0 }] },
    { data: [{ quota_usage: 0, config: { quota_total: 0 } }] }
  ]) {
    const { api, calls } = mock([...accounts(), iq(value)]);
    await assert.rejects(api.publishInstagram(input), errorIs("blocked", "quota"));
    assert.equal(calls.length, 3);
  }
  const exhausted = { data: [{ quota_usage: 100, config: { quota_total: 100 } }] };
  await assert.rejects(mock([...accounts(), iq(exhausted)]).api.publishInstagram(input), errorIs("retry", "quota", { retrySeconds: 3600 }));
  const steps = igSteps().slice(0, 6);
  steps[5] = iq(exhausted);
  const { api, calls } = mock(steps);
  await assert.rejects(api.publishInstagram(input), errorIs("retry", "quota", { containerId: "678" }));
  assert.ok(calls.every(call => !call.url.pathname.endsWith("/media_publish")));
});

test("Facebook quota is UNMEASURED/provider-enforced with no unsupported edge reads, substitute quota queries or pagination", async () => {
  const { api, calls } = mock(fbSteps());
  await api.publishFacebook(input);
  assert.equal(calls.length, 7);
  const reads = calls.filter(call => call.options.method === "GET");
  assert.deepEqual(reads.map(call => call.url.pathname), ["/v26.0/me", "/v26.0/123", "/v26.0/789", "/v26.0/789"]);
  for (const call of reads) {
    assert.doesNotMatch(call.url.pathname, /\/(?:video_reels|videos|content_publishing_limit)$/);
    for (const parameter of ["since", "until", "limit", "after", "summary"]) assert.equal(call.url.searchParams.has(parameter), false);
  }
  assert.equal(calls.filter(call => call.url.pathname.endsWith("/video_reels") && call.options.method === "POST").length, 2);
  const source = await readFile(new URL("../src/lib/automated-advisory-transports.ts", import.meta.url), "utf8");
  assert.match(source, /Facebook quota is UNMEASURED\/provider-enforced, never assumed to be zero/);
  assert.doesNotMatch(source, /quotaPages|paging\.|cursors|Facebook publishing quota could not be verified/);
});

test("actual Facebook 429 rejections are sanitized pre-final failures or final needs_review, with no request retries", async () => {
  for (const code of [4, 613]) for (const index of [2, 5]) {
    const steps = fbSteps().slice(0, index + 1);
    Object.assign(steps[index], {
      status: 429,
      headers: { "retry-after": "77" },
      value: { error: { code, message: `${env.META_PAGE_ACCESS_TOKEN} provider-private-message`, error_data: { private: env.META_APP_SECRET } } }
    });
    const { api, calls } = mock(steps);
    const final = index === 5;
    await assert.rejects(api.publishFacebook(input), errorIs(final ? "needs_review" : "retry", final ? "publish" : "preparation", {
      channel: "facebook", httpStatus: 429, code, retrySeconds: final ? 0 : 77, ...(final ? { videoId: "789" } : {})
    }));
    assert.equal(calls.length, index + 1);
    assert.equal(calls.filter(call => call.body?.upload_phase === "start").length, 1);
    assert.equal(calls.filter(call => call.body?.upload_phase === "finish").length, final ? 1 : 0);
    assert.ok(calls.every(call => call.options.method !== "GET" || !/\/(?:video_reels|videos)$/.test(call.url.pathname)));
  }
});

test("Instagram processing polls only until FINISHED and handles failed, missing, published or foreign containers without dispatch", async () => {
  const steps = igSteps();
  steps.splice(4, 0, { path: "/678", value: { id: "678", status_code: "IN_PROGRESS" } });
  await mock(steps).api.publishInstagram(input);
  for (const status_code of ["ERROR", "EXPIRED", "PUBLISHED", "unknown", undefined]) {
    const failing = igSteps().slice(0, 5);
    failing[4].value = { id: "678", status_code, status: "provider-private-message" };
    await assert.rejects(mock(failing).api.publishInstagram(input), errorIs("blocked", "processing", { containerId: "678" }));
  }
  const foreign = igSteps().slice(0, 5);
  foreign[4].value = { id: "999", status_code: "FINISHED" };
  await assert.rejects(mock(foreign).api.publishInstagram(input), errorIs("blocked", "processing"));
  const pending = mock([...igSteps().slice(0, 4), ...Array.from({ length: 5 }, () => ({ path: "/678", value: { id: "678", status_code: "IN_PROGRESS" } }))]);
  await assert.rejects(pending.api.publishInstagram(input), errorIs("retry", "processing", { containerId: "678" }));
  assert.equal(pending.calls.length, 9);
});

test("Facebook processing is bounded before final dispatch and processing failures are safe", async () => {
  const steps = fbSteps();
  steps.splice(4, 0, { path: "/789", value: { id: "789", status: { video_status: "processing" } } });
  await mock(steps).api.publishFacebook(input);
  for (const status of [{ video_status: "error" }, ...["processing", "ready"].map(video_status => ({ video_status, processing_phase: { status: "error", error: { message: "provider-private-message" } } }))]) {
    const failing = fbSteps().slice(0, 5);
    failing[4].value = { id: "789", status };
    await assert.rejects(mock(failing).api.publishFacebook(input), errorIs("blocked", "processing", { videoId: "789" }));
  }
  const pending = mock([...fbSteps().slice(0, 4), ...Array.from({ length: 5 }, () => ({ path: "/789", value: { id: "789", status: { video_status: "processing" } } }))]);
  await assert.rejects(pending.api.publishFacebook(input), errorIs("retry", "processing", { videoId: "789" }));
  assert.equal(pending.calls.length, 9);
});

test("read failures, preparation errors and upload transmission errors are sanitized and retryable before final dispatch", async () => {
  const privateError = new Error(`${env.META_PAGE_ACCESS_TOKEN} provider-private-message`);
  await assert.rejects(mock([{ path: "/me", error: privateError }]).api.verifyAccounts(), errorIs("retry", "accounts"));
  const preparation = igSteps().slice(0, 4);
  preparation[3].error = privateError;
  await assert.rejects(mock(preparation).api.publishInstagram(input), errorIs("retry", "preparation"));
  const upload = fbSteps().slice(0, 4);
  upload[3].error = privateError;
  await assert.rejects(mock(upload).api.publishFacebook(input), errorIs("retry", "upload", { videoId: "789" }));
  for (const [status, code, state] of [[429, 4, "retry"], [503, 2, "retry"], [400, 190, "blocked"]]) {
    const { api } = mock([{ path: "/me", status, headers: { "retry-after": "77" }, value: { error: { code, message: `${env.META_PAGE_ACCESS_TOKEN} provider-private-message` } } }]);
    await assert.rejects(api.verifyAccounts(), errorIs(state, "accounts", { retrySeconds: state === "retry" ? 77 : 0, code, httpStatus: status }));
  }
});

test("API errors retain only numeric status/code/subcode details and authorization failures are not transient", async () => {
  for (const [status, providerError, state, code, subcode] of [
    [400, { code: 4, error_subcode: 1234 }, "retry", 4, 1234],
    [400, { code: 190, error_subcode: 463, is_transient: true }, "blocked", 190, 463],
    [403, { code: 200, is_transient: true }, "blocked", 200, undefined],
    [400, { code: 80002 }, "retry", 80002, undefined],
    [400, { code: env.META_PAGE_ACCESS_TOKEN, error_subcode: "provider-private-message" }, "blocked", undefined, undefined]
  ]) {
    const value = { error: { ...providerError, message: `${env.META_PAGE_ACCESS_TOKEN} provider-private-message`, error_data: { private: env.META_APP_SECRET }, fbtrace_id: "provider-private-message" } };
    await assert.rejects(mock([{ path: "/me", status, value }]).api.verifyAccounts(), errorIs(state, "accounts", { httpStatus: status, code, subcode }));
  }
  const steps = igSteps().slice(0, 7);
  steps[6].status = 400;
  steps[6].value = { error: { code: 190, error_subcode: 463, message: "provider-private-message" } };
  await assert.rejects(mock(steps).api.publishInstagram(input), errorIs("needs_review", "publish", { code: 190, subcode: 463, httpStatus: 400, retrySeconds: 0, containerId: "678" }));
});

test("all final-dispatch network, response, rejection and missing-ID failures require reconciliation, never automatic retry", async () => {
  for (const channel of ["Instagram", "Facebook"]) {
    const makeSteps = channel === "Instagram" ? igSteps : fbSteps;
    const index = channel === "Instagram" ? 6 : 5;
    for (const change of [
      { error: new Error(`${env.META_PAGE_ACCESS_TOKEN} provider-private-message`) },
      { value: {}, status: 502 }, { value: {}, status: 200 },
      { value: { error: { code: 4, message: "provider-private-message" } }, status: 429 },
      { value: { error: { code: 190 } }, status: 400 },
      { respond: () => new Response("provider-private-message", { status: 200 }) }
    ]) {
      const steps = makeSteps().slice(0, index + 1);
      Object.assign(steps[index], change);
      const { api, calls } = mock(steps);
      await assert.rejects(api[`publish${channel}`](input), errorIs("needs_review", "publish", channel === "Instagram" ? { containerId: "678" } : { videoId: "789" }));
      assert.equal(calls.length, index + 1);
      assert.equal(calls.filter(call => call.url.pathname.endsWith("/media_publish") || call.body?.upload_phase === "finish").length, 1);
    }
  }
});

test("post-publish missing, hostile, wrong-account or unreadable receipts remain uncertain with actual IDs for caller durability", async () => {
  for (const channel of ["Instagram", "Facebook"]) {
    const makeSteps = channel === "Instagram" ? igSteps : fbSteps;
    const good = channel === "Instagram" ? igMedia : fbMedia;
    const linkField = channel === "Instagram" ? "permalink" : "permalink_url";
    for (const change of [
      { value: { ...good, [linkField]: undefined } },
      { value: { ...good, [linkField]: "https://evil.test/reel/789" } },
      { value: { ...good, [linkField]: "https://www.facebook.com/reel/789?access_token=private" } },
      { value: { ...good, id: "999" } },
      { value: { ...good, owner: { id: "999" }, from: { id: "999" } } },
      { error: new Error(`${env.META_PAGE_ACCESS_TOKEN} provider-private-message`) }
    ]) {
      const steps = makeSteps();
      Object.assign(steps.at(-1), change);
      await assert.rejects(mock(steps).api[`publish${channel}`](input), errorIs("needs_review", "receipt", channel === "Instagram" ? { externalId: "901", containerId: "678" } : { externalId: "789", videoId: "789" }));
    }
  }
});

test("Facebook requires published status, not merely ready, and bounded post-publish polling cannot trigger reposts", async () => {
  const pendingReceipt = { ...fbMedia, status: { video_status: "ready", publishing_phase: { status: "in_progress", publish_status: "draft" } } };
  const successful = fbSteps();
  successful.splice(6, 0, { path: "/789", value: pendingReceipt });
  await mock(successful).api.publishFacebook(input);
  const pending = mock([...fbSteps().slice(0, 6), ...Array.from({ length: 5 }, () => ({ path: "/789", value: pendingReceipt }))]);
  await assert.rejects(pending.api.publishFacebook(input), errorIs("needs_review", "receipt", { externalId: "789" }));
  assert.equal(pending.calls.filter(call => call.body?.upload_phase === "finish").length, 1);
});

test("Facebook contradictory published status and mismatched permalink IDs never produce true receipts", async () => {
  for (const value of [
    { ...fbMedia, permalink_url: "https://www.facebook.com/reel/999/" },
    { ...fbMedia, status: { ...fbMedia.status, video_status: "error" } },
    { ...fbMedia, status: { ...fbMedia.status, processing_phase: { status: "error" } } }
  ]) {
    const steps = fbSteps();
    steps.at(-1).value = value;
    await assert.rejects(mock(steps).api.publishFacebook(input), errorIs("needs_review", "receipt", { externalId: "789" }));
  }
});

test("the total operation deadline prevents another request after the time bound", async () => {
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    const { api, calls } = mock([{ ...accounts()[0], check: () => { now += 90_001; } }]);
    await assert.rejects(api.verifyAccounts(), errorIs("retry", "accounts"));
    assert.equal(calls.length, 1);
  } finally { Date.now = originalNow; }
});

test("request and body deadlines work even with a fetch mock that ignores abort, including after final dispatch", async () => {
  const config = { ...env, AUTOMATED_ADVISORY_META_REQUEST_TIMEOUT_MS: "10" };
  await assert.rejects(createAutomatedMetaTransport(config, () => new Promise(() => {})).verifyAccounts(), errorIs("retry", "accounts"));
  let bodyCancelled = false;
  const unreadable = () => new Response(new ReadableStream({ start() {}, cancel() { bodyCancelled = true; } }));
  await assert.rejects(mock([{ path: "/me", respond: unreadable }], config).api.verifyAccounts(), errorIs("retry", "accounts"));
  assert.equal(bodyCancelled, true);
  const steps = igSteps().slice(0, 7);
  steps[6].respond = () => new Promise(() => {});
  await assert.rejects(mock(steps, config).api.publishInstagram(input), errorIs("needs_review", "publish", { containerId: "678" }));
});

test("oversize JSON, malformed JSON and redirected responses fail safely", async () => {
  for (const respond of [
    () => json({ id: "123", extra: "x".repeat(65536) }),
    () => new Response("provider-private-message"),
    () => { const response = json({ id: "123" }); Object.defineProperty(response, "redirected", { value: true }); return response; }
  ]) {
    await assert.rejects(mock([{ path: "/me", respond }]).api.verifyAccounts(), error => {
      assert.ok(error instanceof AutomatedMetaTransportError);
      assert.equal(error.publishAttempted, false);
      assert.ok(!error.message.includes("provider-private-message"));
      return true;
    });
  }
});

test("every publish rechecks ownership and source has no ambient environment, global fetch, generation, LinkedIn, deletes or schedules", async () => {
  const { api, calls } = mock([...igSteps(), { path: "/me", value: { id: "999" } }]);
  await api.publishInstagram(input);
  await assert.rejects(api.publishInstagram(input), errorIs("blocked", "accounts"));
  assert.equal(calls.filter(call => call.url.pathname.endsWith("/media_publish")).length, 1);
  const source = await readFile(new URL("../src/lib/automated-advisory-transports.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /process\.env|\bfetch\(|META_PUBLISHING_ENABLED|publishLinkedInPost|\bDELETE\b|scheduled_publish_time|api\.openai|imagegen|generateVideo/);
});
