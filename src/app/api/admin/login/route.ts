import { NextResponse } from "next/server";
import { adminCookieName, adminCookieOptions, createAdminSession, verifyAdminCredentials } from "@/lib/admin-auth";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const context = await requestContext();

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
