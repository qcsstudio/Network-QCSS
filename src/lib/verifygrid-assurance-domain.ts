import crypto from "node:crypto";
import { z } from "zod";
import { canonicalJson, sha256Json } from "./verifygrid-execution-domain.ts";

export const reportReviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  notes: z.string().trim().min(20).max(3000),
  checklist: z.object({
    scopeAndAuthority: z.literal(true),
    methodologyCoverage: z.literal(true),
    evidenceTraceability: z.literal(true),
    findingQuality: z.literal(true)
  })
});

export const reportReleaseSchema = z.object({
  acknowledgeImmutableRelease: z.literal(true),
  releaseNote: z.string().trim().min(20).max(1200)
});

export type ReportQualityCheck = {
  code: string;
  label: string;
  status: "pass" | "warning" | "fail";
  detail: string;
};

type QualityInput = {
  reportType: "executive" | "technical" | "retest";
  now?: Date;
  currentScopeHash: string;
  scopeTargets: Array<{ inScope: boolean; ownershipConfirmed: boolean }>;
  activeAuthorization: { scopeHash: string; authorityConfirmed: boolean; validFrom: Date; validUntil: Date; artifactSha256?: string | null } | null;
  testCases: Array<{ status: string; resultSummary?: string | null }>;
  findings: Array<{
    severity: string;
    status: string;
    businessImpact: string;
    remediation: string;
    ownerName?: string | null;
    dueAt?: Date | null;
    evidenceCount: number;
    evidenceSummary?: string | null;
    retestStatuses: string[];
  }>;
  importStatuses: string[];
  executionStatuses: string[];
};

function check(code: string, label: string, ok: boolean, detail: string, failure: "warning" | "fail" = "fail"): ReportQualityCheck {
  return { code, label, status: ok ? "pass" : failure, detail };
}

export function evaluateReportQuality(input: QualityInput) {
  const now = input.now || new Date();
  const inScope = input.scopeTargets.filter((target) => target.inScope);
  const incompleteTests = input.testCases.filter((item) => !["passed", "finding", "not_applicable"].includes(item.status));
  const undocumentedTests = input.testCases.filter((item) => ["passed", "finding", "not_applicable"].includes(item.status) && !item.resultSummary?.trim());
  const material = input.findings.filter((finding) => !["false_positive", "duplicate"].includes(finding.status));
  const weakFindings = material.filter((finding) => !finding.businessImpact.trim() || !finding.remediation.trim());
  const unownedPriority = material.filter((finding) => ["critical", "high"].includes(finding.severity) && (!finding.ownerName || !finding.dueAt));
  const unsupportedFindings = material.filter((finding) => !finding.evidenceCount && !finding.evidenceSummary?.trim());
  const closureWithoutRetest = material.filter((finding) => ["resolved", "closed"].includes(finding.status) && !finding.retestStatuses.includes("passed"));
  const activeExecution = input.executionStatuses.filter((status) => ["queued", "claimed", "running", "retry_pending"].includes(status));
  const pendingImports = input.importStatuses.filter((status) => status === "processing");
  const authorization = input.activeAuthorization;
  const authorityValid = Boolean(
    authorization &&
    authorization.scopeHash === input.currentScopeHash &&
    authorization.authorityConfirmed &&
    authorization.validFrom <= now &&
    authorization.validUntil >= now
  );
  const methodologyFailure: "warning" | "fail" = input.reportType === "executive" ? "warning" : "fail";
  const retestFailure: "warning" | "fail" = input.reportType === "retest" ? "fail" : "warning";
  const checks: ReportQualityCheck[] = [
    check("scope.present", "Defined in-scope surface", inScope.length > 0, `${inScope.length} target(s) are in scope.`),
    check("scope.ownership", "Confirmed target ownership", inScope.length > 0 && inScope.every((target) => target.ownershipConfirmed), "Every in-scope target must have confirmed ownership."),
    check("authority.active", "Current written authority", authorityValid, "Authorization must match the current scope and reporting date."),
    check("authority.artifact", "Authorization artifact integrity", Boolean(authorization?.artifactSha256), "Attach and hash the client authorization artifact before external release.", "warning"),
    check("methodology.complete", "Methodology completion", incompleteTests.length === 0, `${incompleteTests.length} test case(s) remain incomplete.`, methodologyFailure),
    check("methodology.documented", "Methodology conclusions", undocumentedTests.length === 0, `${undocumentedTests.length} completed test case(s) lack a conclusion.`, methodologyFailure),
    check("findings.quality", "Finding impact and remediation", weakFindings.length === 0, `${weakFindings.length} finding(s) lack decision-ready impact or remediation.`),
    check("findings.ownership", "Priority finding ownership", unownedPriority.length === 0, `${unownedPriority.length} critical/high finding(s) lack an owner or due date.`),
    check("findings.evidence", "Finding evidence traceability", unsupportedFindings.length === 0, `${unsupportedFindings.length} finding(s) lack evidence support.`),
    check("retests.traceable", "Closure retest evidence", closureWithoutRetest.length === 0, `${closureWithoutRetest.length} resolved/closed finding(s) lack a passed retest.`, retestFailure),
    check("pipeline.quiescent", "Evidence pipeline settled", pendingImports.length === 0, `${pendingImports.length} evidence import(s) are still processing.`),
    check("execution.quiescent", "No active scanner execution", activeExecution.length === 0, `${activeExecution.length} scanner job(s) are active.`)
  ];
  const failed = checks.filter((item) => item.status === "fail").length;
  const warnings = checks.filter((item) => item.status === "warning").length;
  const passed = checks.length - failed - warnings;
  return {
    schema: "qcs.verifygrid.quality-gate.v1",
    evaluatedAt: now.toISOString(),
    canApprove: failed === 0,
    score: Math.round(((passed + warnings * 0.5) / checks.length) * 100),
    summary: { passed, warnings, failed, total: checks.length },
    checks
  };
}

export function buildCustodyEventHash(input: {
  engagementId: string;
  sequence: number;
  eventType: string;
  subjectType: string;
  subjectId: string;
  action: string;
  actor: string;
  sourceSha256?: string | null;
  previousHash?: string | null;
  occurredAt: string;
  classification: string;
  details?: unknown;
}) {
  return sha256Json({ schema: "qcs.verifygrid.custody-event.v1", ...input });
}

export function buildReportChainHash(input: {
  engagementId: string;
  reportType: string;
  version: number;
  snapshotSha256: string;
  previousChainHash?: string | null;
  generatedAt: string;
}) {
  return sha256Json({ schema: "qcs.verifygrid.report-chain.v1", ...input });
}

export function signReportChain(chainHash: string, privateKeyBase64: string) {
  const privateKey = crypto.createPrivateKey({ key: Buffer.from(privateKeyBase64, "base64"), format: "der", type: "pkcs8" });
  return crypto.sign(null, Buffer.from(chainHash, "utf8"), privateKey).toString("base64url");
}

export function verifyReportChainSignature(chainHash: string, signature: string, publicKeyBase64: string) {
  const publicKey = crypto.createPublicKey({ key: Buffer.from(publicKeyBase64, "base64"), format: "der", type: "spki" });
  return crypto.verify(null, Buffer.from(chainHash, "utf8"), publicKey, Buffer.from(signature, "base64url"));
}

export function signingKeyId(publicKeyBase64: string) {
  return crypto.createHash("sha256").update(Buffer.from(publicKeyBase64, "base64")).digest("hex").slice(0, 16);
}

export function canonicalReviewDigest(value: unknown) {
  return crypto.createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
