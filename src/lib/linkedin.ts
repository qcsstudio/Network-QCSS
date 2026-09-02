import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "@/lib/integration-secrets";
import { assertLinkedInProtocol } from "@/lib/linkedin-commentary";
import {
  decodeLinkedInLittleText,
  encodeLinkedInLittleText,
  linkedInLittleTextMatches
} from "@/lib/linkedin-little-text";

const linkedinAuthorizeUrl = "https://www.linkedin.com/oauth/v2/authorization";
const linkedinTokenUrl = "https://www.linkedin.com/oauth/v2/accessToken";
const linkedinUserInfoUrl = "https://api.linkedin.com/v2/userinfo";
const linkedinApiBase = "https://api.linkedin.com/rest";
const requestTimeoutMs = 15_000;
const readBackDelaysMs = [0, 700, 1_600];

type LinkedInTokenResponse = {
  access_token: string;
  expires_in: number;
  scope?: string;
};

type LinkedInUserInfo = {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

class LinkedInApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: string
  ) {
    super(message);
    this.name = "LinkedInApiError";
  }
}

type LinkedInPublishInput = {
  commentary: string;
  imageUrl?: string;
  imageAlt?: string;
};

function config() {
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("LinkedIn OAuth is not configured.");
  }
  return { clientId, clientSecret, redirectUri };
}
function apiHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "Linkedin-Version": process.env.LINKEDIN_API_VERSION?.trim() || "202607",
    "X-Restli-Protocol-Version": "2.0.0"
  };
}

async function responseError(response: Response, operation: string) {
  const body = (await response.text()).slice(0, 1200);
  return new LinkedInApiError(`${operation} failed with HTTP ${response.status}${body ? `: ${body}` : "."}`, response.status, body);
}

function isRestrictedPostRead(error: unknown) {
  return (
    error instanceof LinkedInApiError &&
    error.status === 403 &&
    /partnerApiPostsExternal\.GET/i.test(error.responseBody)
  );
}

export function linkedinConfigured() {
  return Boolean(
    process.env.LINKEDIN_CLIENT_ID?.trim() &&
      process.env.LINKEDIN_CLIENT_SECRET?.trim() &&
      process.env.LINKEDIN_REDIRECT_URI?.trim() &&
      process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY?.trim()
  );
}

export function linkedInAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = config();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "openid profile w_member_social"
  });
  return `${linkedinAuthorizeUrl}?${params.toString()}`;
}

export async function connectLinkedInAccount(code: string) {
  const { clientId, clientSecret, redirectUri } = config();
  const tokenResponse = await fetch(linkedinTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }),
    signal: AbortSignal.timeout(requestTimeoutMs),
    cache: "no-store"
  });
  if (!tokenResponse.ok) throw await responseError(tokenResponse, "LinkedIn token exchange");
  const token = (await tokenResponse.json()) as LinkedInTokenResponse;
  if (!token.access_token || !token.expires_in) throw new Error("LinkedIn returned an incomplete access token response.");

  const userResponse = await fetch(linkedinUserInfoUrl, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(requestTimeoutMs),
    cache: "no-store"
  });
  if (!userResponse.ok) throw await responseError(userResponse, "LinkedIn identity lookup");
  const user = (await userResponse.json()) as LinkedInUserInfo;
  if (!user.sub) throw new Error("LinkedIn did not return a member identifier.");

  const accountName = user.name || [user.given_name, user.family_name].filter(Boolean).join(" ") || "LinkedIn member";
  const expiresAt = new Date(Date.now() + token.expires_in * 1000);
  const metadata = { picture: user.picture || "" } as Prisma.InputJsonValue;
  return getPrismaClient().integrationConnection.upsert({
    where: { provider: "linkedin" },
    update: {
      accountId: user.sub,
      accountName,
      encryptedAccessToken: encryptIntegrationSecret(token.access_token),
      scope: token.scope || "openid profile w_member_social",
      expiresAt,
      status: "connected",
      metadata
    },
    create: {
      provider: "linkedin",
      accountId: user.sub,
      accountName,
      encryptedAccessToken: encryptIntegrationSecret(token.access_token),
      scope: token.scope || "openid profile w_member_social",
      expiresAt,
      status: "connected",
      metadata
    }
  });
}

