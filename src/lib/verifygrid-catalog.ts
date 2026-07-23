export const verifyGridConnectors = [
  "nmap_xml",
  "nessus_xml",
  "burp_xml",
  "qualys_csv",
  "rapid7_csv",
  "greenbone_csv",
  "tenable_api",
  "qualys_api",
  "rapid7_api",
  "greenbone_api",
  "normalized_json"
] as const;

export type VerifyGridConnector = typeof verifyGridConnectors[number];

export const connectorCatalog: Record<VerifyGridConnector, { label: string; format: string; accepted: string; directImport: boolean }> = {
  nmap_xml: { label: "Nmap XML", format: "xml", accepted: ".xml", directImport: true },
  nessus_xml: { label: "Tenable Nessus XML", format: "xml", accepted: ".nessus,.xml", directImport: true },
  burp_xml: { label: "Burp issue XML", format: "xml", accepted: ".xml", directImport: true },
  qualys_csv: { label: "Qualys VMDR CSV", format: "csv", accepted: ".csv", directImport: true },
  rapid7_csv: { label: "Rapid7 InsightVM CSV", format: "csv", accepted: ".csv", directImport: true },
  greenbone_csv: { label: "Greenbone CSV", format: "csv", accepted: ".csv", directImport: true },
  tenable_api: { label: "Tenable API", format: "json", accepted: ".json", directImport: false },
  qualys_api: { label: "Qualys API", format: "json", accepted: ".json", directImport: false },
  rapid7_api: { label: "Rapid7 sensor API", format: "json", accepted: ".json", directImport: false },
  greenbone_api: { label: "Greenbone sensor API", format: "json", accepted: ".json", directImport: false },
  normalized_json: { label: "VerifyGrid normalized JSON", format: "json", accepted: ".json", directImport: true }
};

export const verifyGridCapabilities = [
  "asset_inventory",
  "dns_posture",
  "tls_posture",
  "tcp_service_validation",
  "http_security_headers",
  "network_service_scan",
  "web_passive_scan",
  "template_vulnerability_scan",
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
  sensorDispatch: boolean;
}> = {
  asset_inventory: { label: "Asset inventory reconciliation", level: "observe", description: "Reconcile responding assets and approved identifiers without vulnerability exploitation.", humanApprovalRequired: false, sensorDispatch: true },
  dns_posture: { label: "DNS posture validation", level: "observe", description: "Validate public DNS, delegation, DNSSEC, and mail authentication records.", humanApprovalRequired: false, sensorDispatch: true },
  tls_posture: { label: "TLS posture validation", level: "safe_checks", description: "Inspect certificates, supported protocol posture, and externally visible TLS configuration.", humanApprovalRequired: false, sensorDispatch: true },
  tcp_service_validation: { label: "TCP service validation", level: "safe_checks", description: "Confirm explicitly scoped listening services under the engagement request ceiling.", humanApprovalRequired: false, sensorDispatch: true },
  http_security_headers: { label: "HTTP security header validation", level: "safe_checks", description: "Inspect approved HTTP endpoints using idempotent requests and bounded redirects.", humanApprovalRequired: false, sensorDispatch: true },
  network_service_scan: { label: "Nmap safe service assessment", level: "controlled_validation", description: "Run bounded TCP connect, light version detection, and Nmap safe-category scripts against explicit authorized hosts.", humanApprovalRequired: true, sensorDispatch: true },
  web_passive_scan: { label: "OWASP ZAP baseline assessment", level: "safe_checks", description: "Spider an explicit authorized web origin and collect passive ZAP alerts without active attacks.", humanApprovalRequired: false, sensorDispatch: true },
  template_vulnerability_scan: { label: "Bounded Nuclei vulnerability assessment", level: "controlled_validation", description: "Run rate-limited signed templates while excluding fuzzing, denial-of-service, brute-force, code, headless, and out-of-band checks.", humanApprovalRequired: true, sensorDispatch: true },
  configuration_analysis: { label: "Configuration evidence analysis", level: "manual_only", description: "Record an offline review of sanitized configuration evidence; no network action is dispatched.", humanApprovalRequired: true, sensorDispatch: false },
  controlled_exploit_validation: { label: "Controlled exploit validation", level: "controlled_validation", description: "Record separately supervised validation evidence. Autonomous exploitation, persistence, credential harvesting, and destructive actions remain prohibited.", humanApprovalRequired: true, sensorDispatch: false }
};
