import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { getPrismaClient } from "@/lib/prisma";
import { getVerifyGridPortalSession } from "@/lib/verifygrid-portal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await getVerifyGridPortalSession();
  if (!session) return jsonError("Unauthorized", 401);
  const { id } = await params;
  const report = await getPrismaClient().verifyGridReport.findFirst({ where: { id, workspaceId: session.workspaceId, status: "final" } });
  if (!report) return jsonError("Report not found.", 404);
  return NextResponse.json({ ok: true, report: { id: report.id, title: report.title, version: report.version, reportType: report.reportType, scopeHash: report.scopeHash, snapshotSha256: report.snapshotSha256, chainHash: report.chainHash, signature: report.signature, signatureAlgorithm: report.signatureAlgorithm, signingKeyId: report.signingKeyId, signingPublicKey: report.signingPublicKey, generatedAt: report.generatedAt.toISOString(), releasedAt: report.releasedAt?.toISOString() || null, snapshot: report.snapshot } }, { headers: noStoreHeaders });
}
