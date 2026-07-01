const { spawn } = require("child_process");

const baseUrl = "http://localhost:4173";
const server = spawn(process.execPath, ["server.js"], {
  cwd: __dirname,
  stdio: ["ignore", "pipe", "pipe"]
});

let stdout = "";
let stderr = "";
server.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return response.json();
    } catch {
      await wait(250);
    }
  }
  throw new Error(`Server did not start. stdout=${stdout} stderr=${stderr}`);
}

async function post(endpoint, body) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`${endpoint} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function run() {
  try {
    await waitForServer();

    const basePayload = {
      sessionId: `verify_${Date.now()}`,
      attribution: {
        source: "verify",
        medium: "local",
        campaign: "mvp-test",
        landing: "/"
      },
      consent: {
        necessary: true,
        analytics: true,
        marketing: false,
        personalization: false
      }
    };

    await post("/api/events", {
      ...basePayload,
      name: "session_started",
      metadata: { mode: "verify" }
    });

    await post("/api/assessments", {
      ...basePayload,
      tool: "risk",
      title: "Network Risk Score",
      pipeline: "Managed Network Services",
      recommendation: "Free Network Risk Review",
      riskLevel: "High priority",
      score: 67,
      answers: {
        monitoring: "Partial",
        firewall: "Over 12 months"
      }
    });

    await post("/api/leads", {
      ...basePayload,
      name: "Verification Lead",
      email: "verify@example.com",
      phone: "+910000000000",
      interest: "Managed network services",
      challenge: "Local verification lead",
      pipeline: "Managed Network Services",
      score: 87,
      consent: {
        ...basePayload.consent,
        contact: true
      }
    });

    const dashboardResponse = await fetch(`${baseUrl}/api/dashboard`);
    const dashboard = await dashboardResponse.json();

    if (!dashboard.totals.leads || !dashboard.totals.assessments || !dashboard.totals.events) {
      throw new Error(`Dashboard totals not updated: ${JSON.stringify(dashboard.totals)}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          totals: dashboard.totals,
          latestLead: dashboard.latestLeads[0]?.email,
          latestAssessment: dashboard.latestAssessments[0]?.title
        },
        null,
        2
      )
    );
  } finally {
    server.kill();
  }
}

run().catch((error) => {
  server.kill();
  console.error(error);
  process.exit(1);
});
