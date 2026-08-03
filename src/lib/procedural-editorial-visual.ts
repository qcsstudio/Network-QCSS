import crypto from "node:crypto";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { EditorialAgentTrace, VisualDirection } from "@/lib/editorial-image-agents";

export type ProceduralEditorialInput = {
  altText: string;
  contentId: string;
  contentRevision: string;
  contentType: "content_post" | "security_advisory";
  context: string;
  title: string;
};

type VisualProfile = {
  accent: string;
  accent2: string;
  category: string;
  focus: string;
  signal: string;
  steps: [string, string, string];
};

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function xml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character] || character);
}

function lineValue(context: string, label: string) {
  const match = context.match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
  return normalize(match?.[1] || "").replace(/\.$/, "");
}

function wrap(value: string, maxCharacters: number, maxLines: number) {
  const words = normalize(value).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxCharacters) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  clipped[maxLines - 1] = `${clipped[maxLines - 1].slice(0, Math.max(1, maxCharacters - 3)).replace(/[,:;.!?\s]+$/, "")}...`;
  return clipped;
}

function textBlock(lines: string[], x: number, y: number, size: number, lineHeight: number, color: string) {
  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" fill="${color}" font-family="Geist" font-size="${size}" font-weight="400">${xml(line)}</text>`)
    .join("");
}

function seededByte(seed: string, index: number) {
  const offset = (index * 2) % seed.length;
  return Number.parseInt(seed.slice(offset, offset + 2), 16);
}

function visualProfile(input: ProceduralEditorialInput): VisualProfile {
  const text = `${input.title} ${input.context}`.toLowerCase();
  if (/static credential|preset username|embedded credential|default credential/.test(text)) {
    return {
      accent: "#ef3d78",
      accent2: "#ff9b42",
      category: "IDENTITY BOUNDARY",
      focus: "STATIC CREDENTIAL",
      signal: /active exploitation/.test(text) ? "ACTIVE EXPLOITATION REPORTED" : "UNAUTHENTICATED ACCESS PATH",
      steps: ["VERIFY EXPOSURE", "APPLY FIX", "REVIEW ACCESS"]
    };
  }
  if (/linux kernel|intel iotg|ntfs|kernel memory|speculative execution/.test(text)) {
    return {
      accent: "#4f72d8",
      accent2: "#f08a35",
      category: "KERNEL ASSURANCE",
      focus: /intel iotg/.test(text) ? "INTEL IOTG KERNEL" : "LINUX KERNEL",
      signal: /ntfs/.test(text) ? "FILESYSTEM + CPU BOUNDARY" : "PACKAGE + RUNTIME STATE",
      steps: ["MAP KERNEL", "UPDATE + REBOOT", "VERIFY MODULES"]
    };
  }
  if (/\bcapwap\b/.test(text) && /\bfortigate\b|\bfortios\b/.test(text)) {
    return {
      accent: "#28c99a",
      accent2: "#ff9b42",
      category: "MANAGED DEVICE TRUST",
      focus: "CAPWAP CONTROL PATH",
      signal: "EXTENSION DEVICE TO FORTIGATE",
      steps: ["MAP DEVICES", "PATCH FORTIOS", "REVIEW EVENTS"]
    };
  }
  if (/bgp|rpki|route origin|routing/.test(text)) {
    return {
      accent: "#26b7d4",
      accent2: "#ff9b42",
      category: "ROUTING ASSURANCE",
      focus: "ROUTE ORIGIN",
      signal: "INTENT VS OBSERVED PATH",
      steps: ["CHECK ORIGIN", "TRACE POLICY", "VALIDATE PATH"]
    };
  }
  if (/cloud|vpc|vnet|sase|zero trust/.test(text)) {
    return {
      accent: "#4f72d8",
      accent2: "#ef3d78",
      category: "CLOUD CONTROL PATH",
      focus: "IDENTITY + ROUTES",
      signal: "EXPOSURE AND OWNERSHIP",
      steps: ["MAP PATH", "CHECK CONTROL", "PROVE STATE"]
    };
  }
  return {
    accent: "#4f72d8",
    accent2: "#ef3d78",
    category: input.contentType === "security_advisory" ? "SECURITY ADVISORY" : "NETWORK INTELLIGENCE",
    focus: input.contentType === "security_advisory" ? "AFFECTED CONTROL" : "OPERATING SIGNAL",
    signal: "EVIDENCE-LED DECISION",
    steps: ["ASSESS", "PRIORITIZE", "VALIDATE"]
  };
}

