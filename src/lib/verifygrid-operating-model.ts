export const VERIFYGRID_SESSION_MAX_MINUTES = 120;
export const VERIFYGRID_SESSION_IDLE_MINUTES = 15;
export const VERIFYGRID_CRITICAL_REAUTH_MINUTES = 10;

export type VerifyGridPermission =
  | "view"
  | "operate"
  | "manage_scope"
  | "approve_execution"
  | "dispatch_execution"
  | "stop_execution"
  | "review_report"
  | "release_report"
  | "manage_access";

export const verifyGridRolePolicy: Record<string, { label: string; purpose: string; permissions: VerifyGridPermission[] }> = {
  owner: {
    label: "Platform owner",
    purpose: "Own access, engagement authority, execution safety, and service continuity.",
    permissions: ["view", "operate", "manage_scope", "approve_execution", "dispatch_execution", "stop_execution", "review_report", "release_report", "manage_access"]
  },
  lead: {
    label: "Engagement lead",
    purpose: "Own scope, test readiness, execution approval, dispatch, and client coordination.",
    permissions: ["view", "operate", "manage_scope", "approve_execution", "dispatch_execution", "stop_execution", "manage_access"]
  },
  analyst: {
    label: "Security analyst",
    purpose: "Prepare tests, validate evidence, manage findings, and stop unsafe execution.",
    permissions: ["view", "operate", "stop_execution"]
  },
  reviewer: {
    label: "Independent reviewer",
    purpose: "Review evidence and release approved reports without operating tests.",
    permissions: ["view", "review_report", "release_report", "stop_execution"]
  },
  observer: {
    label: "Read-only observer",
    purpose: "Inspect engagement status, evidence, and audit history.",
    permissions: ["view"]
  }
};

export function verifyGridPermissionsForRole(role: string) {
  return verifyGridRolePolicy[role]?.permissions || [];
}

const freshAuthenticationPermissions = new Set<VerifyGridPermission>([
  "manage_scope",
  "approve_execution",
  "dispatch_execution",
  "review_report",
  "release_report",
  "manage_access"
]);

export function verifyGridRequiresFreshAuthentication(permission: VerifyGridPermission) {
  return freshAuthenticationPermissions.has(permission);
}

export function verifyGridRoleLabel(role: string) {
  return verifyGridRolePolicy[role]?.label || role.replace(/_/g, " ");
}

export type VerifyGridLifecycleState = "complete" | "active" | "attention" | "blocked" | "pending";

export type VerifyGridLifecycleStep = {
  key: string;
  number: string;
  label: string;
  owner: "Client" | "QCS" | "Shared";
  state: VerifyGridLifecycleState;
  summary: string;
  proof: string;
};

type LifecycleInput = {
  status: string;
  scopeTargets: Array<{ inScope: boolean; ownershipConfirmed?: boolean }>;
  gate?: {
    executable: boolean;
    blockers: string[];
    authorization: { validUntil: string } | null;
  };
  testCases?: Array<{ status: string }>;
  executionJobs?: Array<{ status: string }>;
  observations?: Array<unknown>;
  findings: Array<{ status: string; latestRetest?: { status: string } | null }>;
  reports: Array<{ status: string }>;
};

const terminalTestStates = new Set(["passed", "finding", "not_applicable"]);
const activeExecutionStates = new Set(["queued", "claimed", "running", "retry"]);
const completedExecutionStates = new Set(["completed", "complete", "done"]);
const openFindingStates = new Set(["open", "validated", "remediation_in_progress", "resolved", "retest_requested"]);

