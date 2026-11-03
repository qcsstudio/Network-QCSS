import assert from "node:assert/strict";
import test from "node:test";
import { executionDeadline } from "../verifygrid-policy.mjs";

const now = Date.parse("2026-11-03T10:00:00Z");
const manifest = {
  engagement: { scopeHash: "scope-v1" },
  authorization: { scopeHash: "scope-v1", validFrom: "2026-11-03T09:00:00Z", validUntil: "2026-11-03T12:00:00Z" },
  controls: { requestedStartAt: "2026-11-03T10:00:00Z", validUntil: "2026-11-03T11:00:00Z" }
};
test("the sensor uses a finite local deadline bounded by signed authority", () => {
  assert.equal(executionDeadline(manifest, now), Date.parse("2026-11-03T11:00:00Z"));
});
test("the sensor rejects invalid, future, expired and mismatched signed windows", () => {
  for (const invalid of [
    { ...manifest, controls: { ...manifest.controls, validUntil: "invalid" } },
    { ...manifest, controls: { ...manifest.controls, validUntil: "2026-11-03T10:00:00Z" } },
    { ...manifest, controls: { ...manifest.controls, requestedStartAt: "2026-11-03T10:30:00Z" } },
    { ...manifest, controls: { ...manifest.controls, validUntil: "2026-11-03T13:00:00Z" } },
    { ...manifest, authorization: { ...manifest.authorization, scopeHash: "scope-v2" } },
    { ...manifest, authorization: { ...manifest.authorization, validFrom: "invalid" } }
  ]) assert.throws(() => executionDeadline(invalid, now));
  assert.throws(() => executionDeadline(manifest, Date.parse(manifest.controls.validUntil)));
});
