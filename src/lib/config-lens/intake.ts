import { getProfile, type Selection } from "./catalog";
import { fortinetCommandRanges } from "./fortinet-syntax";

export const INPUT_LIMITS = Object.freeze({ bytes: 10 * 1024 * 1024, lines: 100_000, lineBytes: 64 * 1024, analysisMs: 30_000, compareMs: 60_000 });
export type IntakeMode = "explain" | "review" | "compare";
export type InputMetadata = {
  completeness: "entire" | "fragment" | "unknown";
  scope: "device" | "global" | "vdom" | "context" | "unknown";
  scopeName: string;
  defaults: "included" | "omitted" | "unknown";
  deviceAlias: string;
  model: string;
  purpose: "production" | "access" | "core" | "edge" | "monitor" | "unknown";
};
export const DEFAULT_INPUT_METADATA: InputMetadata = { completeness: "unknown", scope: "unknown", scopeName: "", defaults: "unknown", deviceAlias: "", model: "", purpose: "unknown" };
export type IntakeIssue = { code: string; level: "blocked" | "limited" | "notice"; message: string; lines: number[] };
export type IntakeResult = {
  state: "ready" | "limited" | "preview" | "blocked";
  bytes: number; physicalLines: number; encoding: string;
  detectedVersion: string; declaredVersion: string; support: "primary" | "compatibility" | "preview" | "unknown";
  detectedVendor: "Cisco" | "Fortinet" | "Mixed" | "Unknown"; detectedModel: string;
  metadata: InputMetadata; issues: IntakeIssue[];
};
const encoder = new TextEncoder();

// Controlled diagnostics contain counts and line numbers, never input values.
export class InputValidationError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = "InputValidationError"; }
}
export function validateFileSize(size: number) {
  if (!Number.isSafeInteger(size) || size < 0 || size > INPUT_LIMITS.bytes) throw new InputValidationError("file-size", `Selected file size (${size.toLocaleString()} bytes) exceeds the 10 MiB limit (${INPUT_LIMITS.bytes.toLocaleString()} bytes), or is invalid. No input was truncated.`);
  if (!size) throw new InputValidationError("empty", "The selected file is empty. Choose a plaintext configuration export.");
}

export async function readConfigurationFile(file: Pick<File, "size" | "stream">, progress?: (completed: number, total: number) => void) {
  validateFileSize(file.size);
  const reader = file.stream().getReader();
  const chunks: string[] = [];
  let decoder: TextDecoder | undefined, encoding = "UTF-8", prefix = new Uint8Array(0), received = 0, decodedBytes = 0;
  const append = (text: string) => {
    decodedBytes += encoder.encode(text).byteLength;
    if (decodedBytes > INPUT_LIMITS.bytes) throw new InputValidationError("decoded-size", "Decoded text exceeds 10 MiB. Export a smaller assessment scope; no input was truncated.");
    chunks.push(text);
  };
  const start = (bytes: Uint8Array) => {
    if (bytes[0] === 0xff && bytes[1] === 0xfe && bytes[2] === 0 && bytes[3] === 0 || bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 0xfe && bytes[3] === 0xff) throw new InputValidationError("encoding", "UTF-32 is not supported. Export UTF-8 or BOM-identified UTF-16 text.");
    encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "UTF-16 LE" : bytes[0] === 0xfe && bytes[1] === 0xff ? "UTF-16 BE" : "UTF-8";
    decoder = new TextDecoder(encoding === "UTF-16 LE" ? "utf-16le" : encoding === "UTF-16 BE" ? "utf-16be" : "utf-8", { fatal: true });
    append(decoder.decode(bytes, { stream: true }));
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > INPUT_LIMITS.bytes || received > file.size) throw new InputValidationError("file-size", "The file stream exceeds its declared size or the 10 MiB limit. No input was truncated.");
      if (!decoder) {
        const joined = new Uint8Array(prefix.length + value.length); joined.set(prefix); joined.set(value, prefix.length); prefix = joined;
        if (prefix.length >= 4) { start(prefix); prefix = new Uint8Array(0); }
      } else append(decoder.decode(value, { stream: true }));
      progress?.(received, file.size);
    }
    if (!decoder) start(prefix);
    append(decoder!.decode());
    if (received !== file.size) throw new InputValidationError("file-size", "The file stream ended before its declared size. Select the complete export again.");
    return { text: chunks.join(""), encoding };
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (error instanceof InputValidationError) throw error;
    throw new InputValidationError("encoding", "This file is not readable UTF-8 or BOM-identified UTF-16 text. Export a plaintext configuration; malformed bytes are never replaced.");
  } finally { reader.releaseLock(); }
}

