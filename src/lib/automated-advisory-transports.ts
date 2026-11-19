import { createHmac } from "node:crypto";

export type AutomatedMetaState = "retry" | "blocked" | "needs_review";
export type AutomatedMetaStage = "configuration" | "validation" | "accounts" | "quota" | "preparation" | "upload" | "processing" | "publish" | "receipt";
type Channel = "facebook" | "instagram";
type ObjectValue = Record<string, unknown>;
type References = { channel?: Channel; containerId?: string; videoId?: string; externalId?: string; publishAttempted: boolean };
type Context = References & { stage: AutomatedMetaStage; deadline: number };
type ApiErrorDetails = { httpStatus?: number; code?: number; subcode?: number };

function safeCode(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export type AutomatedMetaEnv = Readonly<Record<string, string | undefined>>;
export type AutomatedMetaProgress = Readonly<{
  stage: "prepared" | "dispatching" | "accepted";
  publishAttempted: boolean;
  containerId?: string;
  videoId?: string;
  externalId?: string;
}>;
export type AutomatedMetaHooks = {
  beforePublish: () => Promise<void> | void;
  checkpoint: (progress: AutomatedMetaProgress) => Promise<void> | void;
};
export type AutomatedMetaReceipt = {
  channel: Channel;
  state: "published";
  externalId: string;
  permalink: string;
  containerId?: string;
  videoId?: string;
};

export class AutomatedMetaTransportError extends Error {
  readonly state: AutomatedMetaState;
  readonly stage: AutomatedMetaStage;
  readonly channel?: Channel;
  readonly containerId?: string;
  readonly videoId?: string;
  readonly externalId?: string;
  readonly publishAttempted: boolean;
  readonly retrySeconds: number;
  readonly httpStatus?: number;
  readonly code?: number;
  readonly subcode?: number;

  constructor(message: string, state: AutomatedMetaState, stage: AutomatedMetaStage, refs: References = { publishAttempted: false }, retrySeconds = 300, details: ApiErrorDetails = {}) {
    super(message);
    this.name = "AutomatedMetaTransportError";
    this.state = refs.publishAttempted ? "needs_review" : state;
    this.stage = stage;
    this.channel = refs.channel;
    this.containerId = refs.containerId;
    this.videoId = refs.videoId;
    this.externalId = refs.externalId;
    this.publishAttempted = refs.publishAttempted;
    this.retrySeconds = this.state === "retry" ? retrySeconds : 0;
    this.httpStatus = safeCode(details.httpStatus);
    this.code = safeCode(details.code);
    this.subcode = safeCode(details.subcode);
  }
}

const LIMITS = { requestMs: 10_000, operationMs: 90_000, pollAttempts: 5, pollIntervalMs: 1_000, responseBytes: 65_536 } as const;
const object = (value: unknown): ObjectValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
const numericId = (value: unknown): value is string => typeof value === "string" && /^[1-9]\d{0,39}$/.test(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function fail(context: Context, message: string, state: AutomatedMetaState = "blocked", retrySeconds = 300, details?: ApiErrorDetails): never {
  throw new AutomatedMetaTransportError(message, state, context.stage, context, retrySeconds, details);
}

function boundedSetting(env: AutomatedMetaEnv, key: string, fallback: number, min: number, max: number, context: Context) {
  const value = env[key];
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    fail(context, "Invalid automated Meta transport bounds.");
  }
  return Number(value);
}

function videoUrl(value: unknown, context: Context): string {
  // Static, public QCS assets only; no signed URLs, endpoints, escapes or redirects.
  if (typeof value !== "string" || value.length > 2_048 || !/^https:\/\/www\.qcsstudio\.com\/(?:videos|media|assets|images|reviewed-advisories|automated-advisories)\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.mp4$/.test(value)) {
    fail(context, "A public QCS static MP4 URL is required.");
  }
  return value;
}

function text(value: unknown, limit: number, context: Context): string {
  if (typeof value !== "string" || !value.trim() || [...value].length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    fail(context, "Invalid reel caption or title.");
  }
  return value;
}

function uploadUrl(value: unknown, id: string, version: string, context: Context): URL {
  const expected = [`https://rupload.facebook.com/video-upload/${id}`, `https://rupload.facebook.com/video-upload/${version}/${id}`];
  if (typeof value !== "string" || !expected.includes(value)) fail(context, "Meta returned an untrusted reel upload URL.");
  return new URL(value);
}

function permalink(value: unknown, channel: Channel, context: Context): string {
  if (typeof value !== "string" || value.length > 2_048 || /[\s\\%]/.test(value)) fail(context, "Meta returned no valid permalink.");
  let url: URL;
  try { url = new URL(value); } catch { fail(context, "Meta returned no valid permalink."); }
  const hosts = channel === "facebook" ? ["www.facebook.com", "facebook.com"] : ["www.instagram.com", "instagram.com"];
  if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.username || url.password || url.port || url.search || url.hash) {
    fail(context, "Meta returned no valid permalink.");
  }
  const validPath = channel === "instagram" ? /^\/(?:reel|p)\/[A-Za-z0-9_-]+\/?$/ : /^\/(?:reel\/[1-9]\d*\/?|[A-Za-z0-9_.-]+\/videos\/[1-9]\d*\/?)$/;
  if (!validPath.test(url.pathname) || (channel === "facebook" && url.pathname.split("/").filter(Boolean).at(-1) !== context.videoId)) fail(context, "Meta returned no valid permalink.");
  return value;
}

