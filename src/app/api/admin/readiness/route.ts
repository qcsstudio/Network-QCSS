import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getDeploymentReadiness } from "@/lib/readiness";

export const runtime = "nodejs";

export function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, readiness: getDeploymentReadiness() });
}
