export const editorialAutomationStatuses = ["pending", "running", "retry_scheduled", "ready", "needs_review"] as const;

export type EditorialAutomationStatus = (typeof editorialAutomationStatuses)[number];

export type EditorialAutomationState = {
  status: EditorialAutomationStatus;
  attempts: number;
  lastRunAt: string;
  nextAttemptAt: string;
  lastError: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function cleanError(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 700);
}

export function editorialAutomationFromTrace(value: unknown, ready = false): EditorialAutomationState {
  const trace = record(value);
  const automation = record(trace?.automation);
  const status = editorialAutomationStatuses.includes(automation?.status as EditorialAutomationStatus)
    ? (automation?.status as EditorialAutomationStatus)
    : ready
      ? "ready"
      : "pending";
  return {
    status,
    attempts: typeof automation?.attempts === "number" && Number.isInteger(automation.attempts) ? Math.max(0, automation.attempts) : 0,
    lastRunAt: typeof automation?.lastRunAt === "string" ? automation.lastRunAt : "",
    nextAttemptAt: typeof automation?.nextAttemptAt === "string" ? automation.nextAttemptAt : "",
    lastError: typeof automation?.lastError === "string" ? automation.lastError : ""
  };
}

export function editorialTraceWithAutomation(value: unknown, automation: EditorialAutomationState) {
  return { ...(record(value) || {}), automation };
}

export function startEditorialAutomation(current: EditorialAutomationState, now = new Date()) {
  return {
    ...current,
    status: "running" as const,
    lastRunAt: now.toISOString(),
    nextAttemptAt: "",
    lastError: ""
  };
}

export function finishEditorialAutomation(
  current: EditorialAutomationState,
  result: { ready: boolean; error?: string },
  now = new Date()
): EditorialAutomationState {
  const attempts = current.attempts + 1;
  if (result.ready) {
    return {
      status: "ready",
      attempts,
      lastRunAt: now.toISOString(),
      nextAttemptAt: "",
      lastError: ""
    };
  }
  if (attempts >= 3) {
    return {
      status: "needs_review",
      attempts,
      lastRunAt: now.toISOString(),
      nextAttemptAt: "",
      lastError: cleanError(result.error || "Automatic editorial completion did not satisfy the publication checks.")
    };
  }
  const delayMs = attempts === 1 ? 15 * 60_000 : 60 * 60_000;
  return {
    status: "retry_scheduled",
    attempts,
    lastRunAt: now.toISOString(),
    nextAttemptAt: new Date(now.getTime() + delayMs).toISOString(),
    lastError: cleanError(result.error || "Automatic editorial completion requires another pass.")
  };
}

export function editorialAutomationIsDue(state: EditorialAutomationState, now = new Date()) {
  if (state.status === "ready" || state.status === "needs_review") return false;
  if (state.status === "running") {
    const started = Date.parse(state.lastRunAt);
    return !Number.isFinite(started) || now.getTime() - started >= 15 * 60_000;
  }
  if (!state.nextAttemptAt) return true;
  const nextAttempt = Date.parse(state.nextAttemptAt);
  return !Number.isFinite(nextAttempt) || nextAttempt <= now.getTime();
}
