const toolDefinitions = {
  risk: {
    category: "Managed network services",
    title: "Network Risk Score",
    badge: "Lead magnet",
    pipeline: "Managed Network Services",
    offer: "Free Network Risk Review",
    fields: [
      { name: "users", label: "How many users?", type: "select", options: ["1-25", "26-100", "101-500", "500+"] },
      { name: "sites", label: "How many locations?", type: "select", options: ["1", "2-5", "6-20", "20+"] },
      { name: "monitoring", label: "Do you have active monitoring?", type: "select", options: ["Yes", "Partial", "No"] },
      { name: "firewall", label: "Firewall review status", type: "select", options: ["Reviewed recently", "Not sure", "Over 12 months"] },
      { name: "mfa", label: "VPN or remote access MFA?", type: "select", options: ["Enabled", "Partial", "Not enabled"] },
      { name: "incident", label: "Recent outage or incident?", type: "select", options: ["No", "Minor", "Major"] }
    ]
  },
  firewall: {
    category: "Network security",
    title: "Firewall Hygiene Checker",
    badge: "Security qualifier",
    pipeline: "Network Security",
    offer: "Firewall Hygiene Sprint",
    fields: [
      { name: "vendor", label: "Firewall vendor", type: "select", options: ["Fortinet", "Palo Alto", "Cisco", "Sophos", "Other"] },
      { name: "rules", label: "Rule count", type: "select", options: ["Under 50", "50-200", "200-500", "500+"] },
      { name: "anyrules", label: "Any broad allow rules?", type: "select", options: ["No", "Not sure", "Yes"] },
      { name: "logging", label: "Traffic/security logs enabled?", type: "select", options: ["Yes", "Partial", "No"] },
      { name: "backup", label: "Config backup process?", type: "select", options: ["Automated", "Manual", "None"] },
      { name: "admin", label: "Admin access protected?", type: "select", options: ["MFA and restricted", "Password only", "Not sure"] }
    ]
  },
  pentest: {
    category: "Penetration testing",
    title: "Pentest Readiness",
    badge: "Quote qualifier",
    pipeline: "Penetration Testing",
    offer: "Pentest Scope Call",
    fields: [
      { name: "asset", label: "Asset type", type: "select", options: ["External network", "Web app", "API", "Cloud", "Wi-Fi", "Internal network"] },
      { name: "scope", label: "Is the scope defined?", type: "select", options: ["Yes", "Partial", "No"] },
      { name: "timeline", label: "Target timeline", type: "select", options: ["This week", "This month", "This quarter", "Exploring"] },
      { name: "reason", label: "Reason", type: "select", options: ["Client requirement", "Compliance", "Launch", "Internal review"] },
      { name: "previous", label: "Previous test?", type: "select", options: ["Within 12 months", "Older", "Never"] },
      { name: "retest", label: "Need retesting?", type: "select", options: ["Yes", "Maybe", "No"] }
    ]
  },
  career: {
    category: "Institute and training",
    title: "Career Path Finder",
    badge: "Training funnel",
    pipeline: "Training / Institute",
    offer: "Demo Class and Counseling",
    fields: [
      { name: "level", label: "Current level", type: "select", options: ["Beginner", "Basic networking", "Working professional", "Advanced"] },
      { name: "goal", label: "Career goal", type: "select", options: ["Network engineer", "Security engineer", "SOC analyst", "Pentester", "Cloud network engineer"] },
      { name: "time", label: "Weekly study time", type: "select", options: ["2-4 hours", "5-8 hours", "9-15 hours", "15+ hours"] },
      { name: "mode", label: "Learning mode", type: "select", options: ["Online", "Classroom", "Hybrid", "Corporate batch"] },
      { name: "lab", label: "Hands-on lab experience", type: "select", options: ["None", "Basic", "Intermediate", "Strong"] },
      { name: "timeline", label: "Start timeline", type: "select", options: ["Immediately", "This month", "Next month", "Researching"] }
    ]
  }
};

