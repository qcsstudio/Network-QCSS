import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getDashboardSnapshot } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await getDashboardSnapshot());
}
