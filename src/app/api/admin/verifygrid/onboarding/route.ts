import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { listVerifyGridOnboardingRequests } from "@/lib/verifygrid-onboarding";
import { verifyGridAdminActor } from "@/lib/verifygrid-admin-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  try {
    return NextResponse.json({ ok: true, requests: await listVerifyGridOnboardingRequests() }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to load VerifyGrid onboarding requests.", error);
    return jsonError("VerifyGrid onboarding storage is unavailable.", 503);
  }
}

