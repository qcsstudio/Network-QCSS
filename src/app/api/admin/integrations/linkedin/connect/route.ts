import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api";
import { linkedInAuthorizationUrl, linkedinConfigured } from "@/lib/linkedin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  if (!linkedinConfigured()) return jsonError("LinkedIn OAuth is not configured.", 503);
  const state = crypto.randomBytes(32).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set("qcs_linkedin_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/linkedin/callback",
    maxAge: 10 * 60
  });
  return NextResponse.redirect(linkedInAuthorizationUrl(state));
}
