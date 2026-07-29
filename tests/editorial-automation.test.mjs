import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production cadence separates ingestion, drafting, and social delivery", async () => {
  const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const schedules = new Map(vercel.crons.map((cron) => [cron.path, cron.schedule]));

  assert.equal(schedules.get("/api/cron/advisory-discovery"), "*/10 * * * *");
  assert.equal(schedules.get("/api/cron/social-publisher"), "5,15,25,35,45,55 * * * *");
  assert.equal(schedules.get("/api/admin/content-radar"), "0 4 * * 1,4");
});
