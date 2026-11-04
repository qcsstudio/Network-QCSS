/** Validate both signed windows before startup and return the local hard deadline. */
export function executionDeadline(manifest, now = Date.now()) {
  const start = Date.parse(manifest?.controls?.requestedStartAt);
  const end = Date.parse(manifest?.controls?.validUntil);
  const authorityStart = Date.parse(manifest?.authorization?.validFrom);
  const authorityEnd = Date.parse(manifest?.authorization?.validUntil);
  if (![start, end, authorityStart, authorityEnd, now].every(Number.isFinite)) throw new Error("Execution manifest contains an invalid time window.");
  if (end <= start || authorityEnd <= authorityStart || end - start > 24 * 60 * 60_000) throw new Error("Execution manifest contains an invalid time window.");
  if (start < authorityStart || end > authorityEnd) throw new Error("Execution validity extends beyond its authorization window.");
  if (now < start || now >= end || now < authorityStart || now >= authorityEnd) throw new Error("Execution manifest is outside its authorized time window.");
  if (!manifest.engagement?.scopeHash || manifest.engagement.scopeHash !== manifest.authorization?.scopeHash) throw new Error("Execution scope does not match its signed authorization.");
  return Math.min(end, authorityEnd);
}