export function validateTextLimits(input: string) {
  if (!input.trim()) throw new InputValidationError("empty", "Add a plaintext configuration first.");
  // Unpaired UTF-16 surrogates would otherwise be silently replaced by TextEncoder.
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(input)) throw new InputValidationError("encoding", "The pasted text contains malformed Unicode. Paste a valid UTF-8 plaintext export.");
  const bytes = encoder.encode(input).byteLength;
  if (bytes > INPUT_LIMITS.bytes) throw new InputValidationError("decoded-size", "Text exceeds the 10 MiB limit. No input was truncated.");
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  if (lines.length > INPUT_LIMITS.lines) throw new InputValidationError("line-count", `Input contains ${lines.length.toLocaleString()} physical lines; the limit is 100,000. Blank lines count toward this limit.`);
  for (let i = 0; i < lines.length; i++) if (encoder.encode(lines[i]).byteLength > INPUT_LIMITS.lineBytes) throw new InputValidationError("line-length", `Line ${i + 1} exceeds the 64 KiB line limit. It was not wrapped or truncated.`);
  return { text, lines, bytes };
}

function supportFor(profileId: string, version: string): IntakeResult["support"] {
  const [major, minor] = version.match(/\d+/g)?.map(Number) || [];
  if (major === undefined || minor === undefined) return "unknown";
  if (profileId.startsWith("forti")) return major === 8 && minor === 0 ? "preview" : major === 7 && [4, 6].includes(minor) ? "primary" : major === 7 && minor === 2 ? "compatibility" : "unknown";
  if (["cisco-router", "cisco-switch"].includes(profileId)) return major === 17 && [12, 15, 18].includes(minor) ? "primary" : major === 15 || major === 16 && minor === 12 || major === 17 && minor === 9 ? "compatibility" : "unknown";
  if (profileId === "cisco-nexus") return major === 10 && [4, 5, 6].includes(minor) ? "primary" : major === 10 && minor === 3 || major === 9 && minor === 3 ? "compatibility" : "unknown";
  if (profileId === "cisco-asa") return major === 9 && [18, 20, 22].includes(minor) ? "primary" : major === 9 && minor === 16 ? "compatibility" : "unknown";
  if (profileId === "cisco-ftd") return major === 7 && [4, 6].includes(minor) || major === 10 && minor === 0 ? "primary" : "compatibility";
  return "unknown";
}

