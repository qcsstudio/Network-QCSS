import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production cadence separates ingestion, drafting, and social delivery", async () => {
  const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const workflow = await readFile(new URL("../.github/workflows/editorial-automation.yml", import.meta.url), "utf8");
  const schedules = new Map(vercel.crons.map((cron) => [cron.path, cron.schedule]));

  assert.equal(schedules.get("/api/cron/advisory-discovery"), "17 3 * * *");
  assert.equal(schedules.has("/api/cron/social-publisher"), false);
  assert.equal(schedules.get("/api/admin/content-radar"), "0 4 * * 1,4");
  assert.match(workflow, /cron: "\*\/5 \* \* \* \*"/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /scan-advisories:/);
  assert.match(workflow, /publish-social:/);
  assert.match(workflow, /api\/cron\/advisory-discovery/);
  assert.match(workflow, /api\/cron\/social-publisher/);
});
