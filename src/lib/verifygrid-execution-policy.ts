/** Shared execution policy. An authorization window is half open: [start, end). */
export const executableEngagementStates = ["authorized", "scheduled", "active"];

export function executionStateBlockers(status: string) {
  if (status === "paused") return ["Execution is paused. An authorized operator must resume the engagement before dispatch."];
  return executableEngagementStates.includes(status) ? [] : ["The engagement is not in an execution-capable state."];
}

export function executionWindowBlockers(input: { requestedStartAt: Date; validUntil: Date; now: Date }) {
  const start = input.requestedStartAt.getTime();
  const end = input.validUntil.getTime();
  const now = input.now.getTime();
  if (![start, end, now].every(Number.isFinite)) return ["The execution window contains an invalid timestamp."];
  const blockers: string[] = [];
  if (end <= start) blockers.push("The execution window must end after it starts.");
  if (end <= now) blockers.push("The execution window has expired.");
  if (end - start > 24 * 60 * 60_000) blockers.push("Execution records may cover no more than 24 hours.");
  return blockers;
}
