import { getVerifyGridParentIdentity } from "@/lib/verifygrid-identity";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";
import {
  getVerifyGridOperatorFromRequest,
  permissionForVerifyGridRequest,
  type VerifyGridPermission
} from "@/lib/verifygrid-operator-auth";

export async function verifyGridAdminActor(request: Request, permission?: VerifyGridPermission) {
  const admin = await getVerifyGridParentIdentity();
  if (!admin) return "";
  const operator = await getVerifyGridOperatorFromRequest(request, permission || permissionForVerifyGridRequest(request));
  return operator?.email.toLowerCase() === admin.email.toLowerCase() ? operator.email : "";
}

export async function auditVerifyGrid(action: string, actor: string, target: string, metadata?: Record<string, unknown>) {
  await createAuditLog({ action: `verifygrid.${action}`, actor, target, metadata }, await requestContext());
}