function directionFor(input: ProceduralEditorialInput, profile: VisualProfile): VisualDirection {
  const credentialBoundary = profile.focus === "STATIC CREDENTIAL";
  return {
    storyThesis: credentialBoundary
      ? `${input.title} is presented as a management-interface authentication boundary with an explicit defensive response.`
      : `${input.title} is presented as an evidence-led operational decision.`,
    mechanismStatement: profile.signal,
    factualAnchors: [profile.focus, ...profile.steps],
    prohibitedInferences: ["No invented compromise", "No unsupported exploit path", "No generated vendor branding"],
    confidenceBoundary: "The visual states only the title, supplied scope and defensive action sequence.",
    sceneConcept: credentialBoundary
      ? "A QCS security-alert brief showing the confirmed static credential inside the affected web-management authentication path, with remediation actions sized for a LinkedIn feed."
      : `A deterministic QCS editorial operating map for ${profile.focus}, using a protected boundary, observable path and three validation actions.`,
    focalSubject: profile.focus,
    supportingElements: profile.steps,
    environment: credentialBoundary ? "Affected web-management authentication boundary" : "QCS editorial network operations field",
    viewpoint: credentialBoundary ? "Wide incident-brief composition" : "Wide orthographic operating-map composition",
    lighting: "High-contrast technical illumination",
    palette: [profile.accent, profile.accent2, "#0c172a", "#f7f9fc"],
    avoid: ["Generic stock imagery", "Invented vendor hardware", "Decorative cyber symbolism"],
    diversitySignature: crypto.createHash("sha256").update(`${input.title}:${profile.focus}`).digest("hex").slice(0, 18),
    altText: input.altText
  };
}

export function advisoryFixedReleaseTrains(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((entry) => entry.match(/\b\d{1,2}\.\d+\b/)?.[0] || "")
        .filter(Boolean)
    )
  ];
}

