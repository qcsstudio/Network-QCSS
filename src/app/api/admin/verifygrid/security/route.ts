import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession, isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { auditVerifyGrid } from "@/lib/verifygrid-admin-api";
import {
  completeAuthentication,
  completeRegistration,
  createAuthenticationOptions,
  createRegistrationOptions,
  getVerifyGridAccessState,
  revokeOperatorSession,
  verifyGridOperatorCookieName,
  verifyGridOperatorCookieOptions
} from "@/lib/verifygrid-operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ceremonySchema = z.object({
  action: z.enum(["registration_options", "registration_verify", "authentication_options", "authentication_verify"]),
  response: z.unknown().optional(),
  label: z.string().trim().max(80).optional()
});

async function adminIdentity(request: Request) {
  if (!isAdminRequest(request)) return null;
  return getAdminSession();
}

export async function GET(request: Request) {
  const session = await adminIdentity(request);
  if (!session) return jsonError("Unauthorized", 401);
  try {
    const access = await getVerifyGridAccessState(session.email);
    return NextResponse.json({ ok: true, access }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to read VerifyGrid operator security state.", error);
    return jsonError("VerifyGrid operator security is unavailable.", 503);
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-passkey", max: 12, windowMs: 5 * 60_000 });
  if (limited) return limited;
  const session = await adminIdentity(request);
  if (!session) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = ceremonySchema.safeParse(body.data);
  if (!parsed.success) return jsonError("Invalid passkey ceremony request.", 400);

  try {
    if (parsed.data.action === "registration_options") {
      const options = await createRegistrationOptions(session.email, request);
      return NextResponse.json({ ok: true, options }, { headers: noStoreHeaders });
    }
    if (parsed.data.action === "authentication_options") {
      const options = await createAuthenticationOptions(session.email, request);
      return NextResponse.json({ ok: true, options }, { headers: noStoreHeaders });
    }
    if (!parsed.data.response) return jsonError("The passkey response is required.", 400);

    const result = parsed.data.action === "registration_verify"
      ? await completeRegistration(session.email, request, parsed.data.response as RegistrationResponseJSON, parsed.data.label)
      : await completeAuthentication(session.email, request, parsed.data.response as AuthenticationResponseJSON);
    const event = parsed.data.action === "registration_verify" ? "operator_passkey_enrolled" : "operator_step_up_success";
    await auditVerifyGrid(event, result.operator.email, result.operator.id, { role: result.operator.role });
    const response = NextResponse.json(
      { ok: true, operator: { email: result.operator.email, displayName: result.operator.displayName, role: result.operator.role } },
      { headers: noStoreHeaders }
    );
    response.cookies.set(verifyGridOperatorCookieName, result.token, verifyGridOperatorCookieOptions());
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The passkey ceremony failed.";
    await auditVerifyGrid("operator_step_up_failed", session.email, "verifygrid", { reason: message });
    return jsonError(message, 400);
  }
}

export async function DELETE(request: Request) {
  const session = await adminIdentity(request);
  if (!session) return jsonError("Unauthorized", 401);
  await revokeOperatorSession(request);
  await auditVerifyGrid("operator_session_revoked", session.email, "verifygrid");
  const response = NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  response.cookies.set(verifyGridOperatorCookieName, "", { ...verifyGridOperatorCookieOptions(), maxAge: 0 });
  return response;
}
