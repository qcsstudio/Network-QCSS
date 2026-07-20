import { NextResponse } from "next/server";
import { getAdminSession, isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { disconnectLinkedInAccount, getLinkedInStatus } from "@/lib/linkedin";
import { requestContext } from "@/lib/security";
import { getSocialPublicationSummary } from "@/lib/social-publications";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  try {
    const [connection, publications] = await Promise.all([getLinkedInStatus(), getSocialPublicationSummary()]);
    return NextResponse.json({ ok: true, connection, publications }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to load LinkedIn integration status.", error);
    return jsonError("LinkedIn integration status is unavailable.", 503);
  }
}
export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  const session = await getAdminSession();
  await disconnectLinkedInAccount();
  await createAuditLog(
    { action: "integration.linkedin_disconnected", actor: session?.email || "admin-api", target: "linkedin" },
    await requestContext()
  );
  return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
}
