import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";

// Original repo-native diagrams. No external image service or generation API.
const dir = resolve("public/images/editorial");
mkdirSync(dir, { recursive: true });
const logo = readFileSync("public/brand/quantumcrafters-logo.png").toString("base64");
const escape = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const text = (x, y, value, size = 22, fill = "#263445", weight = 400) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${escape(value)}</text>`;
const box = (x, y, w, h, fill = "#ffffff", stroke = "#c4cfda") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const start = (height, title, description) => `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="${height * 2}" viewBox="0 0 1200 ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escape(title)}</title><desc id="desc">${escape(description)}</desc>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#176557"/></marker><marker id="context" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#52647c"/></marker></defs>
<rect width="1200" height="${height}" fill="#f6f8fb"/><rect width="1200" height="7" fill="#93264f"/>
<g font-family="Arial, sans-serif"><image x="52" y="27" width="185" height="56" href="data:image/png;base64,${logo}"/>
${text(790, 62, "QCS / FIELD NOTES / ZTNA", 19, "#8c254d", 700)}`;
function save(name, svg) {
  const full = `${svg}</g></svg>`;
  writeFileSync(resolve(dir, `${name}.svg`), full);
  writeFileSync(resolve(dir, `${name}.png`), new Resvg(full, { font: { loadSystemFonts: true, defaultFontFamily: "Arial" } }).render().asPng());
}

save("fortigate-ztna-access-path", start(675, "Managed does not mean reachable", "A conceptual endpoint-to-FortiGate-to-PAM application path. EMS connects separately to the endpoint for management and to FortiGate for trust context; it is not an application traffic hop.") +
text(52, 132, "Managed does not mean reachable.", 38, "#152338", 700) +
text(52, 169, "Prove the application path, not just the EMS connection.", 24) +
box(448, 213, 307, 95, "#edf1f7") + text(475, 250, "FortiClient EMS", 26, "#263445", 700) + text(475, 281, "Management + trust context", 20) +
`<path d="M190 361V263H436" fill="none" stroke="#52647c" stroke-width="3" stroke-dasharray="8 7"/>` +
text(64, 239, "Endpoint management", 20, "#52647c") +
`<path d="M603 309V351" fill="none" stroke="#52647c" stroke-width="3" stroke-dasharray="8 7"/><polygon points="603,361 595,347 611,347" fill="#52647c"/>` +
text(620, 344, "Identity + posture context", 19, "#52647c") +
box(52, 376, 278, 140) + text(77, 418, "Endpoint", 28, "#152338", 700) + text(77, 454, "Browser / FortiClient", 22) + text(77, 485, "Authorized request", 21) +
box(447, 376, 310, 140, "#fff2f6", "#93264f") + text(473, 418, "FortiGate gateway", 27, "#7f2146", 700) + text(473, 454, "Listener + trust + policy", 21) + text(473, 485, "Map the backend service", 20) +
box(873, 376, 276, 140, "#edf8f4", "#176557") + text(899, 418, "PAM application", 26, "#125245", 700) + text(899, 454, "Protected backend", 22) + text(899, 485, "Application response", 21) +
`<path d="M341 441H425M769 441H851M435 471H351M861 471H779" stroke="#176557" stroke-width="3"/><g fill="#176557"><polygon points="435,441 421,433 421,449"/><polygon points="861,441 847,433 847,449"/><polygon points="341,471 355,463 355,479"/><polygon points="769,471 783,463 783,479"/></g>` +
text(346, 399, "Client", 18, "#176557", 700) + text(347, 423, "leg", 18, "#176557", 700) +
text(771, 399, "Backend", 18, "#176557", 700) + text(791, 423, "leg", 18, "#176557", 700) +
text(52, 563, "SOLID: application request and reply", 20, "#263445", 700) +
text(580, 563, "DASHED: management / context", 20, "#263445", 700) +
text(52, 603, "Conceptual web path, not the customer's topology. EMS is not inline.", 21) +
text(52, 635, "Separate proxy connections. Verify backend protocol and TLS independently.", 21));

const stages = [
  ["1", "Request + listener", "Correct destination, interface, address and port?"],
  ["2", "Device + user context", "Expected identity, certificate, posture and user?"],
  ["3", "Policy + mapping", "Intended rule and backend service selected?"],
  ["4", "Backend connection", "Server reached and return path working?"],
  ["5", "Application workflow", "Response origin and authorized task verified?"],
  ["6", "Security boundary", "Approved negative control still denied?"]
];
let flow = start(840, "Find the first unproven boundary", "A six-part diagnostic checklist, not a packet-processing sequence: request and listener, device and user context, policy and mapping, backend connection, application workflow, and continued denial of unauthorized access.") +
text(52, 132, "Find the first unproven boundary.", 38, "#152338", 700) +
text(52, 169, "One timestamped request. Correlated evidence. A scoped correction.", 23);
for (const [i, stage] of stages.entries()) {
  const y = 208 + i * 81;
  flow += box(52, y, 1097, 67, i === 5 ? "#edf8f4" : "#ffffff") +
  `<circle cx="86" cy="${y + 33}" r="20" fill="${i === 5 ? "#176557" : "#93264f"}"/>` +
  text(80, y + 40, stage[0], 21, "#ffffff", 700) + text(124, y + 41, stage[1], 23, "#152338", 700) +
  text(472, y + 41, stage[2], 22);
}
flow += text(52, 736, "Missing evidence? Investigate that boundary; do not assume the cause.", 22, "#8c254d", 700) +
text(52, 773, "Diagnostic checklist, not a universal processing order or customer test result.", 21) +
text(52, 807, "Keep trust controls enabled. A login page alone is not full workflow success.", 21);
save("fortigate-ztna-evidence-map", flow);
