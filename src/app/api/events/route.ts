import { NextResponse } from "next/server";
import { eventSchema } from "@/lib/schemas";
import { requestContext } from "@/lib/security";
import { createEvent } from "@/lib/store";

export const runtime = "nodejs";

const necessaryEvents = new Set(["session_started", "consent_updated", "generate_lead", "whatsapp_click", "phone_click"]);

export async function POST(request: Request) {
  const parsed = eventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  if (payload.requiresAnalytics && !payload.consent.analytics && !necessaryEvents.has(payload.name)) {
    return NextResponse.json({ ok: true, stored: false, reason: "analytics_consent_required" }, { status: 202 });
  }

  const event = await createEvent(payload, await requestContext());
  return NextResponse.json({ ok: true, stored: true, eventId: event.id }, { status: 201 });
}