export function buildVerifyGridLifecycle(input: LifecycleInput): VerifyGridLifecycleStep[] {
  const inScope = input.scopeTargets.filter((target) => target.inScope);
  const ownedScope = inScope.length > 0 && inScope.every((target) => target.ownershipConfirmed !== false);
  const hasAuthorization = Boolean(input.gate?.authorization);
  const authorizationState: VerifyGridLifecycleState = input.gate?.executable
    ? "complete"
    : hasAuthorization
      ? "attention"
      : ownedScope
        ? "active"
        : "blocked";
  const tests = input.testCases || [];
  const completedTests = tests.filter((test) => terminalTestStates.has(test.status)).length;
  const jobs = input.executionJobs || [];
  const hasActiveExecution = jobs.some((job) => activeExecutionStates.has(job.status));
  const hasCompletedExecution = jobs.some((job) => completedExecutionStates.has(job.status));
  const hasEvidence = Boolean((input.observations || []).length || input.findings.length || completedTests);
  const openFindings = input.findings.filter((finding) => openFindingStates.has(finding.status));
  const retestRequested = input.findings.some((finding) => finding.status === "retest_requested" || finding.latestRetest);
  const retestPassed = input.findings.length > 0 && input.findings.every((finding) => finding.status === "closed" || finding.latestRetest?.status === "passed");
  const finalReport = input.reports.some((report) => report.status === "final");
  const approvedReport = input.reports.some((report) => report.status === "approved");
  const draftReport = input.reports.some((report) => report.status === "draft");

  return [
    {
      key: "intake",
      number: "01",
      label: "Intake",
      owner: "Shared",
      state: "complete",
      summary: "Business objective, accountable contacts, environment, and emergency route are recorded.",
      proof: "Engagement record"
    },
    {
      key: "scope",
      number: "02",
      label: "Scope",
      owner: "Client",
      state: ownedScope ? "complete" : inScope.length ? "attention" : "blocked",
      summary: ownedScope ? `${inScope.length} owned target${inScope.length === 1 ? "" : "s"} defined.` : "Exact targets, exclusions, ownership, and permitted test levels are required.",
      proof: "Scope hash"
    },
    {
      key: "authority",
      number: "03",
      label: "Authority",
      owner: "Client",
      state: authorizationState,
      summary: input.gate?.executable ? "Written authority matches the current scope and time window." : input.gate?.blockers[0] || "Written authority must be bound to the current scope.",
      proof: "Authorization artifact"
    },
    {
      key: "plan",
      number: "04",
      label: "Test plan",
      owner: "QCS",
      state: tests.length ? (completedTests === tests.length ? "complete" : "active") : "pending",
      summary: tests.length ? `${completedTests} of ${tests.length} planned checks concluded.` : "Methodology, safety limits, evidence expectations, and owners are prepared.",
      proof: "Methodology record"
    },
    {
      key: "execute",
      number: "05",
      label: "Execute",
      owner: "QCS",
      state: hasCompletedExecution ? "complete" : hasActiveExecution ? "active" : input.gate?.executable ? "pending" : "blocked",
      summary: hasActiveExecution ? "An authorized check is running inside its signed manifest." : hasCompletedExecution ? "Controlled checks completed and results were returned." : "Only an approved, time-bound manifest can be dispatched.",
      proof: "Signed job manifest"
    },
    {
      key: "evidence",
      number: "06",
      label: "Evidence",
      owner: "QCS",
      state: hasEvidence ? "complete" : hasCompletedExecution ? "attention" : "pending",
      summary: hasEvidence ? "Observations and analyst conclusions are preserved with provenance." : "Scanner output becomes evidence only after scope reconciliation and analyst validation.",
      proof: "Custody chain"
    },
    {
      key: "remediate",
      number: "07",
      label: "Remediate",
      owner: "Client",
      state: !input.findings.length ? "pending" : openFindings.length ? "active" : "complete",
      summary: !input.findings.length ? "Remediation begins only when validated risk exists." : openFindings.length ? `${openFindings.length} finding${openFindings.length === 1 ? "" : "s"} still require ownership or closure.` : "Every validated finding has a recorded disposition.",
      proof: "Owner and fix evidence"
    },
    {
      key: "retest",
      number: "08",
      label: "Retest",
      owner: "Shared",
      state: retestPassed ? "complete" : retestRequested ? "active" : input.findings.length ? "pending" : "pending",
      summary: retestPassed ? "Fixes were independently revalidated." : retestRequested ? "Retest evidence is being evaluated." : "Closure requires proof that the control now works.",
      proof: "Retest result"
    },
    {
      key: "release",
      number: "09",
      label: "Release",
      owner: "QCS",
      state: finalReport ? "complete" : approvedReport ? "active" : draftReport ? "attention" : "pending",
      summary: finalReport ? "A signed final snapshot is available to the client." : approvedReport ? "Independent review passed; signed release remains." : draftReport ? "A draft awaits independent quality review." : "The report is generated from the immutable engagement record.",
      proof: "Signed report"
    }
  ];
}

export function verifyGridLifecycleProgress(steps: VerifyGridLifecycleStep[]) {
  return Math.round((steps.filter((step) => step.state === "complete").length / steps.length) * 100);
}