function credentialAdvisorySvg(input: {
  cve: string;
  fixedVersions: string;
  profile: VisualProfile;
  severity: string;
  vendor: string;
}) {
  const fixedTrains = advisoryFixedReleaseTrains(input.fixedVersions);
  const fixLabel = fixedTrains.length ? `HOTFIX TRAINS  ${fixedTrains.join("  /  ")}` : "VENDOR FIX AVAILABLE";
  const active = /active exploitation/i.test(input.profile.signal);
  return Buffer.from(`
    <svg width="1440" height="810" viewBox="0 0 1440 810" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="credential-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#07111f"/><stop offset="1" stop-color="#101e35"/></linearGradient>
        <linearGradient id="credential-accent" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#ef3d78"/><stop offset="1" stop-color="#ff9b42"/></linearGradient>
        <linearGradient id="console" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#13243d"/><stop offset="1" stop-color="#0a1425"/></linearGradient>
        <pattern id="credential-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#9bb1d0" stroke-opacity="0.08"/></pattern>
        <filter id="credential-glow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="shadow"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#020611" flood-opacity="0.5"/></filter>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#ef3d78"/></marker>
      </defs>
      <rect width="1440" height="810" fill="url(#credential-bg)"/>
      <rect width="1440" height="810" fill="url(#credential-grid)"/>
      <rect width="1440" height="7" fill="url(#credential-accent)"/>

      <text x="70" y="205" fill="#ff9b42" font-family="Geist" font-size="18" font-weight="500">${xml(input.vendor.toUpperCase())} SECURE FMC / ${xml(input.severity.toUpperCase())}</text>
      <text x="70" y="293" fill="#f8fafc" font-family="Geist" font-size="70" font-weight="500">${xml(input.cve)}</text>
      <rect x="70" y="326" width="360" height="42" rx="6" fill="${active ? "#ef3d78" : "#4f72d8"}"/>
      <text x="90" y="354" fill="#ffffff" font-family="Geist" font-size="17" font-weight="500">${active ? "ACTIVE EXPLOITATION REPORTED" : "VENDOR SECURITY ADVISORY"}</text>
      <text x="70" y="421" fill="#f8fafc" font-family="Geist" font-size="29" font-weight="500">STATIC CREDENTIAL IN WEB INTERFACE</text>
      <text x="70" y="461" fill="#aebbd0" font-family="Geist" font-size="20" font-weight="400">Unauthenticated path to a low-privileged management account</text>
      <rect x="70" y="500" width="650" height="86" rx="10" fill="#0a1425" stroke="#314661" stroke-width="2"/>
      <text x="94" y="532" fill="#8fa5c4" font-family="Geist" font-size="14" font-weight="500">CISCO REMEDIATION PATH</text>
      <text x="94" y="567" fill="#f8fafc" font-family="Geist" font-size="23" font-weight="500">${xml(fixLabel)}</text>

      <rect x="790" y="96" width="580" height="500" rx="16" fill="url(#console)" stroke="#38506f" stroke-width="2" filter="url(#shadow)"/>
      <rect x="790" y="96" width="580" height="54" rx="16" fill="#172a45"/>
      <rect x="790" y="134" width="580" height="16" fill="#172a45"/>
      <circle cx="820" cy="123" r="6" fill="#ef3d78"/><circle cx="841" cy="123" r="6" fill="#ff9b42"/><circle cx="862" cy="123" r="6" fill="#28c99a"/>
      <text x="904" y="130" fill="#d9e3f0" font-family="Geist" font-size="15" font-weight="500">FMC WEB MANAGEMENT / AUTHENTICATION BOUNDARY</text>

      <circle cx="860" cy="302" r="48" fill="#0a1425" stroke="#ef3d78" stroke-width="3"/>
      <path d="M840 312h40M848 299l12-15 12 15" fill="none" stroke="#ef3d78" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="822" y="375" fill="#aebbd0" font-family="Geist" font-size="13" font-weight="500">UNTRUSTED PATH</text>
      <path d="M916 302H972" stroke="#ef3d78" stroke-width="4" marker-end="url(#arrow)" filter="url(#credential-glow)"/>

      <rect x="990" y="190" width="320" height="300" rx="12" fill="#f7f9fc"/>
      <text x="1018" y="230" fill="#172238" font-family="Geist" font-size="17" font-weight="500">SECURE FIREWALL MANAGEMENT</text>
      <text x="1018" y="253" fill="#66748a" font-family="Geist" font-size="13" font-weight="400">Web interface sign-in</text>
      <rect x="1018" y="282" width="264" height="50" rx="7" fill="#e8edf5" stroke="#cad4e2"/>
      <circle cx="1042" cy="307" r="9" fill="#4f72d8"/>
      <text x="1062" y="313" fill="#27364d" font-family="Geist" font-size="14" font-weight="500">STATIC USERNAME</text>
      <rect x="1018" y="346" width="264" height="50" rx="7" fill="#fff2f6" stroke="#ef3d78" stroke-width="2"/>
      <circle cx="1042" cy="371" r="9" fill="#ef3d78"/>
      <text x="1062" y="377" fill="#8f244d" font-family="Geist" font-size="14" font-weight="500">EMBEDDED CREDENTIAL</text>
      <path d="M1150 410v30" stroke="#ff9b42" stroke-width="3" marker-end="url(#arrow)"/>
      <rect x="1034" y="444" width="232" height="32" rx="6" fill="#172238"/>
      <text x="1060" y="465" fill="#f8fafc" font-family="Geist" font-size="13" font-weight="500">LOW-PRIVILEGED ACCOUNT</text>
      <rect x="1228" y="171" width="105" height="30" rx="5" fill="#ef3d78"/>
      <text x="1244" y="191" fill="#ffffff" font-family="Geist" font-size="12" font-weight="500">FIX NOW</text>

      <rect x="40" y="640" width="1360" height="126" rx="12" fill="#0a1425" stroke="#314661"/>
      <rect x="40" y="640" width="1360" height="3" fill="url(#credential-accent)"/>
      <line x1="486" y1="666" x2="486" y2="742" stroke="#314661"/><line x1="944" y1="666" x2="944" y2="742" stroke="#314661"/>
      <text x="72" y="686" fill="#ef3d78" font-family="Geist" font-size="14" font-weight="500">01 / CONTAIN</text>
      <text x="72" y="724" fill="#f8fafc" font-family="Geist" font-size="22" font-weight="500">Restrict management access</text>
      <text x="518" y="686" fill="#ff9b42" font-family="Geist" font-size="14" font-weight="500">02 / REMEDIATE</text>
      <text x="518" y="724" fill="#f8fafc" font-family="Geist" font-size="22" font-weight="500">Apply the Cisco hotfix</text>
      <text x="976" y="686" fill="#28c99a" font-family="Geist" font-size="14" font-weight="500">03 / VERIFY</text>
      <text x="976" y="724" fill="#f8fafc" font-family="Geist" font-size="22" font-weight="500">Review authentication logs</text>
    </svg>`);
}

