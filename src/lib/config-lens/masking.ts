import { fortinetCommandRanges } from "./fortinet-syntax";

const maskedMarker = /^\s*\[MASKED: (?:sensitive or free-text line|banner content)\]\s*$/;
const maskedStructure = /^\s*(?:edit "\[MASKED: entry at line \d+\]"|config \[MASKED: section at line \d+\])\s*$/;

function sensitiveLine(line: string) {
  const trimmed = line.trim();
  return /\b(?:password|passwd|passwd-policy|secret|psksecret|psk|pre-shared-key|private-key|privatekey|auth-password|priv-password|auth-pwd|priv-pwd|passwd2|community|key-string|key-chain|api-key|api-token|access-token|token|ENC)\b/i.test(line)
    || /^(?:\s*(?:set\s+)?(?:key|auth|priv)\s|.*\b(?:authentication-key|authentication key|encryption-key|shared-secret|encrypted-password|key 6)\b)/i.test(line)
    || /\b(?:radius|tacacs|snmp-server user|username)\b/i.test(line) && /\b(?:key|auth|priv|user|username)\b/i.test(line)
    || /\bcrypto isakmp key\b|\bsnmp-server host\b|\b(?:authentication|authentication-key|authentication key)\b.*\b(?:md5|sha|key|text)\b/i.test(line)
    || /\b(?:description|comment|comments|banner|alias)\b/i.test(trimmed) || /^(?:!|#|:)/.test(trimmed)
    || /\b(?:https?|ssh|ftp):\/\/[^\s/@]+:[^\s/@]+@/i.test(line);
}

function maskFortinet(lines: string[]) {
  const masked = [...lines], maskedLines = new Set<number>(), structuralLines = new Set<number>();
  const sections: string[] = [];
  let pem = false;
  for (const { start, end } of fortinetCommandRanges(lines)) {
    const text = lines[start].trim();
    if (/^-----BEGIN .*?(?:KEY|CERTIFICATE)-----$/.test(text)) pem = true;
    const config = !pem && /^config\s+/.test(text), edit = !pem && /^edit\s+/.test(text);
    // Section keywords are not credential values (for example system password-policy).
    const sectionKeywords = start === end && /^config(?:\s+[\w-]+)+$/.test(text);
    const freeText = /^(?:set|append)\s+(?:buffer|script|certificate)\b/.test(text);
    const communityName = sections.at(-1) === "system snmp community" && /^(?:set|append)\s+name\b/.test(text);
    // These fixed BGP choices are route attributes, never SNMP community values.
    const routingCommunityChoice = start === end && sections.slice(-2).join(" ") === "router bgp neighbor"
      && /^(?:set send-community (?:standard|extended|both|disable)|unset send-community)$/.test(text);
    const hide = pem || start !== end || maskedMarker.test(text) || maskedStructure.test(text)
      || !sectionKeywords && !routingCommunityChoice && sensitiveLine(text) || freeText || communityName;
    if (hide) {
      for (let index = start; index <= end; index++) {
        const prefix = lines[index].match(/^\s*/)?.[0] || "";
        maskedLines.add(index + 1);
        if (index === start && (config || edit)) {
          structuralLines.add(index + 1);
          masked[index] = maskedStructure.test(text) ? lines[index] : `${prefix}${edit ? `edit "[MASKED: entry at line ${index + 1}]"` : `config [MASKED: section at line ${index + 1}]`}`;
        } else masked[index] = `${prefix}[MASKED: sensitive or free-text line]`;
      }
    }
    if (config) sections.push(masked[start].trim().slice(7).trim().replace(/\s+/g, " "));
    if (!pem && text === "end") sections.pop();
    if (/^-----END .*?(?:KEY|CERTIFICATE)-----$/.test(text)) pem = false;
  }
  return { lines: masked, maskedLines, structuralLines, count: maskedLines.size };
}

export function validateInput(input: string) {
  if (!input.trim()) throw new Error("Select a text configuration or paste its contents first.");
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffd]/.test(input)) throw new Error("Use a UTF-8 plain-text export, not an encrypted or binary backup.");
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const header = lines.slice(0, 3).filter(line => !maskedMarker.test(line)).join("\n");
  if (/^\s*(?:<|\{|\[|---\s*$)/m.test(header)) throw new Error("XML, JSON and YAML exports are not supported. Choose a plain-text CLI configuration.");
  return lines;
}

// Mask before parsing: labels, diagrams, diagnostics and downloads never receive secrets.
// Unknown/vendor-specific secrets can still exist; users must review the masked export.
export function maskConfiguration(input: string, vendor: "cisco" | "fortinet" = "cisco") {
  const lines = validateInput(input);
  if (vendor === "fortinet") return maskFortinet(lines);
  let pem = false, certificate = false, count = 0;
  const maskedLines = new Set<number>();
  const masked = lines.map((line, index) => {
    const trimmed = line.trim();
    let hide = maskedMarker.test(line);
    if (/-----BEGIN .*?(?:KEY|CERTIFICATE)/i.test(line)) pem = true;
    if (/^crypto (?:pki )?certificate chain\b/i.test(trimmed) || /^certificate (?:ca|self-signed|[0-9a-f]+)\b/i.test(trimmed)) certificate = true;
    if (pem || certificate) {
      hide = true;
      if (/-----END .*?(?:KEY|CERTIFICATE)/i.test(line)) pem = false;
      if (/^(?:quit|exit|!)$/.test(trimmed)) certificate = false;
    }
    if (sensitiveLine(line)) hide = true;
    if (!hide) return line;
    count++; maskedLines.add(index + 1);
    return `${line.match(/^\s*/)?.[0] || ""}[MASKED: sensitive or free-text line]`;
  });
  // Delimited Cisco banners may contain secrets on otherwise unrecognizable lines.
  let delimiter: string | null = null;
  lines.forEach((line, index) => {
    const start = line.match(/^\s*banner\s+\S+\s+(\^C|\S)/i);
    if (start) {
      delimiter = start[1];
      const rest = line.slice(line.indexOf(delimiter) + delimiter.length);
      if (rest.includes(delimiter)) delimiter = null;
    } else if (delimiter) {
      if (!maskedLines.has(index + 1)) { maskedLines.add(index + 1); count++; }
      masked[index] = "[MASKED: banner content]";
      if (line.includes(delimiter)) delimiter = null;
    }
  });
  return { lines: masked, maskedLines, structuralLines: new Set<number>(), count };
}
