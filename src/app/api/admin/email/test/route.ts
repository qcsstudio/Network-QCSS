import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { sendEmail } from "@/lib/email-delivery";
import { rateLimit } from "@/lib/rate-limit";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function recipients() {
  const value = process.env.EMAIL_TEST_TO?.trim() || process.env.LEAD_ALERT_EMAIL_TO?.trim() || process.env.SMTP_USER?.trim() || "";
  return value.split(",").map((email) => email.trim()).filter(Boolean);
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  const limited = rateLimit(request, { keyPrefix: "admin-email-test", max: 3, windowMs: 10 * 60_000 });
  if (limited) return limited;
  const to = recipients();
  if (!to.length) return jsonError("Configure EMAIL_TEST_TO, LEAD_ALERT_EMAIL_TO, or SMTP_USER before testing email.", 400);

  const result = await sendEmail({
    to,
    subject: "QCS website email delivery test",
    text: "Email delivery from the QCS website is operational. This message was requested by an authenticated administrator.",
    html: "<p><strong>QCS website email delivery is operational.</strong></p><p>This message was requested by an authenticated administrator.</p>",
    idempotencyKey: `admin-email-test/${Date.now()}`
  });
  await createAuditLog({
    action: "admin.email_test",
    actor: "admin",
    target: result.provider || "email",
    metadata: { sent: result.sent, reason: result.reason, recipientCount: to.length }
  }, await requestContext()).catch((error) => console.error("Unable to audit the admin email test.", error));
  if (!result.sent) return jsonError(result.reason === "not_configured" ? "Email delivery is not configured." : "The email provider rejected the test message.", 502);
  return NextResponse.json({ ok: true, provider: result.provider, message: "Test email accepted for delivery." }, { headers: noStoreHeaders });
}
