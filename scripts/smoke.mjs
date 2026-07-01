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
  const unauthorizedDashboard = await fetch(`${baseUrl}/api/dashboard`);
  if (unauthorizedDashboard.status !== 401) {
    throw new Error(`Dashboard should require admin auth. Received ${unauthorizedDashboard.status}`);
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

  await post("/api/assessments", {
    tool: "network-risk-score",
    title: "Network Risk Score",
    pipeline: "Managed Network Services",
    recommendation: "Free Network Risk Review",
    riskLevel: "High priority",
    score: 68,
    answers: { monitoring: "Partial" },
    consent
  });

  await post("/api/leads", {
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

  const dashboard = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { "x-admin-token": adminToken }
  }).then((response) => response.json());
  if (!dashboard.totals.leads || !dashboard.totals.assessments || !dashboard.totals.events) {
    throw new Error(`Dashboard did not update: ${JSON.stringify(dashboard.totals)}`);
  }

  console.log(JSON.stringify({ ok: true, totals: dashboard.totals }, null, 2));
} finally {
  server.kill();
}