const intentRoutes = {
  outage: {
    status: "Emergency troubleshooting funnel selected.",
    need: "Urgent troubleshooting or outage response",
    offer: "Emergency network triage call",
    pipeline: "Troubleshooting / Emergency",
    score: 40
  },
  security: {
    status: "Network security funnel selected.",
    need: "Firewall, VPN, segmentation, or Zero Trust improvement",
    offer: "Firewall Hygiene Checker",
    pipeline: "Network Security",
    score: 25,
    tool: "firewall"
  },
  monitoring: {
    status: "Managed network services funnel selected.",
    need: "Monitoring, NOC, uptime reporting, and managed network operations",
    offer: "Network Risk Score",
    pipeline: "Managed Network Services",
    score: 25,
    tool: "risk"
  },
  pentest: {
    status: "Penetration testing funnel selected.",
    need: "Vulnerability testing, compliance, or launch security review",
    offer: "Pentest Readiness Tool",
    pipeline: "Penetration Testing",
    score: 30,
    tool: "pentest"
  },
  training: {
    status: "Institute and training funnel selected.",
    need: "Network security training, career path, or corporate upskilling",
    offer: "Career Path Finder",
    pipeline: "Training / Institute",
    score: 20,
    tool: "career"
  }
};

const state = {
  score: 0,
  pipeline: "Unassigned",
  intent: "No intent selected",
  need: "Waiting for visitor action",
  offer: "Network Risk Score",
  followup: "No automation yet",
  consent: {
    necessary: true,
    analytics: false,
    marketing: false,
    personalization: false
  },
  events: [],
  attribution: parseAttribution(),
  sessionId: getOrCreateSession()
};

const elements = {
  heroStatus: document.querySelector("#heroStatus"),
  toolCategory: document.querySelector("#toolCategory"),
  toolTitle: document.querySelector("#toolTitle"),
  toolBadge: document.querySelector("#toolBadge"),
  assessmentForm: document.querySelector("#assessmentForm"),
  assessmentResult: document.querySelector("#assessmentResult"),
  scoreRing: document.querySelector("#scoreRing"),
  resultTitle: document.querySelector("#resultTitle"),
  resultText: document.querySelector("#resultText"),
  routeResult: document.querySelector("#routeResult"),
  dashScore: document.querySelector("#dashScore"),
  dashPriority: document.querySelector("#dashPriority"),
  dashPipeline: document.querySelector("#dashPipeline"),
  dashIntent: document.querySelector("#dashIntent"),
  dashConsent: document.querySelector("#dashConsent"),
  dashConsentDetail: document.querySelector("#dashConsentDetail"),
  dashSource: document.querySelector("#dashSource"),
  dashLanding: document.querySelector("#dashLanding"),
  briefNeed: document.querySelector("#briefNeed"),
  briefOffer: document.querySelector("#briefOffer"),
  briefFollowup: document.querySelector("#briefFollowup"),
  eventStream: document.querySelector("#eventStream"),
  cookiePanel: document.querySelector("#cookiePanel")
};

const apiEnabled = window.location.protocol === "http:" || window.location.protocol === "https:";

async function postJson(endpoint, payload) {
  if (!apiEnabled) {
    return { ok: false, offline: true };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.warn(`API request failed: ${endpoint}`, error);
    return { ok: false, error: error.message };
  }
}

function basePayload() {
  return {
    sessionId: state.sessionId,
    attribution: state.attribution,
    consent: state.consent,
    sourceProfile: {
      score: state.score,
      pipeline: state.pipeline,
      intent: state.intent,
      need: state.need,
      offer: state.offer
    }
  };
}

function parseAttribution() {
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get("utm_source") || document.referrer || "Direct",
    medium: params.get("utm_medium") || "none",
    campaign: params.get("utm_campaign") || "none",
    landing: window.location.pathname
  };
}

function getOrCreateSession() {
  const key = "ncgo_session_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = `anon_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  localStorage.setItem(key, id);
  return id;
}

function loadConsent() {
  const saved = localStorage.getItem("ncgo_consent");
  if (!saved) return;
  try {
    state.consent = { ...state.consent, ...JSON.parse(saved) };
    elements.cookiePanel.classList.add("hidden");
  } catch {
    localStorage.removeItem("ncgo_consent");
  }
}

