import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

if (!existsSync(".next/BUILD_ID")) throw new Error("Build the local application before running production-mode browser QA.");
const baseURL = "http://127.0.0.1:3120";
const secret = randomBytes(32).toString("base64url");
const env = {
  ...process.env,
  NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
  DATABASE_URL: "", DIRECT_URL: "", ADMIN_API_TOKEN: "",
  ADMIN_SESSION_SECRET: secret, CONFIG_ANALYZER_QA_ADMIN_SECRET: secret,
  FRONTEND_QA_BASE: baseURL, FRONTEND_QA_EXTERNAL: "1"
};
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3120"], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
const log = createWriteStream("config-analyzer-production-server.log");
server.stdout.pipe(log, { end: false }); server.stderr.pipe(log, { end: false });
let failedToStart = false;
let testProcess;
server.on("error", () => { failedToStart = true; });
const stop = () => { if (server.exitCode === null) server.kill(); if (testProcess?.exitCode === null) testProcess.kill(); };
process.once("exit", stop);
process.once("SIGINT", () => { stop(); process.exitCode = 1; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 120 && !failedToStart && server.exitCode === null; attempt++) {
    try { const response = await fetch(`${baseURL}/network-tools/network-configuration-explainer`, { signal: AbortSignal.timeout(2000) }); ready = response.ok; await response.body?.cancel(); }
    catch { /* The local listener may still be starting. */ }
    if (ready) break;
    await delay(500);
  }
  if (!ready) throw new Error("The isolated production-mode QA server did not become ready. Check the local server log.");
  const defaults = ["tests/config-analyzer-intake.spec.ts", "tests/config-lens.spec.ts", "tests/config-lens-networking.spec.ts", "tests/config-lens-security.spec.ts", "tests/config-lens-route-policy.spec.ts", "tests/config-lens-coverage.spec.ts", "tests/config-lens-release-coverage.spec.ts"];
  const selection = process.argv.length > 2 ? process.argv.slice(2) : defaults;
  testProcess = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...selection, "--workers=1", "--timeout=180000", "--max-failures=1"], { env, windowsHide: true, stdio: "inherit" });
  const code = await new Promise((resolve, reject) => { testProcess.once("error", reject); testProcess.once("exit", value => resolve(value ?? 1)); });
  process.exitCode = Number(code);
} finally {
  server.stdout.unpipe(log); server.stderr.unpipe(log); stop(); log.end();
  // The independent session secret exists only in these processes, never in a file.
}
