import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { getDistributionSnapshot } from "@/lib/distribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  try {
    const snapshot = await getDistributionSnapshot();
    return NextResponse.json({ ok: true, ...snapshot }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to load distribution operations.", error);
    return jsonError("Distribution operations are unavailable.", 503);
  }
}