function saveConsent(consent) {
  state.consent = { ...state.consent, ...consent };
  localStorage.setItem("ncgo_consent", JSON.stringify(state.consent));
  elements.cookiePanel.classList.add("hidden");
  trackEvent("consent_updated", { analytics: state.consent.analytics, marketing: state.consent.marketing }, false);
  renderDashboard();
}

function trackEvent(name, metadata = {}, requiresAnalytics = true) {
  if (requiresAnalytics && !state.consent.analytics) {
    return;
  }

  const event = {
    name,
    metadata,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  };
  state.events.unshift(event);
  state.events = state.events.slice(0, 18);
  renderEvents();
  void postJson("/api/events", {
    ...basePayload(),
    name,
    metadata,
    requiresAnalytics
  });
}

function addScore(points) {
  state.score = Math.min(100, state.score + points);
}

function priorityLabel(score) {
  if (score >= 80) return "Hot lead";
  if (score >= 50) return "Warm lead";
  if (score >= 25) return "Nurture lead";
  return "Anonymous visitor";
}

function selectIntent(intentKey) {
  const route = intentRoutes[intentKey];
  if (!route) return;

  document.querySelectorAll("[data-intent]").forEach((button) => {
    button.classList.toggle("active", button.dataset.intent === intentKey);
  });

  elements.heroStatus.textContent = route.status;
  state.intent = route.need;
  state.need = route.need;
  state.offer = route.offer;
  state.pipeline = route.pipeline;
  state.followup = `${route.pipeline} sequence`;
  addScore(route.score);

  if (route.tool) {
    setTool(route.tool);
  }

  trackEvent("intent_selected", { intent: intentKey, pipeline: route.pipeline });
  renderDashboard();
}

function setTool(toolKey) {
  const tool = toolDefinitions[toolKey];
  if (!tool) return;

  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === toolKey);
  });

  elements.toolCategory.textContent = tool.category;
  elements.toolTitle.textContent = tool.title;
  elements.toolBadge.textContent = tool.badge;

  elements.assessmentForm.innerHTML = "";
  tool.fields.forEach((field) => {
    const label = document.createElement("label");
    label.textContent = field.label;

    const select = document.createElement("select");
    select.name = field.name;
    select.required = true;

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select";
    select.appendChild(placeholder);

    field.options.forEach((option) => {
      const optionElement = document.createElement("option");
      optionElement.value = option;
      optionElement.textContent = option;
      select.appendChild(optionElement);
    });

    label.appendChild(select);
    elements.assessmentForm.appendChild(label);
  });

  const button = document.createElement("button");
  button.className = "primary-button";
  button.type = "submit";
  button.textContent = "Generate Score";
  elements.assessmentForm.appendChild(button);
  elements.assessmentForm.dataset.tool = toolKey;

  trackEvent("tool_selected", { tool: toolKey });
}

function calculateAssessment(toolKey, formData) {
  const answers = Object.fromEntries(formData.entries());
  const values = Array.from(formData.values());
  let riskPoints = 0;

  values.forEach((value) => {
    const normalized = String(value).toLowerCase();
    if (["no", "none", "never", "not enabled", "not sure", "over 12 months", "500+", "major", "this week"].some((term) => normalized.includes(term))) {
      riskPoints += 16;
    } else if (["partial", "manual", "older", "maybe", "this month", "101-500", "200-500"].some((term) => normalized.includes(term))) {
      riskPoints += 10;
    } else {
      riskPoints += 5;
    }
  });

  const score = Math.min(100, Math.max(18, Math.round(riskPoints)));
  const tool = toolDefinitions[toolKey];
  let level = "Low attention";
  let color = "#15803d";

  if (score >= 75) {
    level = "Critical priority";
    color = "#b91c1c";
  } else if (score >= 55) {
    level = "High priority";
    color = "#b45309";
  } else if (score >= 35) {
    level = "Medium priority";
    color = "#2563eb";
  }

  elements.scoreRing.textContent = score;
  elements.scoreRing.style.borderColor = color;
  elements.resultTitle.textContent = `${level}: ${tool.offer}`;
  elements.resultText.textContent = `Route this visitor to ${tool.pipeline}. Recommended next step: ${tool.offer}.`;

  state.pipeline = tool.pipeline;
  state.need = `${tool.title} completed`;
  state.offer = tool.offer;
  state.intent = tool.category;
  state.followup = `${tool.pipeline} automated follow-up`;
  addScore(Math.round(score / 2));

  trackEvent("assessment_complete", { tool: toolKey, score, pipeline: tool.pipeline });
  void postJson("/api/assessments", {
    ...basePayload(),
    tool: toolKey,
    title: tool.title,
    pipeline: tool.pipeline,
    recommendation: tool.offer,
    riskLevel: level,
    score,
    answers
  });
  renderDashboard();
}

