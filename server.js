const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const storePath = path.join(dataDir, "store.json");
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8"
};

const allowedEventWithoutAnalytics = new Set([
  "session_started",
  "consent_updated",
  "generate_lead",
  "whatsapp_click",
  "phone_click",
  "book_call_click"
]);

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(storePath)) {
    const initialStore = {
      leads: [],
      events: [],
      assessments: [],
      resources: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(storePath, JSON.stringify(initialStore, null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(storePath, "utf8"));
}

function writeStore(store) {
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(text)
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function getIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function getCountry(req) {
  return (
    req.headers["x-vercel-ip-country"] ||
    req.headers["cf-ipcountry"] ||
    req.headers["x-country"] ||
    "Unknown"
  );
}

function hashIp(ip) {
  return crypto.createHash("sha256").update(`ncgo:${ip}`).digest("hex");
}

function clientContext(req, includeRawIp = false) {
  const ip = getIp(req);
  const context = {
    country: getCountry(req),
    ipHash: hashIp(ip),
    userAgent: req.headers["user-agent"] || "unknown",
    referrer: req.headers.referer || req.headers.referrer || "direct",
    receivedAt: new Date().toISOString()
  };

  if (includeRawIp) {
    context.ipAddress = ip;
  }

  return context;
}

function sanitizeString(value, maxLength = 1000) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeObject(input, maxDepth = 3) {
  if (maxDepth <= 0 || input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.slice(0, 100).map((item) => sanitizeObject(item, maxDepth - 1));
  if (typeof input !== "object") return typeof input === "string" ? sanitizeString(input, 2000) : input;

  const output = {};
  Object.entries(input).slice(0, 80).forEach(([key, value]) => {
    output[sanitizeString(key, 100)] = sanitizeObject(value, maxDepth - 1);
  });
  return output;
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function scorePriority(score) {
  if (score >= 80) return "hot";
  if (score >= 50) return "warm";
  if (score >= 25) return "nurture";
  return "low";
}

function normalizeLead(payload, req) {
  const consent = sanitizeObject(payload.consent || {});
  const leadScore = Number(payload.score || 0);
  const createdAt = new Date().toISOString();

  return {
    id: createId("lead"),
    name: sanitizeString(payload.name, 180),
    email: sanitizeString(payload.email, 240).toLowerCase(),
    phone: sanitizeString(payload.phone, 80),
    interest: sanitizeString(payload.interest, 180),
    challenge: sanitizeString(payload.challenge, 2000),
    pipeline: sanitizeString(payload.pipeline || payload.interest || "Unassigned", 180),
    score: Number.isFinite(leadScore) ? Math.max(0, Math.min(100, leadScore)) : 0,
    priority: scorePriority(leadScore),
    sessionId: sanitizeString(payload.sessionId, 200),
    attribution: sanitizeObject(payload.attribution || {}),
    consent,
    sourceProfile: sanitizeObject(payload.sourceProfile || {}),
    context: clientContext(req, true),
    stage: "new",
    createdAt,
    updatedAt: createdAt
  };
}

function normalizeEvent(payload, req) {
  return {
    id: createId("evt"),
    name: sanitizeString(payload.name, 120),
    sessionId: sanitizeString(payload.sessionId, 200),
    metadata: sanitizeObject(payload.metadata || {}),
    consent: sanitizeObject(payload.consent || {}),
    context: clientContext(req, false),
    createdAt: new Date().toISOString()
  };
}

function normalizeAssessment(payload, req) {
  const score = Number(payload.score || 0);
  return {
    id: createId("asm"),
    tool: sanitizeString(payload.tool, 100),
    title: sanitizeString(payload.title, 180),
    pipeline: sanitizeString(payload.pipeline, 180),
    recommendation: sanitizeString(payload.recommendation, 300),
    riskLevel: sanitizeString(payload.riskLevel, 100),
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
    answers: sanitizeObject(payload.answers || {}),
    sessionId: sanitizeString(payload.sessionId, 200),
    attribution: sanitizeObject(payload.attribution || {}),
    consent: sanitizeObject(payload.consent || {}),
    context: clientContext(req, false),
    createdAt: new Date().toISOString()
  };
}

function summarizeDashboard(store) {
  const leads = store.leads || [];
  const events = store.events || [];
  const assessments = store.assessments || [];
  const resources = store.resources || [];
  const byPipeline = {};
  const byCountry = {};

  leads.forEach((lead) => {
    const pipeline = lead.pipeline || "Unassigned";
    const country = lead.context?.country || "Unknown";
    byPipeline[pipeline] = (byPipeline[pipeline] || 0) + 1;
    byCountry[country] = (byCountry[country] || 0) + 1;
  });

  const hotLeads = leads.filter((lead) => lead.priority === "hot").length;
  const latestLeads = leads.slice(-10).reverse();
  const latestEvents = events.slice(-15).reverse();
  const latestAssessments = assessments.slice(-10).reverse();

  return {
    totals: {
      leads: leads.length,
      hotLeads,
      events: events.length,
      assessments: assessments.length,
      resources: resources.length
    },
    byPipeline,
    byCountry,
    latestLeads,
    latestEvents,
    latestAssessments,
    updatedAt: store.updatedAt
  };
}

function toCsv(rows) {
  const headers = ["createdAt", "name", "email", "phone", "interest", "pipeline", "score", "priority", "country", "source"];
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  rows.forEach((lead) => {
    lines.push(
      [
        lead.createdAt,
        lead.name,
        lead.email,
        lead.phone,
        lead.interest,
        lead.pipeline,
        lead.score,
        lead.priority,
        lead.context?.country,
        lead.attribution?.source
      ]
        .map(escape)
        .join(",")
    );
  });
  return lines.join("\n");
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === "/" ? path.join(rootDir, "index.html") : path.join(rootDir, pathname);
  filePath = path.normalize(filePath);

  if (!filePath.startsWith(rootDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendText(res, 404, "Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600"
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      name: "Network Command Growth OS",
      mode: "local-mvp",
      time: new Date().toISOString()
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/dashboard") {
    sendJson(res, 200, summarizeDashboard(readStore()));
    return;
  }

  if (req.method === "GET" && pathname === "/api/leads") {
    const store = readStore();
    sendJson(res, 200, { leads: (store.leads || []).slice().reverse() });
    return;
  }

  if (req.method === "GET" && pathname === "/api/export/leads.csv") {
    const store = readStore();
    sendText(res, 200, toCsv(store.leads || []), "text/csv; charset=utf-8");
    return;
  }

  if (req.method === "POST" && pathname === "/api/leads") {
    const payload = await readBody(req);
    if (!payload.name || !payload.email || !payload.phone || !payload.consent?.contact) {
      sendJson(res, 400, { ok: false, error: "Name, email, phone, and contact consent are required." });
      return;
    }

    const store = readStore();
    const lead = normalizeLead(payload, req);
    store.leads.push(lead);
    writeStore(store);
    sendJson(res, 201, { ok: true, lead });
    return;
  }

  if (req.method === "POST" && pathname === "/api/events") {
    const payload = await readBody(req);
    const eventName = sanitizeString(payload.name, 120);
    const consent = payload.consent || {};
    const allowed = consent.analytics || allowedEventWithoutAnalytics.has(eventName);

    if (!allowed) {
      sendJson(res, 202, { ok: true, stored: false, reason: "analytics_consent_required" });
      return;
    }

    const store = readStore();
    const event = normalizeEvent({ ...payload, name: eventName }, req);
    store.events.push(event);
    writeStore(store);
    sendJson(res, 201, { ok: true, stored: true, eventId: event.id });
    return;
  }

  if (req.method === "POST" && pathname === "/api/assessments") {
    const payload = await readBody(req);
    const store = readStore();
    const assessment = normalizeAssessment(payload, req);
    store.assessments.push(assessment);
    writeStore(store);
    sendJson(res, 201, { ok: true, assessment });
    return;
  }

  if (req.method === "POST" && pathname === "/api/resources") {
    const payload = await readBody(req);
    const store = readStore();
    const resource = {
      id: createId("res"),
      name: sanitizeString(payload.resource, 160),
      sessionId: sanitizeString(payload.sessionId, 200),
      attribution: sanitizeObject(payload.attribution || {}),
      consent: sanitizeObject(payload.consent || {}),
      context: clientContext(req, false),
      createdAt: new Date().toISOString()
    };
    store.resources.push(resource);
    writeStore(store);
    sendJson(res, 201, { ok: true, resource });
    return;
  }

  sendJson(res, 404, { ok: false, error: "API route not found." });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }

    serveStatic(req, res, pathname);
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Server error" });
  }
});

ensureStore();
server.listen(port, () => {
  console.log(`Network Command Growth OS running at http://localhost:${port}`);
});
