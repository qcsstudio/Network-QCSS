import { NextResponse } from "next/server";
import { jsonError, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { eventSchema } from "@/lib/schemas";
import { requestContext } from "@/lib/security";
import { createEvent } from "@/lib/store";

export const runtime = "nodejs";

const necessaryEvents = new Set(["session_started", "consent_updated", "generate_lead", "whatsapp_click", "phone_click"]);

export async function POST(request: Request) {
  const limited = rateLimit(request, { keyPrefix: "events", max: 120, windowMs: 60_000 });
  if (limited) return limited;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = eventSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(parsed.error.flatten(), 400);
  }

  const payload = parsed.data;
  if (payload.requiresAnalytics && !payload.consent.analytics && !necessaryEvents.has(payload.name)) {
    return NextResponse.json({ ok: true, stored: false, reason: "analytics_consent_required" }, { status: 202 });
  }

  const event = await createEvent(payload, await requestContext());
  return NextResponse.json({ ok: true, stored: true, eventId: event.id }, { status: 201 });
}