export async function getLinkedInStatus() {
  if (!linkedinConfigured()) return { configured: false, connected: false, status: "not_configured" as const };
  const connection = await getPrismaClient().integrationConnection.findUnique({ where: { provider: "linkedin" } });
  if (!connection) return { configured: true, connected: false, status: "disconnected" as const };
  const expired = connection.expiresAt.getTime() <= Date.now();
  return {
    configured: true,
    connected: connection.status === "connected" && !expired,
    status: expired ? ("expired" as const) : connection.status,
    accountName: connection.accountName,
    expiresAt: connection.expiresAt.toISOString(),
    scope: connection.scope
  };
}

export async function disconnectLinkedInAccount() {
  await getPrismaClient().integrationConnection.deleteMany({ where: { provider: "linkedin" } });
}

async function activeConnection() {
  const connection = await getPrismaClient().integrationConnection.findUnique({ where: { provider: "linkedin" } });
  if (!connection || connection.status !== "connected") throw new Error("LinkedIn is not connected.");
  if (connection.expiresAt.getTime() <= Date.now() + 5 * 60_000) {
    await getPrismaClient().integrationConnection.update({ where: { id: connection.id }, data: { status: "expired" } });
    throw new Error("LinkedIn authorization has expired. Reconnect it from the admin dashboard.");
  }
  return { ...connection, accessToken: decryptIntegrationSecret(connection.encryptedAccessToken) };
}

async function uploadImage(accessToken: string, owner: string, imageUrl: string) {
  const initializeResponse = await fetch(`${linkedinApiBase}/images?action=initializeUpload`, {
    method: "POST",
    headers: apiHeaders(accessToken),
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
    signal: AbortSignal.timeout(requestTimeoutMs),
    cache: "no-store"
  });
  if (!initializeResponse.ok) throw await responseError(initializeResponse, "LinkedIn image initialization");
  const initialized = (await initializeResponse.json()) as { value?: { uploadUrl?: string; image?: string } };
  const uploadUrl = initialized.value?.uploadUrl;
  const image = initialized.value?.image;
  if (!uploadUrl || !image) throw new Error("LinkedIn did not return an image upload target.");

  const sourceResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(requestTimeoutMs), cache: "no-store" });
  if (!sourceResponse.ok) throw await responseError(sourceResponse, "Generated social image download");
  const contentType = sourceResponse.headers.get("content-type") || "image/png";
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: await sourceResponse.arrayBuffer(),
    signal: AbortSignal.timeout(requestTimeoutMs)
  });
  if (!uploadResponse.ok) throw await responseError(uploadResponse, "LinkedIn image upload");
  return image;
}

async function fetchLinkedInPost(accessToken: string, externalId: string) {
  const response = await fetch(`${linkedinApiBase}/posts/${encodeURIComponent(externalId)}`, {
    headers: apiHeaders(accessToken),
    signal: AbortSignal.timeout(requestTimeoutMs),
    cache: "no-store"
  });
  if (!response.ok) throw await responseError(response, "LinkedIn post lookup");
  return response.json() as Promise<Record<string, unknown>>;
}

async function verifyLinkedInCommentary(accessToken: string, externalId: string, expectedCommentary: string) {
  let observedCommentary = "";
  let lastError: Error | null = null;

  for (const delayMs of readBackDelaysMs) {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      const post = await fetchLinkedInPost(accessToken, externalId);
      observedCommentary = typeof post.commentary === "string" ? post.commentary : "";
      if (linkedInLittleTextMatches(observedCommentary, expectedCommentary)) {
        const decodedCommentary = decodeLinkedInLittleText(observedCommentary);
        assertLinkedInProtocol(decodedCommentary);
        return {
          liveCommentaryHash: crypto.createHash("sha256").update(decodedCommentary).digest("hex"),
          liveCommentaryLength: decodedCommentary.length,
          verifiedAt: new Date().toISOString()
        };
      }
    } catch (error) {
      if (isRestrictedPostRead(error)) {
        return {
          liveReadback: "unavailable_missing_partner_permission",
          verificationMode: "accepted_write_plus_validated_little_text",
          writeAcceptedAt: new Date().toISOString()
        };
      }
      lastError = error instanceof Error ? error : new Error("Unknown LinkedIn read-back error");
    }
  }

  if (lastError && !observedCommentary) throw lastError;
  throw new Error(
    `LinkedIn accepted the write but live commentary verification failed: expected ${expectedCommentary.length} characters, observed ${decodeLinkedInLittleText(observedCommentary).length}.`
  );
}

