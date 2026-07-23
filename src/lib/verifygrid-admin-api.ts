import { getAdminSession, isAdminRequest } from "@/lib/admin-auth";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";
import {
  getVerifyGridOperatorFromRequest,
  permissionForVerifyGridRequest,
  type VerifyGridPermission
} from "@/lib/verifygrid-operator-auth";

export async function verifyGridAdminActor(request: Request, permission?: VerifyGridPermission) {
  if (!isAdminRequest(request)) return "";
  const admin = await getAdminSession();
  if (!admin) return "";
  const operator = await getVerifyGridOperatorFromRequest(request, permission || permissionForVerifyGridRequest(request));
  return operator?.email || "";
}

export async function auditVerifyGrid(action: string, actor: string, target: string, metadata?: Record<string, unknown>) {
  await createAuditLog({ action: `verifygrid.${action}`, actor, target, metadata }, await requestContext());
}
