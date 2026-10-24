export const MAX_BYTES = 512 * 1024;
export const MAX_LINES = 12000;
export const MAX_LINE_LENGTH = 2048;
const maskedMarker = /^\s*\[MASKED: (?:sensitive or free-text line|banner content)\]\s*$/;

export function validateInput(input: string) {
  if (!input.trim()) throw new Error("Select a text configuration or paste its contents first.");
  if (new TextEncoder().encode(input).length > MAX_BYTES) throw new Error("This version accepts up to 512 KiB per configuration.");
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffd]/.test(input)) throw new Error("Use a UTF-8 plain-text export, not an encrypted or binary backup.");
  const header = input.split(/\r?\n/).slice(0, 3).filter(line => !maskedMarker.test(line)).join("\n");
  if (/^\s*(?:<|\{|\[|---\s*$)/m.test(header)) throw new Error("XML, JSON and YAML exports are not supported. Choose a plain-text CLI configuration.");
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  if (lines.length > MAX_LINES || lines.some(line => line.length > MAX_LINE_LENGTH)) throw new Error("Configuration exceeds the 12,000-line or 2,048-character line limit. Use a smaller scoped export.");
  return lines;
}

// Mask before parsing: labels, diagrams, diagnostics and downloads never receive secrets.
// Unknown/vendor-specific secrets can still exist; users must review the masked export.
export function maskConfiguration(input: string) {
  const lines = validateInput(input);
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
    if (/\b(?:password|passwd|passwd-policy|secret|psksecret|psk|pre-shared-key|private-key|privatekey|auth-password|priv-password|auth-pwd|priv-pwd|passwd2|community|key-string|key-chain|api-key|api-token|access-token|token|ENC)\b/i.test(line)) hide = true;
    if (/^(?:\s*(?:set\s+)?(?:key|auth|priv)\s|.*\b(?:authentication-key|authentication key|encryption-key|shared-secret|encrypted-password|key 6)\b)/i.test(line)) hide = true;
    if (/\b(?:radius|tacacs|snmp-server user|username)\b/i.test(line) && /\b(?:key|auth|priv|user|username)\b/i.test(line)) hide = true;
    if (/\bcrypto isakmp key\b|\bsnmp-server host\b|\b(?:authentication|authentication-key|authentication key)\b.*\b(?:md5|sha|key|text)\b/i.test(line)) hide = true;
    if (/\b(?:description|comment|comments|banner|alias)\b/i.test(trimmed) || /^(?:!|#|:)/.test(trimmed)) hide = true;
    if (/\b(?:https?|ssh|ftp):\/\/[^\s/@]+:[^\s/@]+@/i.test(line)) hide = true;
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
  return { lines: masked, maskedLines, count };
}
