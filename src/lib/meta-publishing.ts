import crypto from "node:crypto";

export type MetaChannel = "facebook" | "instagram";
export type MetaFailure = "retry" | "blocked" | "needs_review";

export class MetaPublishingError extends Error {
  readonly state: MetaFailure;
  readonly retrySeconds: number;
  constructor(message: string, state: MetaFailure, retrySeconds = 300) {
    super(message);
    this.name = "MetaPublishingError";
    this.state = state;
    this.retrySeconds = retrySeconds;
  }
}

export function metaConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const required = ["META_PAGE_ACCESS_TOKEN", "META_APP_SECRET", "META_FACEBOOK_PAGE_ID", "META_INSTAGRAM_ACCOUNT_ID", "META_PUBLISHING_START_AT"];
  const missing = required.filter((key) => !env[key]?.trim());
  const pageId = env.META_FACEBOOK_PAGE_ID?.trim() || "";
  const instagramId = env.META_INSTAGRAM_ACCOUNT_ID?.trim() || "";
  const version = env.META_GRAPH_VERSION?.trim() || "v26.0";
  const startAt = env.META_PUBLISHING_START_AT?.trim() || "";
  const issues = [...missing.map((key) => `Set ${key} in the server environment.`)];
  if (pageId && !/^\d+$/.test(pageId)) issues.push("Facebook requires the numeric Page ID, not its share URL.");
  if (instagramId && !/^\d+$/.test(instagramId)) issues.push("Instagram requires the numeric professional account ID, not its username.");
  if (!/^v\d+\.0$/.test(version)) issues.push("Use a supported, versioned Meta Graph API release.");
  if (startAt && (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(startAt) || !Number.isFinite(Date.parse(startAt)))) issues.push("Use an ISO timestamp with timezone for META_PUBLISHING_START_AT.");
  return {
    configured: issues.length === 0,
    enabled: env.META_PUBLISHING_ENABLED === "1",
    pageId, instagramId, version, startAt, issues,
    instagramUsername: env.META_INSTAGRAM_USERNAME?.trim().replace(/^@/, "") || "qcsstudio"
  };
}

export function createMetaClient(fetcher: typeof fetch = fetch, env: NodeJS.ProcessEnv = process.env) {
  const config = metaConfiguration(env);
  async function request<T>(path: string, parameters: Record<string, string> = {}, method: "GET" | "POST" = "GET", publishes = false): Promise<T> {
    if (!config.configured) throw new MetaPublishingError(config.issues.join(" "), "blocked");
    if (!/^(?:me|\d+)(?:\/[a-z_]+)?$/.test(path)) throw new MetaPublishingError("Invalid Meta API path.", "blocked");
    const token = env.META_PAGE_ACCESS_TOKEN!.trim();
    const proof = crypto.createHmac("sha256", env.META_APP_SECRET!.trim()).update(token).digest("hex");
    const url = new URL(`https://graph.facebook.com/${config.version}/${path}`);
    const data = { ...parameters, appsecret_proof: proof };
    if (method === "GET") for (const [key, value] of Object.entries(data)) url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await fetcher(url, {
        method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${token}`, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
        ...(method === "POST" ? { body: JSON.stringify(data) } : {})
      });
    } catch {
      throw new MetaPublishingError(publishes ? "Meta may have received the post. Reconcile in Business Suite before another attempt." : "Meta could not be reached. No final publication was attempted.", publishes ? "needs_review" : "retry");
    }
    const body = await response.json().catch(() => null) as (T & { error?: { code?: number; error_subcode?: number } }) | null;
    if (!response.ok || body?.error || !body) {
      const code = body?.error?.code;
      // Never store provider messages: they may echo access tokens or request parameters.
      const description = `Meta API rejected the request (HTTP ${response.status}, code ${code ?? "unknown"}).`;
      if (publishes && (response.status >= 500 || !body)) throw new MetaPublishingError(`${description} Verify delivery before retrying.`, "needs_review");
      if (response.status === 429 || [4, 17, 32, 613, 80001].includes(code || 0)) {
        const seconds = Number(response.headers.get("retry-after"));
        throw new MetaPublishingError(`${description} Publishing is deferred.`, "retry", Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 86_400) : 900);
      }
      throw new MetaPublishingError(`${description} Check account permissions, token expiry and Page Publishing Authorization.`, "blocked");
    }
    return body;
  }
  return {
    async verifyAccounts() {
      const me = await request<{ id: string; name: string }>("me", { fields: "id,name" });
      if (me.id !== config.pageId) throw new MetaPublishingError("The Page token belongs to a different Facebook Page. Publishing is blocked.", "blocked");
      const page = await request<{ instagram_business_account?: { id: string; username: string } }>(config.pageId, { fields: "instagram_business_account{id,username}" });
      if (page.instagram_business_account?.id !== config.instagramId || page.instagram_business_account.username.toLowerCase() !== config.instagramUsername.toLowerCase()) {
        throw new MetaPublishingError("The configured Instagram ID or username does not match the account linked to this Page.", "blocked");
      }
      return { pageId: me.id, pageName: me.name, instagramId: config.instagramId, instagramUsername: page.instagram_business_account.username };
    },
    async checkInstagramQuota() {
      const result = await request<{ data?: Array<{ quota_usage: number; config?: { quota_total: number } }> }>(`${config.instagramId}/content_publishing_limit`, { fields: "quota_usage,config" });
      const quota = result.data?.[0];
      if (!quota || !Number.isFinite(quota.quota_usage) || !Number.isFinite(quota.config?.quota_total)) throw new MetaPublishingError("Instagram publishing quota could not be verified.", "blocked");
      if (quota.quota_usage >= quota.config!.quota_total) throw new MetaPublishingError("Instagram publishing quota is exhausted; the post remains queued.", "retry", 3600);
    },
    async createInstagramContainer(imageUrl: string, caption: string, altText: string) {
      const result = await request<{ id: string }>(`${config.instagramId}/media`, { image_url: imageUrl, caption, alt_text: altText, is_ai_generated: "true" }, "POST");
      if (!/^\d+$/.test(result.id || "")) throw new MetaPublishingError("Meta did not return a valid media container ID.", "blocked");
      return result.id;
    },
    containerStatus(id: string) { return request<{ status_code: string }>(id, { fields: "status_code" }); },
    async publishInstagram(containerId: string) {
      const result = await request<{ id: string }>(`${config.instagramId}/media_publish`, { creation_id: containerId }, "POST", true);
      if (!/^\d+$/.test(result.id || "")) throw new MetaPublishingError("Instagram delivery has no valid receipt. Check Business Suite.", "needs_review");
      return result.id;
    },
    async publishFacebook(imageUrl: string, caption: string, altText: string) {
      const result = await request<{ id: string; post_id?: string }>(`${config.pageId}/photos`, { url: imageUrl, caption, alt_text_custom: altText, published: "true" }, "POST", true);
      if (!/^\d+$/.test(result.id || "") || !/^\d+_\d+$/.test(result.post_id || "")) throw new MetaPublishingError("Facebook delivery has no valid post receipt. Check Business Suite.", "needs_review");
      return { externalId: result.post_id!, permalink: `https://www.facebook.com/${result.post_id}` };
    },
    instagramPermalink(id: string) { return request<{ permalink: string }>(id, { fields: "permalink" }); }
  };
}
