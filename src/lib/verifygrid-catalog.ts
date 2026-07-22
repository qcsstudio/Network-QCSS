export const verifyGridConnectors = [
  "nmap_xml",
  "nessus_xml",
  "burp_xml",
  "qualys_csv",
  "rapid7_csv",
  "greenbone_csv",
  "normalized_json"
] as const;

export type VerifyGridConnector = typeof verifyGridConnectors[number];

export const connectorCatalog: Record<VerifyGridConnector, { label: string; format: string; accepted: string }> = {
  nmap_xml: { label: "Nmap XML", format: "xml", accepted: ".xml" },
  nessus_xml: { label: "Tenable Nessus XML", format: "xml", accepted: ".nessus,.xml" },
  burp_xml: { label: "Burp issue XML", format: "xml", accepted: ".xml" },
  qualys_csv: { label: "Qualys VMDR CSV", format: "csv", accepted: ".csv" },
  rapid7_csv: { label: "Rapid7 InsightVM CSV", format: "csv", accepted: ".csv" },
  greenbone_csv: { label: "Greenbone CSV", format: "csv", accepted: ".csv" },
  normalized_json: { label: "VerifyGrid normalized JSON", format: "json", accepted: ".json" }
};

export const verifyGridCapabilities = [
  "asset_inventory",
  "dns_posture",
  "tls_posture",
  "tcp_service_validation",
  "http_security_headers",
  "configuration_analysis",
  "controlled_exploit_validation"
] as const;

export type VerifyGridCapability = typeof verifyGridCapabilities[number];
export type VerifyGridCapabilityLevel = "observe" | "safe_checks" | "controlled_validation" | "manual_only";

export const capabilityCatalog: Record<VerifyGridCapability, {
  label: string;
  level: VerifyGridCapabilityLevel;
  description: string;
  humanApprovalRequired: boolean;
}> = {
  asset_inventory: { label: "Asset inventory reconciliation", level: "observe", description: "Reconcile responding assets and approved identifiers without vulnerability exploitation.", humanApprovalRequired: false },
  dns_posture: { label: "DNS posture validation", level: "observe", description: "Validate public DNS, delegation, DNSSEC, and mail authentication records.", humanApprovalRequired: false },
  tls_posture: { label: "TLS posture validation", level: "safe_checks", description: "Inspect certificates, supported protocol posture, and externally visible TLS configuration.", humanApprovalRequired: false },
  tcp_service_validation: { label: "TCP service validation", level: "safe_checks", description: "Confirm explicitly scoped listening services under the engagement request ceiling.", humanApprovalRequired: false },
  http_security_headers: { label: "HTTP security header validation", level: "safe_checks", description: "Inspect approved HTTP endpoints using idempotent requests and bounded redirects.", humanApprovalRequired: false },
  configuration_analysis: { label: "Configuration evidence analysis", level: "manual_only", description: "Record an offline review of sanitized configuration evidence; no network action is dispatched.", humanApprovalRequired: true },
  controlled_exploit_validation: { label: "Controlled exploit validation", level: "controlled_validation", description: "Prepare a separately reviewed validation record. Automated dispatch remains disabled in this release.", humanApprovalRequired: true }
};