function routeCommand(command) {
  const text = command.toLowerCase();
  const matchers = [
    { terms: ["vpn", "firewall", "zero trust", "security", "sase"], intent: "security", message: "Route to Network Security and Firewall Hygiene Checker." },
    { terms: ["outage", "down", "slow", "latency", "not working", "troubleshoot"], intent: "outage", message: "Route to Emergency Troubleshooting with high-priority alert." },
    { terms: ["pentest", "penetration", "vulnerability", "api test", "audit"], intent: "pentest", message: "Route to Penetration Testing and scope readiness." },
    { terms: ["ccna", "ccnp", "training", "course", "learn", "career"], intent: "training", message: "Route to Institute and Career Path Finder." },
    { terms: ["monitor", "noc", "managed", "uptime", "branch"], intent: "monitoring", message: "Route to Managed Network Services and Risk Score." }
  ];

  const match = matchers.find((item) => item.terms.some((term) => text.includes(term)));
  if (match) {
    selectIntent(match.intent);
    elements.routeResult.textContent = match.message;
    trackEvent("command_routed", { command, route: match.intent });
    return;
  }

  elements.routeResult.textContent = "Route to general discovery and Network Risk Score.";
  selectIntent("monitoring");
  trackEvent("command_routed", { command, route: "default" });
}

function renderDashboard() {
  elements.dashScore.textContent = state.score;
  elements.dashPriority.textContent = priorityLabel(state.score);
  elements.dashPipeline.textContent = state.pipeline;
  elements.dashIntent.textContent = state.intent;

  const enabled = Object.entries(state.consent)
    .filter(([, value]) => value)
    .map(([key]) => key);
  elements.dashConsent.textContent = enabled.length > 1 ? "Custom" : "Necessary";
  elements.dashConsentDetail.textContent = enabled.join(", ");

  elements.dashSource.textContent = state.attribution.source === "Direct" ? "Direct" : "Tracked";
  elements.dashLanding.textContent = `${state.attribution.medium} / ${state.attribution.campaign}`;
  elements.briefNeed.textContent = state.need;
  elements.briefOffer.textContent = state.offer;
  elements.briefFollowup.textContent = state.followup;
}