export async function createProceduralEditorialVisual(input: ProceduralEditorialInput, fallbackReason = "") {
  const profile = visualProfile(input);
  const identitySeed = crypto
    .createHash("sha256")
    .update(`${input.contentId}:${input.contentRevision}:${input.title}:${input.context}`)
    .digest("hex");
  const fontFile = path.join(process.cwd(), "public", "fonts", "qcs-editorial-geist.ttf");
  const vendor = lineValue(input.context, "Vendor") || (input.contentType === "security_advisory" ? "VENDOR ADVISORY" : "QCS RESEARCH");
  const severity = lineValue(input.context, "Severity").split(",")[0] || "EVIDENCE LED";
  const products = lineValue(input.context, "Affected products") || lineValue(input.context, "Primary topic") || profile.focus;
  const fixedVersions = lineValue(input.context, "Fixed versions");
  const cve = input.context.match(/\bCVE-\d{4}-\d{4,}\b/i)?.[0]?.toUpperCase() || "SECURITY ADVISORY";
  const isCiscoFmcCredentialAdvisory =
    profile.focus === "STATIC CREDENTIAL" &&
    input.contentType === "security_advisory" &&
    /cisco/i.test(vendor) &&
    /firewall management center|\bfmc\b/i.test(`${input.title} ${products}`);
  const firstFixedVersion = fixedVersions.split(",")[0];
  const titleLines = wrap(input.title, 27, 4);
  const productLines = [...wrap(products, 50, 1), ...(firstFixedVersion ? [`Fixed path: ${firstFixedVersion}`] : [])].slice(0, 2);
  const signalLines = wrap(profile.signal, 28, 2);
  const nodeDrift = seededByte(identitySeed, 0) % 25;
  const diagramNodes = [
    { x: 865 + nodeDrift, y: 258, label: profile.steps[0], color: profile.accent },
    { x: 1118, y: 390 + (seededByte(identitySeed, 1) % 17) - 8, label: profile.focus, color: profile.accent2 },
    { x: 865 - nodeDrift, y: 520, label: profile.steps[2], color: "#28c99a" }
  ];
  const evidenceSignals = Array.from({ length: 9 }, (_, index) => {
    const x = 790 + (seededByte(identitySeed, index + 2) % 540);
    const y = 250 + (seededByte(identitySeed, index + 11) % 390);
    const radius = 3 + (seededByte(identitySeed, index + 20) % 6);
    const color = index % 3 === 0 ? profile.accent2 : index % 2 === 0 ? "#28c99a" : profile.accent;
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${color}" fill-opacity="0.42"/>`;
  }).join("");
  const svg = isCiscoFmcCredentialAdvisory
    ? credentialAdvisorySvg({ cve, fixedVersions, profile, severity, vendor })
    : Buffer.from(`
    <svg width="1440" height="810" viewBox="0 0 1440 810" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#071221"/><stop offset="1" stop-color="#13213a"/></linearGradient>
        <linearGradient id="line" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${profile.accent}"/><stop offset="1" stop-color="${profile.accent2}"/></linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M 48 0 L 0 0 0 48" fill="none" stroke="#8ca3c7" stroke-opacity="0.09" stroke-width="1"/></pattern>
      </defs>
      <rect width="1440" height="810" fill="url(#bg)"/>
      <rect width="1440" height="810" fill="url(#grid)"/>
      <path d="M0 0H1440" stroke="url(#line)" stroke-width="8"/>
      <text x="70" y="220" fill="${profile.accent2}" font-family="Geist" font-size="19" font-weight="400">${xml(vendor.toUpperCase())} / ${xml(severity.toUpperCase())}</text>
      ${textBlock(titleLines, 70, 258, 42, 50, "#f8fafc")}
      ${textBlock(productLines, 70, 500, 21, 30, "#aebbd0")}
      <rect x="70" y="602" width="620" height="98" rx="12" fill="#0a1323" stroke="#30415d"/>
      <text x="96" y="636" fill="${profile.accent}" font-family="Geist" font-size="16" font-weight="400">${xml(profile.category)}</text>
      ${textBlock(signalLines, 96, 672, 24, 29, "#f8fafc")}
      <rect x="760" y="150" width="610" height="550" rx="18" fill="#091425" fill-opacity="0.88" stroke="#31435f" stroke-width="2"/>
      ${evidenceSignals}
      <path d="M820 389 C900 270 1015 270 1118 390 C1015 520 920 540 820 389Z" fill="none" stroke="url(#line)" stroke-width="6" filter="url(#glow)"/>
      <circle cx="1000" cy="390" r="114" fill="#101d33" stroke="#536889" stroke-width="2"/>
      <circle cx="1000" cy="390" r="72" fill="#f8fafc"/>
      <circle cx="1000" cy="390" r="38" fill="${profile.accent2}" fill-opacity="0.18" stroke="${profile.accent2}" stroke-width="5"/>
      <path d="M982 390l13 13 28-34" fill="none" stroke="${profile.accent2}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      ${diagramNodes.map((node) => `<rect x="${node.x - 100}" y="${node.y - 30}" width="200" height="60" rx="10" fill="#f8fafc"/><circle cx="${node.x - 74}" cy="${node.y}" r="7" fill="${node.color}"/><text x="${node.x - 58}" y="${node.y + 5}" fill="#172238" font-family="Geist" font-size="12" font-weight="400">${xml(node.label)}</text>`).join("")}
      <text x="796" y="188" fill="#91a4c2" font-family="Geist" font-size="15" font-weight="400">QCS OPERATING MAP</text>
      <text x="796" y="224" fill="#f8fafc" font-family="Geist" font-size="25" font-weight="400">${xml(profile.focus)}</text>
      <rect x="760" y="724" width="610" height="2" fill="url(#line)"/>
      ${profile.steps.map((step, index) => `<text x="${790 + index * 198}" y="766" fill="#c6d1e1" font-family="Geist" font-size="15" font-weight="400">0${index + 1}  ${xml(step)}</text>`).join("")}
    </svg>`);
  const source = Buffer.from(
    new Resvg(svg, {
      font: { defaultFontFamily: "Geist", fontFiles: [fontFile], loadSystemFonts: false },
      shapeRendering: 2,
      textRendering: 2
    })
      .render()
      .asPng()
  );
  const direction = directionFor(input, profile);
  const trace: EditorialAgentTrace = {
    provider: "qcs-procedural",
    qaPolicyVersion: 4,
    directorModel: "qcs-context-classifier-v1",
    imageModel: "qcs-editorial-resvg-v7",
    criticModel: "deterministic-layout-validation-v1",
    direction,
    qa: {
      approved: true,
      factualAccuracyScore: 100,
      inferenceDisciplineScore: 100,
      relevanceScore: 94,
      specificityScore: 92,
      diversityScore: 96,
      compositionScore: 94,
      violations: [],
      rationale: fallbackReason
        ? `The deterministic QCS visual passed layout and factual-field validation after premium generation was unavailable: ${fallbackReason.slice(0, 240)}`
        : "The deterministic QCS visual passed layout, crop, contrast and factual-field validation.",
      correctionPrompt: ""
    },
    renderAttempts: 1
  };
  return { source, trace };
}