async function deleteLinkedInPostWithToken(accessToken: string, externalId: string) {
  const response = await fetch(`${linkedinApiBase}/posts/${encodeURIComponent(externalId)}`, {
    method: "DELETE",
    headers: { ...apiHeaders(accessToken), "X-RestLi-Method": "DELETE" },
    signal: AbortSignal.timeout(requestTimeoutMs),
    cache: "no-store"
  });
  if (response.status === 404) return;
  if (!response.ok) throw await responseError(response, "LinkedIn post deletion");
}

export async function publishLinkedInPost(input: LinkedInPublishInput) {
  const connection = await activeConnection();
  const author = `urn:li:person:${connection.accountId}`;
  const image = input.imageUrl ? await uploadImage(connection.accessToken, author, input.imageUrl) : "";
  const commentary = assertLinkedInProtocol(input.commentary);
  const transportCommentary = encodeLinkedInLittleText(commentary);
  const body = {
    author,
    commentary: transportCommentary,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    ...(image ? { content: { media: { id: image, altText: (input.imageAlt || "QCS network security intelligence").slice(0, 120) } } } : {}),
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false
  };
  const response = await fetch(`${linkedinApiBase}/posts`, {
    method: "POST",
    headers: apiHeaders(connection.accessToken),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(requestTimeoutMs),
    cache: "no-store"
  });
  if (!response.ok) throw await responseError(response, "LinkedIn post publication");
  const externalId = response.headers.get("x-restli-id") || response.headers.get("x-linkedin-id") || "";
  if (!externalId) throw new Error("LinkedIn published the post without returning a post identifier.");
  let verification;
  try {
    verification = await verifyLinkedInCommentary(connection.accessToken, externalId, commentary);
  } catch (error) {
    await deleteLinkedInPostWithToken(connection.accessToken, externalId).catch(() => undefined);
    throw error;
  }
  return {
    externalId,
    permalink: `https://www.linkedin.com/feed/update/${externalId}/`,
    receipt: {
      apiVersion: process.env.LINKEDIN_API_VERSION?.trim() || "202607",
      commentaryHash: crypto.createHash("sha256").update(commentary).digest("hex"),
      commentaryLength: commentary.length,
      transportCommentaryHash: crypto.createHash("sha256").update(transportCommentary).digest("hex"),
      transportCommentaryLength: transportCommentary.length,
      ...verification,
      imageAssetId: image
    }
  };
}

export async function getLinkedInPost(externalId: string) {
  const connection = await activeConnection();
  return fetchLinkedInPost(connection.accessToken, externalId);
}

export async function updateLinkedInPostCommentary(externalId: string, commentary: string) {
  const connection = await activeConnection();
  const validatedCommentary = assertLinkedInProtocol(commentary);
  const transportCommentary = encodeLinkedInLittleText(validatedCommentary);
  const response = await fetch(`${linkedinApiBase}/posts/${encodeURIComponent(externalId)}`, {
    method: "POST",
    headers: { ...apiHeaders(connection.accessToken), "X-RestLi-Method": "PARTIAL_UPDATE" },
    body: JSON.stringify({ patch: { $set: { commentary: transportCommentary } } }),
    signal: AbortSignal.timeout(requestTimeoutMs),
    cache: "no-store"
  });
  if (!response.ok) throw await responseError(response, "LinkedIn post update");
  const verification = await verifyLinkedInCommentary(connection.accessToken, externalId, validatedCommentary);
  return {
    apiVersion: process.env.LINKEDIN_API_VERSION?.trim() || "202607",
    commentaryHash: crypto.createHash("sha256").update(validatedCommentary).digest("hex"),
    commentaryLength: validatedCommentary.length,
    transportCommentaryHash: crypto.createHash("sha256").update(transportCommentary).digest("hex"),
    transportCommentaryLength: transportCommentary.length,
    ...verification
  };
}

export async function deleteLinkedInPost(externalId: string) {
  const connection = await activeConnection();
  return deleteLinkedInPostWithToken(connection.accessToken, externalId);
}
