import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { dispatchLeadIntegrations } from "@/lib/integrations";
import { leadSchema } from "@/lib/schemas";
import { requestContext } from "@/lib/security";
import { createLead, getLeads } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ leads: await getLeads() });
}

export async function POST(request: Request) {
  const parsed = leadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const lead = await createLead(parsed.data, await requestContext());
  const integrations = await dispatchLeadIntegrations(lead);
  return NextResponse.json({ ok: true, lead, integrations }, { status: 201 });
}
