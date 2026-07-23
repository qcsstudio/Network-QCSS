import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requestContext } from "@/lib/security";
import { requestVerifyGridOnboarding } from "@/lib/verifygrid-onboarding";
import { sendVerifyGridVerificationEmail } from "@/lib/verifygrid-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const limited = rateLimit(request, { keyPrefix: "verifygrid-onboarding-request", max: 5, windowMs: 60 * 60_000 });
  if (limited) return limited;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  try {
    const result = await requestVerifyGridOnboarding(body.data, await requestContext());
    if (result.shouldSendVerification && result.request) {
      await sendVerifyGridVerificationEmail({
        email: result.request.email,
        displayName: result.request.displayName,
        organizationName: result.request.organizationName,
        requestId: result.requestId,
        tokenId: result.tokenId,
        verificationUrl: result.verificationUrl
      });
    }
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 450 - (Date.now() - startedAt))));
    return NextResponse.json(
      {
        ok: true,
        message: "If the request is eligible, a verification link will be sent to the work email provided.",
        ...(process.env.NODE_ENV === "development" && result.verificationUrl ? { verificationUrl: result.verificationUrl } : {})
      },
      { status: 202, headers: noStoreHeaders }
    );
  } catch (error) {
    console.error("Unable to accept VerifyGrid onboarding request.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to accept this onboarding request.", 400);
  }
}
