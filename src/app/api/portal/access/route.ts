import { NextResponse } from "next/server";
import { readFormBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { consumeVerifyGridAccessToken, portalCookieOptions, verifyGridPortalCookie } from "@/lib/verifygrid-portal-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-portal-access", max: 10, windowMs: 5 * 60_000 });
  if (limited) return limited;
  const body = await readFormBody(request);
  if (!body.ok) return body.response;
  try {
    const access = await consumeVerifyGridAccessToken(String(body.data.get("token") || ""));
    const response = NextResponse.redirect(new URL("/portal", request.url), { status: 303 });
    response.cookies.set(verifyGridPortalCookie, access.cookie, portalCookieOptions(access.maxAge));
    return response;
  } catch {
    return NextResponse.redirect(new URL("/portal/access?error=invalid", request.url), { status: 303 });
  }
}
