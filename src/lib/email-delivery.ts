import crypto from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { buildEmailDeliveryConfig, type EmailDeliveryProvider } from "@/lib/email-config";

export type OutboundEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
  idempotencyKey: string;
};

export type EmailDeliveryResult = {
  sent: boolean;
  reason: "sent" | "not_configured" | "provider_error";
  provider: EmailDeliveryProvider | null;
  providerId?: string;
};

let smtpTransport: Transporter | null = null;
let smtpTransportKey = "";

function deterministicMessageId(key: string) {
  const digest = crypto.createHash("sha256").update(key).digest("hex").slice(0, 40);
  return `<qcs-${digest}@qcsstudio.com>`;
}

function transporter(config: Extract<ReturnType<typeof buildEmailDeliveryConfig>, { provider: "smtp" }>) {
  const key = `${config.host}:${config.port}:${config.secure}:${config.user}`;
  if (smtpTransport && smtpTransportKey === key) return smtpTransport;
  smtpTransport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
    tls: { minVersion: "TLSv1.2" }
  });
  smtpTransportKey = key;
  return smtpTransport;
}

async function sendSmtp(input: OutboundEmailInput, config: Extract<ReturnType<typeof buildEmailDeliveryConfig>, { provider: "smtp" }>): Promise<EmailDeliveryResult> {
  try {
    const result = await transporter(config).sendMail({
      from: input.from || config.from,
      to: Array.isArray(input.to) ? input.to.join(", ") : input.to,
      replyTo: input.replyTo || config.replyTo || undefined,
      subject: input.subject,
      text: input.text,
      html: input.html,
      messageId: deterministicMessageId(input.idempotencyKey)
    });
    return { sent: true, reason: "sent", provider: "smtp", providerId: result.messageId };
  } catch (error) {
    console.error("SMTP email delivery failed.", {
      subject: input.subject,
      error: error instanceof Error ? error.message : "Unknown SMTP error"
    });
    return { sent: false, reason: "provider_error", provider: "smtp" };
  }
}

async function sendResend(input: OutboundEmailInput, config: Extract<ReturnType<typeof buildEmailDeliveryConfig>, { provider: "resend" }>): Promise<EmailDeliveryResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey.slice(0, 256)
      },
      body: JSON.stringify({
        from: input.from || config.from,
        to: Array.isArray(input.to) ? input.to : [input.to],
        reply_to: input.replyTo || config.replyTo || undefined,
        subject: input.subject,
        text: input.text,
        html: input.html
      }),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({})) as { id?: string };
    if (!response.ok) {
      console.error("Resend rejected an email.", { status: response.status, subject: input.subject });
      return { sent: false, reason: "provider_error", provider: "resend" };
    }
    return { sent: true, reason: "sent", provider: "resend", providerId: payload.id };
  } catch (error) {
    console.error("Resend email delivery failed.", {
      subject: input.subject,
      error: error instanceof Error ? error.message : "Unknown Resend error"
    });
    return { sent: false, reason: "provider_error", provider: "resend" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendEmail(input: OutboundEmailInput): Promise<EmailDeliveryResult> {
  const config = buildEmailDeliveryConfig();
  if (config.provider === "smtp") return sendSmtp(input, config);
  if (config.provider === "resend") return sendResend(input, config);
  return { sent: false, reason: "not_configured", provider: null };
}
