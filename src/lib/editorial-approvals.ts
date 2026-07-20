import crypto from "node:crypto";
import { getContentPost, approveContentPost, publishContentPost, publicationIssues } from "@/lib/content-posts";
import { randomActionToken, secureDigest } from "@/lib/integration-secrets";
import { getPrismaClient } from "@/lib/prisma";
import { processLinkedInQueue, queueLinkedInForContentPost } from "@/lib/social-publications";

type ApprovalAction = "approve_both" | "website_only" | "request_changes";

function whatsappConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const alertTo = process.env.WHATSAPP_ALERT_TO?.trim();
  const templateName = process.env.WHATSAPP_CONTENT_TEMPLATE_NAME?.trim();
  if (!accessToken || !phoneNumberId || !alertTo || !templateName) {
    throw new Error("WhatsApp editorial approval is not configured.");
  }
  return {
    accessToken,
    phoneNumberId,
    alertTo,
    templateName,
    language: process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en_US",
    apiVersion: process.env.WHATSAPP_API_VERSION?.trim() || "v23.0"
  };
}

function approvalHash(content: unknown) {
  return secureDigest(JSON.stringify(content));
}

function actionPayload(approvalId: string, action: ApprovalAction, token: string) {
  return `qcs:${approvalId}:${action}:${token}`;
}

async function sendApprovalTemplate(input: {
  approvalId: string;
  token: string;
  title: string;
  category: string;
  excerpt: string;
}) {
  const config = whatsappConfig();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.qcsstudio.com";
  const previewUrl = `${baseUrl}/content-review/${input.approvalId}?token=${encodeURIComponent(input.token)}`;
  const response = await fetch(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: config.alertTo,
      type: "template",
      template: {
        name: config.templateName,
        language: { code: config.language },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: input.title.slice(0, 180) },
              { type: "text", text: input.category.slice(0, 100) },
              { type: "text", text: input.excerpt.slice(0, 320) },
              { type: "text", text: previewUrl }
            ]
          },
          { type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: actionPayload(input.approvalId, "approve_both", input.token) }] },
          { type: "button", sub_type: "quick_reply", index: "1", parameters: [{ type: "payload", payload: actionPayload(input.approvalId, "website_only", input.token) }] },
          { type: "button", sub_type: "quick_reply", index: "2", parameters: [{ type: "payload", payload: actionPayload(input.approvalId, "request_changes", input.token) }] }
        ]
      }
    }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`WhatsApp approval delivery failed with HTTP ${response.status}: ${(await response.text()).slice(0, 1000)}`);
  const result = (await response.json()) as { messages?: Array<{ id?: string }> };
  return { messageId: result.messages?.[0]?.id || "", previewUrl };
}

export function whatsappEditorialConfigured() {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() &&
      process.env.WHATSAPP_ALERT_TO?.trim() &&
      process.env.WHATSAPP_CONTENT_TEMPLATE_NAME?.trim() &&
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() &&
      process.env.WHATSAPP_APP_SECRET?.trim() &&
      process.env.WHATSAPP_APPROVER_NUMBERS?.trim()
  );
}

export async function requestEditorialApproval(postId: string, actor: string) {
  const post = await getContentPost(postId);
  if (!post) throw new Error("Post not found.");
  if (post.status !== "draft") throw new Error("Only a saved draft can be sent for WhatsApp approval.");
  const issues = publicationIssues(post.content);
  if (issues.length) throw new Error(issues.join(" "));
  const revisionVersion = post.revisions[0]?.version || 1;
  const token = randomActionToken();
  const prisma = getPrismaClient();
  await prisma.contentApproval.updateMany({ where: { postId, status: "pending" }, data: { status: "superseded", decidedAt: new Date(), decidedBy: actor } });
  const approval = await prisma.contentApproval.create({
    data: {
      postId,
      revisionVersion,
      revisionHash: approvalHash(post.content),
      actionTokenHash: secureDigest(token),
      expiresAt: new Date(Date.now() + 72 * 60 * 60_000)
    }
  });
  try {
    const delivery = await sendApprovalTemplate({ approvalId: approval.id, token, title: post.title, category: post.content.category, excerpt: post.content.excerpt });
    await prisma.contentApproval.update({ where: { id: approval.id }, data: { whatsappMessageId: delivery.messageId } });
    return { approvalId: approval.id, status: "pending", previewUrl: delivery.previewUrl, expiresAt: approval.expiresAt.toISOString() };
  } catch (error) {
    await prisma.contentApproval.update({ where: { id: approval.id }, data: { status: "delivery_failed", decidedAt: new Date(), feedback: error instanceof Error ? error.message.slice(0, 1000) : "Delivery failed" } });
    throw error;
  }
}

function configuredApprovers() {
  return new Set(
    (process.env.WHATSAPP_APPROVER_NUMBERS || "")
      .split(",")
      .map((value) => value.replace(/\D/g, ""))
      .filter(Boolean)
  );
}

