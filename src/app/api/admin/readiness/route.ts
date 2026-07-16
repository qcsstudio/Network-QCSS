import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { getDeploymentReadiness } from "@/lib/readiness";

export const runtime = "nodejs";

export function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return jsonError("Unauthorized", 401);
  }

  return NextResponse.json({ ok: true, readiness: getDeploymentReadiness() }, { headers: noStoreHeaders });
}