function detectedVersion(lines: string[]) {
  for (const line of lines) {
    const match = line.match(/^(?:version\s+|(?:ASA|NGFW|FTD) Version\s+|!\s*(?:NXOS:\s*version|Software Version:)\s*|#config-version=[\w-]+-|#\s*(?:FortiOS|FortiWeb|FortiSwitchOS)\s+v?)(\d+\.\d+(?:[.()][\w.()]+)?)/i);
    if (match) return match[1].replace(/-.*$/, "");
  }
  return "";
}

export function configurationCommandLines(lines: string[], vendor: "cisco" | "fortinet") {
  let commands = lines.map((text, i) => ({ text, line: i + 1 }));
  if (vendor === "fortinet") return { commands: [...fortinetCommandRanges(lines)].map(range => ({ text: lines[range.start], line: range.start + 1 })), incompleteOpaque: false };
  let delimiter = "", pem = false;
  commands = commands.filter(command => {
    const text = command.text;
    if (/-----BEGIN .*?(?:KEY|CERTIFICATE)/i.test(text)) pem = true;
    if (pem) { if (/-----END .*?(?:KEY|CERTIFICATE)/i.test(text)) pem = false; return false; }
    const banner = text.match(/^\s*banner\s+\S+\s+(\^C|\S)/i);
    if (banner) { delimiter = banner[1]; if (text.slice(text.indexOf(delimiter) + delimiter.length).includes(delimiter)) delimiter = ""; return false; }
    if (delimiter) { if (text.includes(delimiter)) delimiter = ""; return false; }
    return true;
  });
  return { commands, incompleteOpaque: !!delimiter || pem };
}

export function inspectConfiguration(input: string, selection: Selection, metadata: InputMetadata, encoding = "Pasted text"): IntakeResult {
  const { lines, bytes } = validateTextLimits(input);
  const profile = getProfile(selection.profileId);
  if (!profile) throw new InputValidationError("profile", "Select one of the eight supported device profiles.");
  if (!["entire", "fragment", "unknown"].includes(metadata.completeness) || !["device", "global", "vdom", "context", "unknown"].includes(metadata.scope) || !["included", "omitted", "unknown"].includes(metadata.defaults) || !["production", "access", "core", "edge", "monitor", "unknown"].includes(metadata.purpose)) throw new InputValidationError("metadata", "Choose valid completeness, scope, default visibility and device purpose values.");
  if ([metadata.deviceAlias, metadata.model, metadata.scopeName].some(value => typeof value !== "string" || value.length > 80 || /[\r\n\x00-\x1f]/.test(value))) throw new InputValidationError("metadata", "Device aliases, model labels and scope names must be single-line values of at most 80 characters.");
  const issues: IntakeIssue[] = [];
  const add = (code: string, level: IntakeIssue["level"], message: string, positions: number[] = []) => issues.push({ code, level, message, lines: positions });
  if (encoding.startsWith("UTF-16")) add("transcoded", "notice", "BOM-identified UTF-16 was decoded locally. Source line numbers are preserved.");
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffd]/.test(input)) add("binary", "blocked", "Control characters, replacement characters or terminal escape sequences prevent reliable interpretation. Supply a clean plaintext export.");
  const firstLine = lines.find(line => line.trim()) || "";
  if (/^\s*(?:<|\{|\[|---\s*$)/.test(firstLine) && !/^\s*\[MASKED:/.test(firstLine) || /^%PDF-|^PK\x03\x04|^\s*#!\//.test(input)) add("container", "blocked", "This is not a supported plaintext CLI export. Documents, archives, scripts and controller JSON/XML/YAML need a different input format.");
  if (/^#(?:encrypted|enc-config)|^\s*-----BEGIN (?:ENCRYPTED|PGP) /im.test(input)) add("encrypted", "blocked", "Encrypted backups are not supported. Select a password-masked plaintext export.");

  // Only examine command boundaries: text inside a Fortinet quoted payload is not CLI.
  let commands: { text: string; line: number }[] = [];
  try {
    const scanned = configurationCommandLines(lines, profile.vendor);
    commands = scanned.commands.filter(command => !/^\s*(?:description\b|(?:set|append)\s+(?:alias|comment|comments|description|buffer|script|certificate)\b)/i.test(command.text));
    if (scanned.incompleteOpaque) add("opaque-block", "blocked", "A banner or embedded key/certificate block is unfinished. Supply the complete block.");
  } catch { add("unterminated", "blocked", "A Fortinet quoted value or line continuation is unfinished. Include the complete value before analysis."); }
  const fortinet = commands.some(c => /^\s*config (?:system|switch|firewall|vpn|router|server-policy|global|vdom)\b/.test(c.text));
  const cisco = commands.some(c => /^(?:hostname |version \d|interface |ASA Version|NGFW Version|FTD Version)/.test(c.text));
  if (fortinet && cisco || profile.vendor === "cisco" && fortinet || profile.vendor === "fortinet" && cisco) add("vendor", "blocked", "The selected vendor disagrees with the export, or multiple vendor exports were combined. Use one device per input.");
  const joined = commands.map(c => c.text).join("\n");
  const detectedVendor = fortinet && cisco ? "Mixed" : fortinet ? "Fortinet" : cisco ? "Cisco" : "Unknown";
  const modelHeader = joined.match(/^\s*[!#:]?\s*(?:Model(?: number)?|Hardware)\s*:\s*([A-Za-z][A-Za-z0-9_.\/-]{0,79})(?=[,\s]|$)/im)?.[1];
  const fortinetModel = joined.match(/^#config-version=([A-Za-z][A-Za-z0-9_-]{0,79}?)-\d+\.\d+/m)?.[1];
  const detectedModel = modelHeader || fortinetModel || "";
  if (detectedModel && metadata.model.trim() && detectedModel.toLowerCase() !== metadata.model.trim().toLowerCase()) add("model-mismatch", "limited", "The header model differs from the declared model label. Verify the hardware identity; model-dependent checks remain unknown.");
  if (/^\s*config server-policy\b/m.test(joined) && profile.dialect !== "fortiweb" || /^\s*config (?:firewall policy|vpn ipsec)\b/m.test(joined) && profile.dialect === "fortiweb" || /^(?:NGFW|FTD) Version/m.test(joined) && profile.dialect !== "ftd" || /^ASA Version/m.test(joined) && profile.dialect !== "asa" || /^!?\s*NXOS:\s*version|^version \d+\.\d+\(\d+\).*N\d/m.test(joined) && profile.dialect !== "nxos") add("family", "blocked", "The export identifies a different device family. Select the matching profile before assessment.");
  if (!fortinet && !cisco && !/^\s*(?:line |ip |ipv6 |access-list |set |config |router |vlan |feature |ssh |http |nat )/m.test(joined)) add("syntax", "blocked", "No recognizable supported CLI configuration structure was found.");
  const hostnames = commands.filter(c => /^hostname\s+/.test(c.text));
  if (new Set(hostnames.map(c => c.text.trim())).size > 1) add("devices", "blocked", "Multiple device hostname declarations were found. Split the capture into individual device configurations.", hostnames.map(c => c.line));
  const captures = commands.filter(c => /^\S+[>#]\s*(?:show|sh)\s+(?:running-config|startup-config|run|start|full-configuration)\b/.test(c.text));
  const exportHeaders = commands.filter(c => /^#config-version=|^version \d|^(?:ASA|NGFW|FTD) Version/.test(c.text));
  if (captures.length > 1 || exportHeaders.length > 1) add("captures", "blocked", "Multiple configuration captures were found. Keep one configuration state in each input.", (captures.length > 1 ? captures : exportHeaders).map(c => c.line));
  if (captures.some(c => /\|/.test(c.text))) add("filtered-capture", "limited", "A filtered capture command was detected. Its missing sections cannot establish absent settings, even when the input is declared complete.");
  const damaged = commands.filter(c => !/^\s*[!#:]/.test(c.text) && /--More--|\[--More--\]|^\s*%\w+-\d+-|^\s*% (?:Invalid|Error|Incomplete)|^\s*\^\s*$/.test(c.text));
  if (damaged.length) add("capture-damage", "blocked", "Pagination, interleaved diagnostics or terminal errors make this capture ambiguous. Export clean text without wrapping or pagination.", damaged.map(c => c.line));
  if (profile.id === "cisco-asa" && /^\s*(?:context |changeto context |mode multiple)/m.test(joined)) add("asa-context", "limited", "ASA multi-context/system configuration is not a complete single security context. Analyze individual context exports separately.");
  if (profile.id === "fortiswitch" && /^\s*config switch-controller\b|^\s*set (?:switch-mgmt-mode|fortilink)\s+(?:fortilink|enable)/m.test(joined)) add("managed-switch", "blocked", "This input describes FortiLink/controller-managed configuration. The selected profile covers standalone FortiSwitch only.");
  if (metadata.completeness !== "entire") add("completeness", "limited", "Capture completeness is partial or unknown. Absent settings cannot establish missing controls.");
  else add("declared-complete", "notice", "Entire export is operator-declared. Structural validation cannot independently prove that every device section was captured.");
  if (metadata.scope === "unknown") add("scope", "limited", "Confirm whether this export covers the device, global configuration, a VDOM or one security context.");
  if (["vdom", "context"].includes(metadata.scope) && !metadata.scopeName.trim()) add("scope-name", "limited", "Identify the named VDOM or security context. Its identity is operator-declared and must match the export.");
  if (!metadata.model.trim()) add("model", "limited", "The model is unspecified. Model-dependent capabilities remain unknown.");
  if (metadata.defaults === "unknown") add("defaults", "limited", "Default-setting visibility is unknown. Only explicit settings and validated release defaults can be assessed.");
  if (selection.configType === "unknown") add("config-state", "limited", "Identify running, saved/startup or candidate configuration. This input does not establish active device state.");
  if (profile.id === "cisco-ftd") add("ftd-partial", "limited", "FTD diagnostic CLI is partial even when fully captured. FMC/FDM policy is authoritative; no full-device security Pass is available.");
  const detected = detectedVersion(commands.map(command => command.text)), declared = selection.build.trim();
  if (declared && !/^\d+\.\d+(?:[.()][\w.() -]+)?$/.test(declared)) add("version-format", "blocked", "Use a numeric software version/build, for example 17.15.4, 9.20(4) or 7.6.4. Leave unavailable information empty.");
  const selectedTrain = selection.version.match(/\d+(?:\.\d+)?/)?.[0];
  const detectedParts = detected.match(/\d+|[a-z]+/gi) || [], declaredParts = declared.match(/\d+|[a-z]+/gi) || [];
  if (detected && declared && detectedParts.slice(0, Math.min(detectedParts.length, declaredParts.length)).some((part, index) => part !== declaredParts[index])) add("version-mismatch", "blocked", "The detected software version disagrees with the declared exact version. Resolve this before version-dependent analysis.");
  const identified = detected || declared;
  if (identified && selectedTrain && !identified.startsWith(`${selectedTrain}.`) && identified !== selectedTrain && !identified.startsWith(`${selectedTrain}(`)) add("train-mismatch", "blocked", "The identified version disagrees with the selected OS train. Choose the matching train.");
  const support = supportFor(profile.id, detected || declared || selection.version);
  if (!detected && !declared) add("version", "limited", "No exact version/build was supplied or detected. Release-dependent behaviour remains unknown.");
  else if (((declared || detected).match(/\d+/g) || []).length < 3) add("patch", "limited", "Only a release train is identified. Supply the maintenance release/build for patch-dependent assessment.");
  if (support === "compatibility") add("compatibility", "limited", "This release has compatibility coverage. Common explicit settings can be interpreted; a full-profile security Pass is unavailable.");
  if (support === "unknown") add("release", "limited", "This exact release is outside the primary Release 1 coverage, or cannot be identified. Unsupported semantics remain unknown.");
  if (support === "preview") add("preview", "notice", "Fortinet 8.0 is preview-only in Release 1. No overall security baseline verdict is issued.");
  return { state: issues.some(i => i.level === "blocked") ? "blocked" : support === "preview" ? "preview" : issues.some(i => i.level === "limited") ? "limited" : "ready", bytes, physicalLines: lines.length, encoding, detectedVersion: detected, declaredVersion: declared, detectedVendor, detectedModel, support, metadata: { ...metadata }, issues };
}

export function validateComparison(before: { selection: Selection; metadata: InputMetadata }, after: { selection: Selection; metadata: InputMetadata }): IntakeIssue[] {
  const issues: IntakeIssue[] = [];
  if (before.selection.profileId !== after.selection.profileId) issues.push({ code: "compare-profile", level: "blocked", message: "Semantic comparison requires the same device profile on both sides.", lines: [] });
  if (!before.metadata.deviceAlias.trim() || !after.metadata.deviceAlias.trim() || before.metadata.deviceAlias.trim() !== after.metadata.deviceAlias.trim()) issues.push({ code: "compare-device", level: "blocked", message: "Confirm the same device alias on Before and After. Device identity is operator-declared, not independently verified.", lines: [] });
  if (before.metadata.scope !== after.metadata.scope) issues.push({ code: "compare-scope", level: "blocked", message: "Before and After must cover the same administrative scope.", lines: [] });
  if (["vdom", "context"].includes(before.metadata.scope) && before.metadata.scopeName.trim() !== after.metadata.scopeName.trim()) issues.push({ code: "compare-context", level: "blocked", message: "Before and After identify different VDOMs or security contexts. Keep the same named scope on both sides.", lines: [] });
  if (before.selection.configType !== after.selection.configType) issues.push({ code: "compare-state", level: "notice", message: "Before and After use different configuration states. A difference does not establish a deployed device change.", lines: [] });
  return issues;
}
