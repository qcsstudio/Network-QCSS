import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { dispatchLeadIntegrations } from "@/lib/integrations";
import { leadSchema } from "@/lib/schemas";
import { requestContext } from "@/lib/security";
import { createAuditLog, createLead, getLeads } from "@/lib/store";

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

  const context = await requestContext();
  const lead = await createLead(parsed.data, context);
  const integrations = await dispatchLeadIntegrations(lead);
  const integrationSummary = {
    attempted: integrations.filter((integration) => !integration.skipped).length,
    failed: integrations.filter((integration) => !integration.skipped && !integration.ok).length,
    skipped: integrations.filter((integration) => integration.skipped).length
  };

  await createAuditLog(
    {
      action: "lead.created",
      actor: lead.email,
      target: lead.id,
      metadata: {
        pipeline: lead.pipeline,
        priority: lead.priority,
        integrationSummary
      }
    },
    context
  );

  return NextResponse.json(
    {
      ok: true,
      lead: {
        id: lead.id,
        pipeline: lead.pipeline,
        priority: lead.priority,
        score: lead.score,
        createdAt: lead.createdAt
      },
      integrationSummary
    },
    { status: 201 }
  );
}
