import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requestContext } from "@/lib/security";
import { createAuditLog, createLead } from "@/lib/store";
import { sendVerifyGridOnboardingAlert } from "@/lib/verifygrid-email";
import { verifyVerifyGridOnboardingEmail } from "@/lib/verifygrid-onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-onboarding-verify", max: 12, windowMs: 15 * 60_000 });
  if (limited) return limited;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const token = typeof (body.data as { token?: unknown }).token === "string" ? (body.data as { token: string }).token : "";

  try {
    const onboarding = await verifyVerifyGridOnboardingEmail(token);
    const context = await requestContext();
    await createLead(
      {
        name: onboarding.displayName,
        email: onboarding.email,
        phone: onboarding.phone,
        interest: onboarding.serviceLabel,
        challenge: onboarding.scopeSummary,
        pipeline: "VerifyGrid Client Onboarding",
        score: 90,
        consent: { necessary: true, analytics: false, marketing: false, personalization: false, contact: true },
        sourceProfile: { onboardingRequestId: onboarding.id, organizationName: onboarding.organizationName, serviceType: onboarding.serviceType }
      },
      context
    ).catch((error) => console.error("Unable to add verified onboarding to the lead funnel.", error));
    await Promise.all([
      createAuditLog({ action: "verifygrid.onboarding_email_verified", actor: onboarding.email, target: onboarding.id, metadata: { organizationName: onboarding.organizationName, serviceType: onboarding.serviceType } }, context),
      sendVerifyGridOnboardingAlert({ requestId: onboarding.id, organizationName: onboarding.organizationName, displayName: onboarding.displayName, email: onboarding.email, serviceLabel: onboarding.serviceLabel })
    ]);
    return NextResponse.json({ ok: true, status: "email_verified", reference: onboarding.reference }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "This verification link is invalid or expired.", 400);
  }
}

