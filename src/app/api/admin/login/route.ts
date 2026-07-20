import { NextResponse } from "next/server";
import {
  adminCookieName,
  adminCookieOptions,
  adminCredentialsConfigured,
  createAdminSession,
  verifyAdminCredentials
} from "@/lib/admin-auth";
import { readFormBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";

export function GET(request: Request) {
  return NextResponse.redirect(new URL("/admin/login", request.url), { status: 303 });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { keyPrefix: "admin-login", max: 8, windowMs: 5 * 60_000 });
  if (limited) {
    return NextResponse.redirect(new URL("/admin/login?error=rate", request.url), { status: 303 });
  }

  const body = await readFormBody(request);
  if (!body.ok) return body.response;

  const formData = body.data;
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const context = await requestContext();

  if (!adminCredentialsConfigured()) {
    await createAuditLog(
      {
        action: "admin.login_unavailable",
        actor: email || "unknown",
        target: "admin",
        metadata: { reason: "credentials_not_configured" }
      },
      context
    );
    return NextResponse.redirect(new URL("/admin/login?error=config", request.url), { status: 303 });
  }

  if (!verifyAdminCredentials(email, password)) {
    await createAuditLog(
      {
        action: "admin.login_failed",
        actor: email || "unknown",
        target: "admin",
        metadata: { reason: "invalid_credentials" }
      },
      context
    );
    return NextResponse.redirect(new URL("/admin/login?error=1", request.url), { status: 303 });
  }

  await createAuditLog({ action: "admin.login_success", actor: email, target: "admin" }, context);
  const response = NextResponse.redirect(new URL("/admin", request.url), { status: 303 });
  response.cookies.set(adminCookieName, createAdminSession(email), adminCookieOptions());
  return response;
}