/**
 * No ambient env/fetch, enable flag, scheduling, media generation or persistence.
 * The worker must persist a dispatch intent BEFORE calling, then persist every
 * receipt/error (including the IDs and stage). A crash or needs_review outcome
 * must be reconciled, never automatically republished. `retry` only describes a
 * transient pre-final failure; it does not instruct the worker to re-dispatch.
 * The caller holds every failure for review and enforces its own admission and
 * cadence limits. Instagram quota is measured before preparation and final
 * dispatch; these reads cannot reserve capacity across workers.
 * Facebook quota is UNMEASURED/provider-enforced, never assumed to be zero.
 * GET /page/video_reels and /page/videos do not support Reading; there is no
 * replacement quota estimate here. Actual API rejections flow to caller holds.
 * Publishing requires both durable hooks; verifyAccounts remains read-only and
 * usable without them. beforePublish must throw if proof/claim validation fails.
 * The dispatching checkpoint intentionally records publishAttempted=true BEFORE
 * transmission so a caller recovering from a crash holds the job conservatively.
 * https://developers.facebook.com/docs/graph-api/reference/page/video_reels/
 * https://developers.facebook.com/docs/graph-api/reference/page/videos/
 */
export function createAutomatedMetaTransport(env: AutomatedMetaEnv, fetcher: typeof fetch, hooks?: AutomatedMetaHooks) {
  const initial: Context = { stage: "configuration", deadline: 0, publishAttempted: false };
  const token = env.META_PAGE_ACCESS_TOKEN?.trim();
  const secret = env.META_APP_SECRET?.trim();
  const pageId = env.META_FACEBOOK_PAGE_ID?.trim() || "";
  const instagramId = env.META_INSTAGRAM_ACCOUNT_ID?.trim() || "";
  const version = env.META_GRAPH_VERSION?.trim() || "v26.0";
  const expectedUsername = env.META_INSTAGRAM_USERNAME?.trim().replace(/^@/, "");
  if (!token || !secret || /[\r\n]/.test(token) || !numericId(pageId) || !numericId(instagramId) || !/^v[1-9]\d?\.0$/.test(version) || typeof fetcher !== "function") {
    fail(initial, "Missing or invalid automated Meta server configuration.");
  }
  const proof = createHmac("sha256", secret).update(token).digest("hex");
  const requestMs = boundedSetting(env, "AUTOMATED_ADVISORY_META_REQUEST_TIMEOUT_MS", LIMITS.requestMs, 1, LIMITS.requestMs, initial);
  const pollAttempts = boundedSetting(env, "AUTOMATED_ADVISORY_META_POLL_ATTEMPTS", LIMITS.pollAttempts, 1, LIMITS.pollAttempts, initial);
  const pollIntervalMs = boundedSetting(env, "AUTOMATED_ADVISORY_META_POLL_INTERVAL_MS", LIMITS.pollIntervalMs, 0, LIMITS.pollIntervalMs, initial);
  const context = (channel?: Channel): Context => ({ channel, stage: "accounts", deadline: Date.now() + LIMITS.operationMs, publishAttempted: false });

  function requireHooks(ctx: Context): AutomatedMetaHooks {
    const beforePublish = hooks?.beforePublish;
    const checkpoint = hooks?.checkpoint;
    if (typeof beforePublish !== "function" || typeof checkpoint !== "function") fail(ctx, "Publishing requires authorization and durable checkpoint hooks.");
    return { beforePublish, checkpoint };
  }

  async function checkpoint(callbacks: AutomatedMetaHooks, stage: AutomatedMetaProgress["stage"], ctx: Context) {
    const progress: AutomatedMetaProgress = Object.freeze({
      stage,
      publishAttempted: stage === "dispatching" || ctx.publishAttempted,
      ...(ctx.containerId ? { containerId: ctx.containerId } : {}),
      ...(ctx.videoId ? { videoId: ctx.videoId } : {}),
      ...(ctx.externalId ? { externalId: ctx.externalId } : {})
    });
    try { await callbacks.checkpoint(progress); } catch { fail(ctx, "Meta durable checkpoint failed; caller reconciliation is required."); }
  }

  async function authorize(callbacks: AutomatedMetaHooks, ctx: Context) {
    try { await callbacks.beforePublish(); } catch { fail(ctx, "Meta publication authorization could not be revalidated."); }
  }

  async function beforeFinalDispatch(callbacks: AutomatedMetaHooks, ctx: Context) {
    ctx.stage = "publish";
    await authorize(callbacks, ctx);
    await checkpoint(callbacks, "dispatching", ctx);
    await authorize(callbacks, ctx);
  }

  async function request(url: URL, init: RequestInit, ctx: Context): Promise<ObjectValue> {
    const remaining = ctx.deadline - Date.now();
    if (remaining <= 0) fail(ctx, "Meta operation reached its time bound.", "retry");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelBody: (() => void) | undefined;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetcher(url, { ...init, cache: "no-store", redirect: "error", signal: controller.signal });
          if (controller.signal.aborted || response.redirected) {
            void response.body?.cancel().catch(() => {});
            fail(ctx, "Meta response was late or redirected.", controller.signal.aborted ? "retry" : "blocked");
          }
          // Stream under the same deadline and byte cap; never retain raw errors.
          const reader = response.body?.getReader();
          let raw = "";
          if (reader) {
            cancelBody = () => { void reader.cancel().catch(() => {}); };
            const decoder = new TextDecoder();
            let bytes = 0;
            try {
              for (;;) {
                const chunk = await reader.read();
                if (chunk.done) break;
                bytes += chunk.value.byteLength;
                if (bytes > LIMITS.responseBytes) {
                  void reader.cancel().catch(() => {});
                  fail(ctx, "Meta response exceeded its size bound.");
                }
                raw += decoder.decode(chunk.value, { stream: true });
              }
              raw += decoder.decode();
            } finally {
              cancelBody = undefined;
              reader.releaseLock();
            }
          }
          let parsed: unknown;
          try { parsed = JSON.parse(raw); } catch { fail(ctx, "Meta response could not be verified.", "retry"); }
          const body = object(parsed);
          if (!response.ok || body.error) {
            const providerError = object(body.error);
            const code = safeCode(providerError.code);
            const subcode = safeCode(providerError.error_subcode);
            const authorizationFailure = response.status === 401 || response.status === 403 || [10, 190, 200].includes(code ?? -1);
            const transient = !authorizationFailure && (response.status === 408 || response.status === 429 || response.status >= 500 || [1, 2, 4, 17, 32, 613, 80001, 80002].includes(code ?? -1) || providerError.is_transient === true);
            const seconds = Number(response.headers.get("retry-after"));
            fail(ctx, "Meta API request was not accepted.", transient ? "retry" : "blocked", Number.isFinite(seconds) && seconds > 0 ? Math.min(86_400, Math.ceil(seconds)) : 300, { httpStatus: response.status, code, subcode });
          }
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) fail(ctx, "Meta response could not be verified.", "retry");
          return body;
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new AutomatedMetaTransportError("Meta request reached its time bound.", "retry", ctx.stage, ctx));
            controller.abort();
            cancelBody?.();
          }, Math.min(requestMs, remaining));
        })
      ]);
    } catch (error) {
      if (error instanceof AutomatedMetaTransportError) throw error;
      return fail(ctx, "Meta request or response transmission failed.", "retry");
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      controller.abort();
    }
  }

  function graph(path: string, params: Record<string, string | boolean>, ctx: Context, method: "GET" | "POST" = "GET") {
    const url = new URL(`https://graph.facebook.com/${version}/${path}`);
    const data = { ...params, appsecret_proof: proof };
    if (method === "GET") for (const [key, value] of Object.entries(data)) url.searchParams.set(key, String(value));
    return request(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
      ...(method === "POST" ? { body: JSON.stringify(data) } : {})
    }, ctx);
  }

  async function verify(ctx: Context) {
    ctx.stage = "accounts";
    const me = await graph("me", { fields: "id" }, ctx);
    if (me.id !== pageId) fail(ctx, "The token does not belong to the configured Facebook Page.");
    const page = await graph(pageId, { fields: "id,instagram_business_account{id,username}" }, ctx);
    const linked = object(page.instagram_business_account);
    if (page.id !== pageId || linked.id !== instagramId || (expectedUsername && (typeof linked.username !== "string" || linked.username.toLowerCase() !== expectedUsername.toLowerCase()))) {
      fail(ctx, "The configured Instagram account is not the account linked to this Page.");
    }
    return { pageId, instagramId };
  }

  async function checkInstagramQuota(ctx: Context) {
    ctx.stage = "quota";
    const result = await graph(`${instagramId}/content_publishing_limit`, { fields: "quota_usage,config" }, ctx);
    const row = Array.isArray(result.data) && result.data.length === 1 ? object(result.data[0]) : {};
    const total = object(row.config).quota_total;
    if (!count(row.quota_usage) || !count(total) || total === 0) fail(ctx, "Instagram publishing quota could not be verified.");
    if (row.quota_usage >= total) fail(ctx, "Instagram publishing quota is exhausted.", "retry", 3_600);
  }

  async function poll(ctx: Context, check: () => Promise<boolean>) {
    for (let attempt = 0; attempt < pollAttempts; attempt++) {
      if (attempt > 0 && pollIntervalMs > 0) {
        if (Date.now() + pollIntervalMs >= ctx.deadline) fail(ctx, "Meta operation reached its time bound.", "retry");
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }
      if (await check()) return;
    }
    fail(ctx, "Meta processing did not complete within the polling bound.", "retry");
  }

  return {
    verifyAccounts: () => verify(context()),

    async publishInstagram(input: { caption: string; videoUrl: string }): Promise<AutomatedMetaReceipt> {
      const ctx = context("instagram");
      ctx.stage = "validation";
      const callbacks = requireHooks(ctx);
      const source = videoUrl(input?.videoUrl, ctx);
      const caption = text(input?.caption, 2_200, ctx);
      await verify(ctx);
      await checkInstagramQuota(ctx);
      ctx.stage = "preparation";
      const container = await graph(`${instagramId}/media`, { media_type: "REELS", video_url: source, caption, share_to_feed: true }, ctx, "POST");
      if (!numericId(container.id)) fail(ctx, "Instagram returned no valid container ID.");
      ctx.containerId = container.id;
      await checkpoint(callbacks, "prepared", ctx);
      ctx.stage = "processing";
      await poll(ctx, async () => {
        const result = await graph(container.id as string, { fields: "id,status_code" }, ctx);
        if (result.id !== ctx.containerId) fail(ctx, "Instagram container identity could not be verified.");
        if (result.status_code === "FINISHED") return true;
        if (result.status_code !== "IN_PROGRESS") fail(ctx, "Instagram container is not publishable.");
        return false;
      });
      await checkInstagramQuota(ctx);
      await beforeFinalDispatch(callbacks, ctx);
      ctx.publishAttempted = true;
      const published = await graph(`${instagramId}/media_publish`, { creation_id: ctx.containerId }, ctx, "POST");
      if (!numericId(published.id)) fail(ctx, "Instagram publication has no valid receipt; reconcile before another attempt.");
      ctx.externalId = published.id;
      ctx.stage = "receipt";
      await checkpoint(callbacks, "accepted", ctx);
      const media = await graph(published.id, { fields: "id,permalink,owner" }, ctx);
      if (media.id !== ctx.externalId || object(media.owner).id !== instagramId) fail(ctx, "Instagram published media ownership could not be verified.");
      return { channel: "instagram", state: "published", externalId: published.id, containerId: ctx.containerId, permalink: permalink(media.permalink, "instagram", ctx) };
    },

    async publishFacebook(input: { caption: string; videoUrl: string; title: string }): Promise<AutomatedMetaReceipt> {
      const ctx = context("facebook");
      ctx.stage = "validation";
      const callbacks = requireHooks(ctx);
      const source = videoUrl(input?.videoUrl, ctx);
      const caption = text(input?.caption, 63_206, ctx);
      const title = text(input?.title, 255, ctx);
      await verify(ctx);
      ctx.stage = "preparation";
      const start = await graph(`${pageId}/video_reels`, { upload_phase: "start" }, ctx, "POST");
      if (!numericId(start.video_id)) fail(ctx, "Facebook returned no valid video ID.");
      ctx.videoId = start.video_id;
      await checkpoint(callbacks, "prepared", ctx);
      const upload = uploadUrl(start.upload_url, ctx.videoId, version, ctx);
      ctx.stage = "upload";
      const transferred = await request(upload, { method: "POST", headers: { Authorization: `OAuth ${token}`, file_url: source } }, ctx);
      if (transferred.success !== true) fail(ctx, "Facebook did not confirm the reel upload.", "retry");
      ctx.stage = "processing";
      await poll(ctx, async () => {
        const result = await graph(ctx.videoId!, { fields: "id,status" }, ctx);
        if (result.id !== ctx.videoId) fail(ctx, "Facebook video identity could not be verified.");
        const status = object(result.status);
        if ([status.uploading_phase, status.processing_phase, status.publishing_phase].some(phase => object(phase).status === "error" || object(phase).error)) fail(ctx, "Facebook video processing failed.");
        if (status.video_status === "ready") return true;
        if (!["processing", "uploading", "upload_complete"].includes(String(status.video_status))) fail(ctx, "Facebook video is not publishable.");
        return false;
      });
      await beforeFinalDispatch(callbacks, ctx);
      ctx.publishAttempted = true;
      const finished = await graph(`${pageId}/video_reels`, { upload_phase: "finish", video_state: "PUBLISHED", video_id: ctx.videoId, title, description: caption }, ctx, "POST");
      if (finished.success !== true) fail(ctx, "Facebook publication has no valid acknowledgement; reconcile before another attempt.");
      ctx.externalId = ctx.videoId;
      ctx.stage = "receipt";
      await checkpoint(callbacks, "accepted", ctx);
      let confirmedPermalink = "";
      await poll(ctx, async () => {
        const result = await graph(ctx.videoId!, { fields: "id,status,permalink_url,from" }, ctx);
        if (result.id !== ctx.videoId || object(result.from).id !== pageId) fail(ctx, "Facebook published video ownership could not be verified.");
        const status = object(result.status);
        const publishing = object(status.publishing_phase);
        if (["error", "expired", "upload_failed"].includes(String(status.video_status)) || [status.uploading_phase, status.processing_phase, status.publishing_phase].some(phase => object(phase).status === "error" || object(phase).error) || publishing.publish_status === "error") fail(ctx, "Facebook publication could not be confirmed.");
        if (status.video_status === "ready" && publishing.status === "completed" && publishing.publish_status === "published") {
          confirmedPermalink = permalink(result.permalink_url, "facebook", ctx);
          return true;
        }
        return false;
      });
      return { channel: "facebook", state: "published", externalId: ctx.videoId, videoId: ctx.videoId, permalink: confirmedPermalink };
    }
  };
}
