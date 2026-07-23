import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { processVerifyGridConnectorQueue } from "@/lib/verifygrid-connectors";
import { reconcileVerifyGridExecutionLeases } from "@/lib/verifygrid-sensor";
import { safeEqual } from "@/lib/verifygrid-automation-domain";
import { cleanExpiredVerifyGridOperatorSecurity } from "@/lib/verifygrid-operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  return Boolean(secret && supplied && safeEqual(secret, supplied));
}

export async function GET(request: Request) {
  if (!cronAuthorized(request) && !isAdminRequest(request)) return jsonError("Unauthorized", 401);
  const [leases, connectors, operatorSecurity] = await Promise.all([
    reconcileVerifyGridExecutionLeases(),
    processVerifyGridConnectorQueue(3),
    cleanExpiredVerifyGridOperatorSecurity()
  ]);
  return NextResponse.json({ ok: true, processedAt: new Date().toISOString(), leases, connectors, operatorSecurity }, { headers: noStoreHeaders });
}
