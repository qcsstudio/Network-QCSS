import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { getDashboardSnapshot } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return jsonError("Unauthorized", 401);
  }

  return NextResponse.json(await getDashboardSnapshot(), { headers: noStoreHeaders });
}
