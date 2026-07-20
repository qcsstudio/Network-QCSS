import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { connectLinkedInAccount } from "@/lib/linkedin";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const providerError = url.searchParams.get("error") || "";
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("qcs_linkedin_oauth_state")?.value || "";
  cookieStore.delete("qcs_linkedin_oauth_state");
  const session = await getAdminSession();

  if (!session) return NextResponse.redirect(new URL("/admin/login", request.url));
  if (providerError || !code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return NextResponse.redirect(new URL("/admin?linkedin=connection-failed#integrations", request.url));
  }

  try {
    const connection = await connectLinkedInAccount(code);
    await createAuditLog(
      { action: "integration.linkedin_connected", actor: session.email, target: connection.accountId, metadata: { accountName: connection.accountName } },
      await requestContext()
    );
    return NextResponse.redirect(new URL("/admin?linkedin=connected#integrations", request.url));
  } catch (error) {
    console.error("LinkedIn OAuth callback failed.", error);
    return NextResponse.redirect(new URL("/admin?linkedin=connection-failed#integrations", request.url));
  }
}
