import { NextResponse } from "next/server";
import { adminCookieName, verifyAdminSession } from "@/lib/admin-auth";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${adminCookieName}=`))
    ?.split("=")
    .slice(1)
    .join("=");
  const session = verifyAdminSession(token ? decodeURIComponent(token) : "");
  await createAuditLog(
    {
      action: "admin.logout",
      actor: session?.email || "unknown",
      target: "admin"
    },
    await requestContext()
  );

  const response = NextResponse.redirect(new URL("/admin/login", request.url), { status: 303 });
  response.cookies.set(adminCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
