import { NextResponse } from "next/server";
import { adminCookieName, adminCookieOptions, createAdminSession, verifyAdminCredentials } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  if (!verifyAdminCredentials(email, password)) {
    return NextResponse.redirect(new URL("/admin/login?error=1", request.url), { status: 303 });
  }

  const response = NextResponse.redirect(new URL("/admin", request.url), { status: 303 });
  response.cookies.set(adminCookieName, createAdminSession(email), adminCookieOptions());
  return response;
}
