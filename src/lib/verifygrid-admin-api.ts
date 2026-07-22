import { getAdminSession, isAdminRequest } from "@/lib/admin-auth";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";

export async function verifyGridAdminActor(request: Request) {
  if (!isAdminRequest(request)) return "";
  return (await getAdminSession())?.email || "admin-api";
}

export async function auditVerifyGrid(action: string, actor: string, target: string, metadata?: Record<string, unknown>) {
  await createAuditLog({ action: `verifygrid.${action}`, actor, target, metadata }, await requestContext());
}
