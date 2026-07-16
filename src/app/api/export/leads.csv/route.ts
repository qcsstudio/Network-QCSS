import { isAdminRequest } from "@/lib/admin-auth";
import { noStoreHeaders } from "@/lib/api";
import { requestContext } from "@/lib/security";
import { createAuditLog, getLeads, leadsToCsv } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const leads = await getLeads();
  await createAuditLog(
    {
      action: "admin.leads_export",
      actor: "admin",
      target: "leads.csv",
      metadata: { count: leads.length }
    },
    await requestContext()
  );

  return new Response(leadsToCsv(leads), {
    headers: {
      ...noStoreHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=network-qcss-leads.csv"
    }
  });
}
