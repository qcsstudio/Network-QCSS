import { isAdminRequest } from "@/lib/admin-auth";
import { getLeads, leadsToCsv } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  return new Response(leadsToCsv(await getLeads()), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=network-qcss-leads.csv"
    }
  });
}
