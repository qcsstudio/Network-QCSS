import { siteConfig } from "@/lib/content";
import { sendEmail } from "@/lib/email-delivery";
import { emailDeliveryConfigured } from "@/lib/email-config";

type EmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
};

export type VerifyGridEmailResult = {
  sent: boolean;
  reason: "sent" | "not_configured" | "provider_error";
  provider?: "smtp" | "resend";
  providerId?: string;
};

function configuredSender() {
  return process.env.VERIFYGRID_EMAIL_FROM?.trim() || process.env.LEAD_ALERT_EMAIL_FROM?.trim() || "";
}

function onboardingAlertRecipients() {
  const value = process.env.VERIFYGRID_ONBOARDING_ALERT_TO?.trim() || process.env.LEAD_ALERT_EMAIL_TO?.trim() || "";
  return value.split(",").map((email) => email.trim()).filter(Boolean);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

export function verifyGridEmailConfigured() {
  return emailDeliveryConfigured();
}

async function sendVerifyGridEmail(input: EmailInput): Promise<VerifyGridEmailResult> {
  const from = configuredSender();
  const result = await sendEmail({ ...input, from: from || undefined });
  return {
    sent: result.sent,
    reason: result.reason,
    provider: result.provider || undefined,
    providerId: result.providerId
  };
}

function emailShell(title: string, body: string, actionLabel?: string, actionUrl?: string) {
  const action = actionLabel && actionUrl
    ? `<p style="margin:28px 0"><a href="${actionUrl}" style="display:inline-block;background:#4169c9;color:#fff;text-decoration:none;padding:12px 18px;font-weight:700">${actionLabel}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f7fb;color:#172136;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:36px 22px"><div style="background:#fff;border-top:4px solid #4169c9;padding:30px"><p style="margin:0 0 10px;color:#d43272;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">QCS VerifyGrid</p><h1 style="margin:0 0 18px;font-size:26px">${title}</h1>${body}${action}<p style="margin:28px 0 0;color:#667085;font-size:13px;line-height:1.6">QuantumCrafters Studio Pvt. Ltd.<br>${siteConfig.url}</p></div></div></body></html>`;
}

export function sendVerifyGridVerificationEmail(input: { email: string; displayName: string; organizationName: string; requestId: string; tokenId: string; verificationUrl: string }) {
  const displayName = escapeHtml(input.displayName);
  const organizationName = escapeHtml(input.organizationName);
  const text = [
    `Hello ${input.displayName},`,
    "",
    `Verify your work email to continue the ${input.organizationName} VerifyGrid onboarding request:`,
    input.verificationUrl,
    "",
    "This link expires in 30 minutes and can be used once. Email verification does not authorize testing. QCS reviews the request before creating workspace access."
  ].join("\n");
  return sendVerifyGridEmail({
    to: input.email,
    subject: "Verify your QCS VerifyGrid onboarding request",
    text,
    html: emailShell(
      "Verify your work email",
      `<p style="line-height:1.7">Hello ${displayName}, verify your work email to continue the <strong>${organizationName}</strong> onboarding request.</p><p style="line-height:1.7;color:#667085">The link expires in 30 minutes. Verification does not authorize testing; QCS reviews the request before workspace access is created.</p>`,
      "Verify email",
      input.verificationUrl
    ),
    idempotencyKey: `verifygrid-onboarding-verification/${input.requestId}/${input.tokenId}`
  });
}

export function sendVerifyGridOnboardingAlert(input: { requestId: string; organizationName: string; displayName: string; email: string; serviceLabel: string }) {
  const recipients = onboardingAlertRecipients();
  if (!recipients.length) return Promise.resolve<VerifyGridEmailResult>({ sent: false, reason: "not_configured" });
  const adminUrl = `${siteConfig.url}/admin#verifygrid-onboarding`;
  const text = [
    "A VerifyGrid onboarding request has a verified work email and is ready for review.",
    `Organization: ${input.organizationName}`,
    `Contact: ${input.displayName} <${input.email}>`,
    `Service: ${input.serviceLabel}`,
    `Review: ${adminUrl}`
  ].join("\n");
  return sendVerifyGridEmail({
    to: recipients,
    subject: `VerifyGrid onboarding review: ${input.organizationName}`,
    text,
    html: emailShell(
      "Verified onboarding request",
      `<p style="line-height:1.7"><strong>${escapeHtml(input.organizationName)}</strong> requested ${escapeHtml(input.serviceLabel)}. The verified contact is ${escapeHtml(input.displayName)} (${escapeHtml(input.email)}).</p>`,
      "Review request",
      adminUrl
    ),
    idempotencyKey: `verifygrid-onboarding-alert/${input.requestId}`
  });
}

export function sendVerifyGridAccessEmail(input: { email: string; displayName: string; organizationName: string; accessUrl: string; tokenId: string }) {
  const text = [
    `Hello ${input.displayName || "there"},`,
    "",
    `QCS approved the VerifyGrid workspace access request for ${input.organizationName}.`,
    input.accessUrl,
    "",
    "This link expires and can be used once. Scope and written authorization remain separate controls inside the engagement."
  ].join("\n");
  return sendVerifyGridEmail({
    to: input.email,
    subject: `Your ${input.organizationName} VerifyGrid access link`,
    text,
    html: emailShell(
      "Your workspace is ready",
      `<p style="line-height:1.7">Hello ${escapeHtml(input.displayName || "there")}, QCS approved access to the <strong>${escapeHtml(input.organizationName)}</strong> VerifyGrid workspace.</p><p style="line-height:1.7;color:#667085">This one-time link expires. Scope and written authorization remain separate engagement controls.</p>`,
      "Open VerifyGrid",
      input.accessUrl
    ),
    idempotencyKey: `verifygrid-access/${input.tokenId}`
  });
}

export function sendVerifyGridPortalLinksEmail(input: { email: string; links: Array<{ organizationName: string; accessUrl: string; tokenId: string }> }) {
  const rows = input.links.map((item) => `${item.organizationName}: ${item.accessUrl}`);
  const actions = input.links.map((item) => `<p style="margin:18px 0"><strong>${escapeHtml(item.organizationName)}</strong><br><a href="${item.accessUrl}" style="display:inline-block;margin-top:8px;background:#4169c9;color:#fff;text-decoration:none;padding:11px 16px;font-weight:700">Open workspace</a></p>`).join("");
  return sendVerifyGridEmail({
    to: input.email,
    subject: "Your QCS VerifyGrid sign-in link",
    text: ["Use the one-time link below to sign in. It expires in one hour.", "", ...rows, "", "If you did not request this message, you can ignore it."].join("\n"),
    html: emailShell("Your sign-in link", `<p style="line-height:1.7">Use the one-time workspace link below. It expires in one hour.</p>${actions}<p style="line-height:1.7;color:#667085">If you did not request this message, you can ignore it.</p>`),
    idempotencyKey: `verifygrid-portal-links/${input.links.map((item) => item.tokenId).join("-")}`
  });
}

export function sendVerifyGridReportReadyEmail(input: {
  to: string[];
  organizationName: string;
  reportTitle: string;
  reportType: string;
  version: number;
  portalUrl: string;
  reportId: string;
}) {
  if (!input.to.length) return Promise.resolve<VerifyGridEmailResult>({ sent: false, reason: "not_configured" });
  const text = [
    `${input.reportTitle} is ready in QCS VerifyGrid.`,
    "",
    `Organization: ${input.organizationName}`,
    `Report: ${input.reportType} v${input.version}`,
    `Open the client portal: ${input.portalUrl}`,
    "",
    "The released report includes its integrity hash and release record. Use your one-time sign-in flow if your portal session has expired."
  ].join("\n");
  return sendVerifyGridEmail({
    to: input.to,
    subject: `VerifyGrid report ready: ${input.reportTitle}`,
    text,
    html: emailShell(
      "Your assurance report is ready",
      `<p style="line-height:1.7"><strong>${escapeHtml(input.reportTitle)}</strong> has been released for ${escapeHtml(input.organizationName)}.</p><p style="line-height:1.7;color:#667085">Report type: ${escapeHtml(input.reportType)} v${input.version}. The portal record includes the report integrity hash and release evidence.</p>`,
      "Open client portal",
      input.portalUrl
    ),
    idempotencyKey: `verifygrid-report-ready/${input.reportId}/v${input.version}`
  });
}
