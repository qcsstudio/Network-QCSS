import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { siteConfig } from "@/lib/content";
import { getPrismaClient } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";
import { sendVerifyGridReportReadyEmail } from "@/lib/verifygrid-email";
import { getVerifyGridOperatorFromRequest } from "@/lib/verifygrid-operator-auth";
import { releaseVerifyGridReport } from "@/lib/verifygrid-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-report-release", max: 10, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request, "release_report");
  const operator = await getVerifyGridOperatorFromRequest(request, "release_report");
  if (!actor || !operator) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { id } = await params;
    const result = await releaseVerifyGridReport(id, body.data, operator);
    let emailDelivery: "sent" | "not_configured" | "provider_error" = "not_configured";
    try {
      const report = result.engagement.reports.find((item) => item.id === id);
      const members = await getPrismaClient().verifyGridMembership.findMany({
        where: { workspaceId: result.engagement.workspace.id, status: "active", revokedAt: null },
        select: { email: true }
      });
      const recipients = [...new Set([
        result.engagement.workspace.primaryContactEmail,
        ...members.map((member) => member.email)
      ].map((email) => email.trim().toLowerCase()).filter(Boolean))];
      if (report) {
        const delivery = await sendVerifyGridReportReadyEmail({
          to: recipients,
          organizationName: result.engagement.workspace.name,
          reportTitle: report.title,
          reportType: report.reportType,
          version: report.version,
          portalUrl: `${siteConfig.url}/portal/reports/${report.id}`,
          reportId: report.id
        });
        emailDelivery = delivery.reason;
      }
    } catch (error) {
      emailDelivery = "provider_error";
      console.error("VerifyGrid report was released, but its client notification could not be prepared.", error);
    }
    await auditVerifyGrid("report_released", actor, id, { status: result.status });
    return NextResponse.json({ ok: true, ...result, emailDelivery }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to release the report.", 400);
  }
}
