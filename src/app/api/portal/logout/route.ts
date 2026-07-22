import { NextResponse } from "next/server";
import { portalCookieOptions, verifyGridPortalCookie } from "@/lib/verifygrid-portal-auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/portal/access", request.url), { status: 303 });
  response.cookies.set(verifyGridPortalCookie, "", portalCookieOptions(0));
  return response;
}
