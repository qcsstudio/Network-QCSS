import { spawn } from "node:child_process";
import path from "node:path";

const port = 4173;
const baseUrl = `http://127.0.0.1:${port}`;
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const adminToken = "smoke-admin-token";
const server = spawn(process.execPath, [nextBin, "start", "-p", String(port), "-H", "127.0.0.1"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    ADMIN_EMAIL: "admin@example.test",
    ADMIN_API_TOKEN: adminToken,
    ADMIN_PASSWORD: "admin",
    ADMIN_SESSION_SECRET: "smoke-session-secret"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      await wait(250);
    }
  }
  throw new Error(`Server did not become ready. Output:\n${output}`);
}

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

try {
  await waitForServer();
  const health = await fetch(`${baseUrl}/api/health`);
  if (!health.headers.get("content-security-policy") || health.headers.get("x-content-type-options") !== "nosniff") {
    throw new Error("Expected security headers were not present on API responses.");
  }
  if (!/no-store/i.test(health.headers.get("cache-control") || "")) {
    throw new Error("Health endpoint should not be cached.");
  }

  const directLoginApi = await fetch(`${baseUrl}/api/admin/login`, { redirect: "manual" });
  const directLoginLocation = directLoginApi.headers.get("location") || "";
  if (directLoginApi.status !== 303 || new URL(directLoginLocation, baseUrl).pathname !== "/admin/login") {
    throw new Error(`Direct login API request should redirect to the login page. Received ${directLoginApi.status}.`);
  }

  const invalidLogin = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: "wrong@example.test", password: "wrong" }),
    redirect: "manual"
  });
  if (invalidLogin.status !== 303 || !/\/admin\/login\?error=1$/.test(invalidLogin.headers.get("location") || "")) {
    throw new Error(`Invalid admin login should return a controlled redirect. Received ${invalidLogin.status}.`);
  }

  const validLogin = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: "admin@example.test", password: "admin" }),
    redirect: "manual"
  });
  const adminCookie = validLogin.headers.get("set-cookie")?.split(";", 1)[0] || "";
  if (validLogin.status !== 303 || !adminCookie.startsWith("network_qcss_admin=")) {
    throw new Error(`Valid admin login should create a signed session cookie. Received ${validLogin.status}.`);
  }

  const adminPage = await fetch(`${baseUrl}/admin`, { headers: { cookie: adminCookie }, redirect: "manual" });
  if (adminPage.status !== 200) {
    throw new Error(`Authenticated admin page should load. Received ${adminPage.status}.`);
  }

  const invalidJson = await fetch(`${baseUrl}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{"
  });
  if (invalidJson.status !== 400) {
    throw new Error(`Malformed JSON should return 400. Received ${invalidJson.status}`);
  }

  const wrongContentType = await fetch(`${baseUrl}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "{}"
  });
  if (wrongContentType.status !== 415) {
    throw new Error(`Wrong content type should return 415. Received ${wrongContentType.status}`);
  }

  const unauthorizedDashboard = await fetch(`${baseUrl}/api/dashboard`);
  if (unauthorizedDashboard.status !== 401) {
    throw new Error(`Dashboard should require admin auth. Received ${unauthorizedDashboard.status}`);
  }

  const unauthorizedLeads = await fetch(`${baseUrl}/api/leads`);
  if (unauthorizedLeads.status !== 401) {
    throw new Error(`Lead list should require admin auth. Received ${unauthorizedLeads.status}`);
  }

  const unauthorizedExport = await fetch(`${baseUrl}/api/export/leads.csv`);
  if (unauthorizedExport.status !== 401) {
    throw new Error(`Lead export should require admin auth. Received ${unauthorizedExport.status}`);
  }

  const unauthorizedReadiness = await fetch(`${baseUrl}/api/admin/readiness`);
  if (unauthorizedReadiness.status !== 401) {
    throw new Error(`Readiness should require admin auth. Received ${unauthorizedReadiness.status}`);
  }

  const consent = {
    necessary: true,
    analytics: true,
    marketing: false,
    personalization: false,
    contact: true
  };

  await post("/api/events", {
    name: "session_started",
    sessionId: "smoke",
    metadata: { source: "smoke" },
    consent,
    requiresAnalytics: false
  });

  const assessmentResponse = await post("/api/assessments", {
    tool: "network-risk-score",
    title: "Network Risk Score",
    pipeline: "Managed Network Services",
    recommendation: "Free Network Risk Review",
    riskLevel: "High priority",
    score: 68,
    answers: { monitoring: "Partial" },
    consent
  });
  if (assessmentResponse.assessment.ipHash || assessmentResponse.assessment.answers) {
    throw new Error(`Assessment response exposed private fields: ${JSON.stringify(assessmentResponse.assessment)}`);
  }

  const resourceResponse = await post("/api/resources", {
    resource: "firewall-rule-cleanup",
    sessionId: "smoke",
    attribution: { source: "smoke" },
    consent
  });
  if (resourceResponse.resource.ipHash || resourceResponse.resource.consent) {
    throw new Error(`Resource response exposed private fields: ${JSON.stringify(resourceResponse.resource)}`);
  }

  const networkToolResponse = await post("/api/network-tools", {
    tool: "dns-lookup",
    target: "example.com",
    sessionId: "smoke",
    consent
  });
  if (!networkToolResponse.result?.details?.length) {
    throw new Error(`Network tool did not return diagnostic details: ${JSON.stringify(networkToolResponse)}`);
  }

  const leadResponse = await post("/api/leads", {
    name: "Smoke Test Lead",
    email: "smoke@example.com",
    phone: "+910000000000",
    interest: "Managed network services",
    challenge: "Smoke test",
    pipeline: "Managed Network Services",
    score: 82,
    sessionId: "smoke",
    attribution: { source: "smoke" },
    consent,
    sourceProfile: { source: "smoke" }
  });
  if (leadResponse.lead.ipHash || leadResponse.lead.email || leadResponse.lead.consent) {
    throw new Error(`Lead response exposed private fields: ${JSON.stringify(leadResponse.lead)}`);
  }
  if (!leadResponse.integrationSummary || typeof leadResponse.integrationSummary.attempted !== "number") {
    throw new Error(`Lead response did not include sanitized integration summary: ${JSON.stringify(leadResponse)}`);
  }

  const leadExport = await fetch(`${baseUrl}/api/export/leads.csv`, {
    headers: { "x-admin-token": adminToken }
  });
  if (!leadExport.ok || !/attachment/.test(leadExport.headers.get("content-disposition") || "")) {
    throw new Error(`Lead export did not return an attachment: ${leadExport.status}`);
  }
  if (!/no-store/i.test(leadExport.headers.get("cache-control") || "")) {
    throw new Error("Lead export should not be cached.");
  }

  const dashboard = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { "x-admin-token": adminToken }
  }).then((response) => response.json());
  if (!dashboard.totals.leads || !dashboard.totals.assessments || !dashboard.totals.events || !dashboard.totals.resources || !dashboard.totals.toolRuns) {
    throw new Error(`Dashboard did not update: ${JSON.stringify(dashboard.totals)}`);
  }
  if (!dashboard.totals.auditLogs || !dashboard.latestAuditLogs?.some((auditLog) => auditLog.action === "lead.created")) {
    throw new Error(`Dashboard did not include lead audit log: ${JSON.stringify(dashboard.totals)}`);
  }
  if (!dashboard.readiness || typeof dashboard.readiness.score !== "number") {
    throw new Error(`Dashboard did not include deployment readiness: ${JSON.stringify(dashboard)}`);
  }

  const readiness = await fetch(`${baseUrl}/api/admin/readiness`, {
    headers: { "x-admin-token": adminToken }
  }).then((response) => response.json());
  if (!readiness.ok || typeof readiness.readiness?.score !== "number") {
    throw new Error(`Readiness endpoint did not return a snapshot: ${JSON.stringify(readiness)}`);
  }

  console.log(JSON.stringify({ ok: true, totals: dashboard.totals }, null, 2));
} finally {
  server.kill();
}