function renderEvents() {
  elements.eventStream.innerHTML = "";
  if (!state.events.length) {
    const empty = document.createElement("li");
    empty.textContent = "No consented events yet.";
    elements.eventStream.appendChild(empty);
    return;
  }

  state.events.forEach((event) => {
    const item = document.createElement("li");
    const meta = Object.entries(event.metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
    item.textContent = `${event.time} - ${event.name}${meta ? ` (${meta})` : ""}`;
    elements.eventStream.appendChild(item);
  });
}

function initCanvas() {
  const canvas = document.querySelector("#networkScene");
  const ctx = canvas.getContext("2d");
  const nodes = [];
  const packets = [];
  let width = 0;
  let height = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    nodes.length = 0;
    const count = width < 760 ? 22 : 38;
    for (let index = 0; index < count; index += 1) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.92,
        r: 2 + Math.random() * 3,
        drift: 0.15 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(248, 250, 252, 0.78)";
    ctx.fillRect(0, 0, width, height);

    const time = Date.now() / 1000;
    nodes.forEach((node) => {
      node.y += Math.sin(time + node.phase) * 0.025 * node.drift;
    });

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance < 190) {
          const alpha = Math.max(0, 1 - distance / 190) * 0.18;
          ctx.strokeStyle = `rgba(15, 118, 110, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    nodes.forEach((node, index) => {
      const pulse = 1 + Math.sin(time * 2 + node.phase) * 0.25;
      ctx.fillStyle = index % 7 === 0 ? "rgba(37, 99, 235, 0.75)" : "rgba(15, 118, 110, 0.75)";
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r * pulse, 0, Math.PI * 2);
      ctx.fill();
    });

    if (packets.length < 8 && Math.random() > 0.96) {
      const from = nodes[Math.floor(Math.random() * nodes.length)];
      const to = nodes[Math.floor(Math.random() * nodes.length)];
      if (from && to && from !== to) {
        packets.push({ from, to, progress: 0, color: Math.random() > 0.75 ? "#b45309" : "#0f766e" });
      }
    }

    packets.forEach((packet) => {
      packet.progress += 0.008;
      const x = packet.from.x + (packet.to.x - packet.from.x) * packet.progress;
      const y = packet.from.y + (packet.to.y - packet.from.y) * packet.progress;
      ctx.fillStyle = packet.color;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    for (let index = packets.length - 1; index >= 0; index -= 1) {
      if (packets[index].progress >= 1) packets.splice(index, 1);
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  draw();
}

function bindEvents() {
  document.querySelectorAll("[data-intent]").forEach((button) => {
    button.addEventListener("click", () => selectIntent(button.dataset.intent));
  });

  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.addEventListener("click", () => setTool(button.dataset.tool));
  });

  document.querySelector("#assessmentForm").addEventListener("submit", (event) => {
    event.preventDefault();
    calculateAssessment(event.currentTarget.dataset.tool, new FormData(event.currentTarget));
  });

  document.querySelector("#commandForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector("#commandInput");
    routeCommand(input.value || "");
  });

  document.querySelector("#leadForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const lead = Object.fromEntries(formData.entries());
    state.pipeline = formData.get("interest") || state.pipeline;
    state.need = formData.get("challenge") || state.need;
    state.followup = "CRM lead created and owner notification queued";
    addScore(50);

    const response = await postJson("/api/leads", {
      ...basePayload(),
      ...lead,
      score: state.score,
      pipeline: state.pipeline,
      consent: {
        ...state.consent,
        contact: formData.get("consent") === "on"
      }
    });

    trackEvent("generate_lead", { interest: formData.get("interest"), email: "captured" }, false);
    document.querySelector("#leadNote").textContent = response.ok
      ? "Lead profile saved to the local MVP database and queued for CRM-style follow-up."
      : "Lead profile created in the page preview. Start the local server to save it to the MVP database.";
    renderDashboard();
  });

  document.querySelectorAll("[data-resource]").forEach((button) => {
    button.addEventListener("click", () => {
      addScore(20);
      state.offer = "Resource nurture sequence";
      state.followup = "Send download, case study, and booking CTA";
      trackEvent("lead_magnet_download", { resource: button.dataset.resource });
      void postJson("/api/resources", {
        ...basePayload(),
        resource: button.dataset.resource
      });
      renderDashboard();
    });
  });

  document.querySelectorAll("[data-service-link]").forEach((link) => {
    link.addEventListener("click", () => {
      addScore(12);
      trackEvent("service_cta_click", { service: link.dataset.serviceLink });
      renderDashboard();
    });
  });

  document.querySelector("[data-action='open-command']").addEventListener("click", () => {
    document.querySelector("#commandInput").focus();
    document.querySelector(".command-strip").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  document.querySelector("[data-action='whatsapp']").addEventListener("click", () => {
    addScore(30);
    state.followup = "WhatsApp conversation started";
    trackEvent("whatsapp_click", {}, false);
    renderDashboard();
  });

  document.querySelector("#saveCookies").addEventListener("click", () => {
    saveConsent({
      analytics: document.querySelector("#analyticsConsent").checked,
      marketing: document.querySelector("#marketingConsent").checked,
      personalization: document.querySelector("#personalizationConsent").checked
    });
  });

  document.querySelector("#declineCookies").addEventListener("click", () => {
    saveConsent({ analytics: false, marketing: false, personalization: false });
  });

  document.querySelector("#clearEvents").addEventListener("click", () => {
    state.events = [];
    renderEvents();
  });
}

function init() {
  loadConsent();
  bindEvents();
  setTool("risk");
  renderDashboard();
  renderEvents();
  initCanvas();
  trackEvent("session_started", { session: state.sessionId }, false);
}

init();
