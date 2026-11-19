import { executionStateBlockers } from "./verifygrid-execution-policy.ts";

export type VerifyGridReadinessInput = {
  status: string;
  gate: {
    executable: boolean;
    blockers: string[];
    authorization: { validFrom: string; validUntil: string } | null;
  };
  scopeTargets: Array<{ inScope: boolean; ownershipConfirmed: boolean; environment: string }>;
  testCases: Array<{ status: string }>;
  executionJobs: Array<{ status: string; resultBatchId: string }>;
  observations: Array<{ promotionStatus: string; scopeDisposition: string }>;
};

/** Coverage describes recorded work, never an inferred security or compliance score. */
export function buildVerifyGridReadiness(input: VerifyGridReadinessInput, evaluatedAt: number) {
  const targets = input.scopeTargets.filter((target) => target.inScope);
  const owned = targets.filter((target) => target.ownershipConfirmed).length;
  const blockers = [...input.gate.blockers, ...executionStateBlockers(input.status)];
  const authorization = input.gate.authorization;
  if (authorization) {
    const from = Date.parse(authorization.validFrom);
    const until = Date.parse(authorization.validUntil);
    if (![from, until, evaluatedAt].every(Number.isFinite) || until <= from) blockers.push("The authorization window is invalid.");
    else if (evaluatedAt < from) blockers.push("The authorization window has not started.");
    else if (evaluatedAt >= until) blockers.push("The authorization window has expired.");
  } else blockers.push("Record written authorization for the current scope.");
  if (!targets.length) blockers.push("Add at least one in-scope target.");
  if (owned !== targets.length) blockers.push("Confirm ownership for every in-scope target.");
  if (!input.gate.executable && !blockers.length) blockers.push("Refresh the engagement to confirm the execution gate.");
  const uniqueBlockers = [...new Set(blockers)];
  const executable = input.gate.executable && uniqueBlockers.length === 0;
  const count = (states: string[]) => input.testCases.filter((test) => states.includes(test.status)).length;
  const passed = count(["passed"]);
  const findings = count(["finding"]);
  const notApplicable = count(["not_applicable"]);
  const concluded = passed + findings + notApplicable;
  const total = input.testCases.length;
  const activeJobs = input.executionJobs.filter((job) => ["claimed", "running", "processing_result"].includes(job.status)).length;
  const queuedJobs = input.executionJobs.filter((job) => ["queued", "retry"].includes(job.status)).length;
  const jobExceptions = input.executionJobs.filter((job) => ["failed", "cancelled", "blocked", "expired"].includes(job.status)).length;
  const completedJobs = input.executionJobs.filter((job) => job.status === "completed");
  const missingJobEvidence = completedJobs.filter((job) => !job.resultBatchId).length;
  const pendingObservations = input.observations.filter((observation) => observation.promotionStatus === "pending" && observation.scopeDisposition === "in_scope").length;
  const zones = Object.entries(targets.reduce<Record<string, number>>((groups, target) => {
    groups[target.environment] = (groups[target.environment] || 0) + 1;
    return groups;
  }, {})).sort(([left], [right]) => left.localeCompare(right));
  const next = !executable
    ? { view: "scope" as const, label: "Review authority", detail: uniqueBlockers[0] }
    : !total || concluded < total
      ? { view: "methodology" as const, label: "Review test plan", detail: total ? `${total - concluded} planned checks still need a conclusion.` : "Define the test coverage before execution." }
      : pendingObservations || missingJobEvidence
        ? { view: "evidence" as const, label: "Review evidence", detail: missingJobEvidence ? "A completed job has no linked result batch." : `${pendingObservations} observations await analyst review.` }
        : { view: "execution" as const, label: "Review execution", detail: "Inspect approved manifests and recent job outcomes." };
  return {
    executable, blockers: uniqueBlockers, targets: targets.length, owned,
    exclusions: input.scopeTargets.length - targets.length, zones,
    coverage: { total, passed, findings, notApplicable, concluded, incomplete: total - concluded, percent: total ? Math.round(concluded / total * 100) : 0 },
    activeJobs, queuedJobs, jobExceptions, completedJobs: completedJobs.length, missingJobEvidence, pendingObservations, next
  };
}