export function whatsappSenderAllowed(sender: string) {
  const normalized = sender.replace(/\D/g, "");
  return Boolean(normalized && configuredApprovers().has(normalized));
}

export function verifyWhatsAppSignature(rawBody: string, signature: string) {
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secret || !signature.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signature.slice(7);
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function parseApprovalPayload(value: string) {
  const matched = value.match(/^qcs:([^:]+):(approve_both|website_only|request_changes):([A-Za-z0-9_-]+)$/);
  return matched ? { approvalId: matched[1], action: matched[2] as ApprovalAction, token: matched[3] } : null;
}

export async function decideEditorialApproval(input: { approvalId: string; action: ApprovalAction; token: string; sender: string }) {
  if (!whatsappSenderAllowed(input.sender)) throw new Error("This WhatsApp sender is not an authorized editorial approver.");
  const prisma = getPrismaClient();
  const approval = await prisma.contentApproval.findUnique({ where: { id: input.approvalId } });
  if (!approval || approval.status !== "pending") throw new Error("This approval request is no longer active.");
  if (approval.expiresAt.getTime() <= Date.now()) {
    await prisma.contentApproval.update({ where: { id: approval.id }, data: { status: "expired", decidedAt: new Date() } });
    throw new Error("This approval request has expired.");
  }
  if (secureDigest(input.token) !== approval.actionTokenHash) throw new Error("The approval token is invalid.");
  const post = await getContentPost(approval.postId);
  if (!post) throw new Error("The article no longer exists.");
  if ((post.revisions[0]?.version || 1) !== approval.revisionVersion || approvalHash(post.content) !== approval.revisionHash) {
    await prisma.contentApproval.update({ where: { id: approval.id }, data: { status: "superseded", decidedAt: new Date(), decidedBy: input.sender } });
    throw new Error("The article changed after this approval request. Send a new review request.");
  }

  if (input.action === "request_changes") {
    await prisma.contentApproval.update({ where: { id: approval.id }, data: { status: "changes_requested", decidedAt: new Date(), decidedBy: input.sender } });
    return { action: input.action, post, published: false };
  }

  await approveContentPost(post.id, `whatsapp:${input.sender}`);
  const published = await publishContentPost(post.id, `whatsapp:${input.sender}`);
  if (!published) throw new Error("The article could not be published.");
  await prisma.contentApproval.update({
    where: { id: approval.id },
    data: { status: "approved", publishToLinkedIn: input.action === "approve_both", decidedAt: new Date(), decidedBy: input.sender }
  });
  if (input.action === "approve_both") {
    await queueLinkedInForContentPost(published);
    await processLinkedInQueue(1);
  }
  return { action: input.action, post: published, published: true };
}

export async function recordEditorialFeedback(sender: string, feedback: string) {
  if (!whatsappSenderAllowed(sender)) return null;
  const approval = await getPrismaClient().contentApproval.findFirst({
    where: { decidedBy: sender, status: "changes_requested" },
    orderBy: { decidedAt: "desc" }
  });
  if (!approval) return null;
  return getPrismaClient().contentApproval.update({
    where: { id: approval.id },
    data: { status: "feedback_received", feedback: feedback.trim().slice(0, 4000) }
  });
}

export async function getApprovalPreview(approvalId: string, token: string) {
  const approval = await getPrismaClient().contentApproval.findUnique({ where: { id: approvalId } });
  const reviewableStatuses = new Set(["pending", "changes_requested", "feedback_received"]);
  if (
    !approval ||
    !reviewableStatuses.has(approval.status) ||
    approval.expiresAt.getTime() <= Date.now() ||
    secureDigest(token) !== approval.actionTokenHash
  ) {
    return null;
  }
  const post = await getContentPost(approval.postId);
  if (!post || (post.revisions[0]?.version || 1) !== approval.revisionVersion || approvalHash(post.content) !== approval.revisionHash) return null;
  return { approval, post };
}

export async function getEditorialApprovalSummary() {
  const prisma = getPrismaClient();
  const [counts, latest] = await Promise.all([
    prisma.contentApproval.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.contentApproval.findMany({ orderBy: { requestedAt: "desc" }, take: 12, include: { post: { select: { title: true, slug: true } } } })
  ]);
  return {
    configured: whatsappEditorialConfigured(),
    counts: Object.fromEntries(counts.map((entry) => [entry.status, entry._count._all])),
    latest: latest.map((entry) => ({
      id: entry.id,
      title: entry.post.title,
      slug: entry.post.slug,
      revisionVersion: entry.revisionVersion,
      status: entry.status,
      publishToLinkedIn: entry.publishToLinkedIn,
      feedback: entry.feedback || "",
      requestedAt: entry.requestedAt.toISOString(),
      expiresAt: entry.expiresAt.toISOString()
    }))
  };
}
