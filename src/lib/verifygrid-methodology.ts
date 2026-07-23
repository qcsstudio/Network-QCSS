import type { Prisma } from "@prisma/client";
import { z } from "zod";

const allServices = [
  "external_network_vapt",
  "internal_network_vapt",
  "firewall_assurance",
  "cloud_network_assurance",
  "wireless_assessment",
  "configuration_assurance",
  "continuous_validation",
  "web_and_api_vapt"
] as const;

type ServiceType = typeof allServices[number];
type MethodologyCase = {
  code: string;
  standardRef: string;
  category: string;
  title: string;
  objective: string;
  executionMode: "automated" | "analyst";
  capability?: string;
  services: readonly ServiceType[];
};

const networkServices: readonly ServiceType[] = ["external_network_vapt", "internal_network_vapt", "firewall_assurance", "continuous_validation"];
const webServices: readonly ServiceType[] = ["web_and_api_vapt", "continuous_validation"];
const catalog: MethodologyCase[] = [
  { code: "NIST-PLAN-01", standardRef: "NIST SP 800-115 Planning", category: "Governance", title: "Scope, ownership, exclusions, and rules review", objective: "Confirm accountable authority, exact targets, prohibited actions, source addresses, stop conditions, and the operating window before testing.", executionMode: "analyst", services: allServices },
  { code: "NIST-DISC-01", standardRef: "NIST SP 800-115 Discovery", category: "Discovery", title: "Authorized asset identity reconciliation", objective: "Reconcile explicit target identities and responding addresses without expanding the approved scope.", executionMode: "automated", capability: "asset_inventory", services: allServices },
  { code: "NIST-ANLY-01", standardRef: "NIST SP 800-115 Analysis", category: "Analysis", title: "Analyst validation and false-positive review", objective: "Validate scanner observations against asset ownership, exposure, compensating controls, and business context before reporting a finding.", executionMode: "analyst", services: allServices },
  { code: "NIST-RPRT-01", standardRef: "NIST SP 800-115 Reporting", category: "Reporting", title: "Evidence, impact, remediation, and retest traceability", objective: "Ensure each material finding has reproducible evidence, business impact, an accountable remediation owner, and a closure test.", executionMode: "analyst", services: allServices },
  { code: "NET-DNS-01", standardRef: "NIST SP 800-115 Discovery", category: "Network exposure", title: "DNS and domain control posture", objective: "Review delegation, mail authentication, CAA, and authoritative DNS signals for the explicit domain scope.", executionMode: "automated", capability: "dns_posture", services: networkServices },
  { code: "NET-SVC-01", standardRef: "NIST SP 800-115 Network Discovery", category: "Network exposure", title: "Listening service and version assessment", objective: "Identify exposed TCP services and light product versions using bounded connect scanning and safe scripts.", executionMode: "automated", capability: "network_service_scan", services: networkServices },
  { code: "NET-TLS-01", standardRef: "NIST SP 800-52r2", category: "Transport security", title: "TLS certificate and negotiated protocol posture", objective: "Validate trust, hostname, expiry, negotiated protocol, and cipher evidence on approved TLS endpoints.", executionMode: "automated", capability: "tls_posture", services: networkServices },
  { code: "NET-VULN-01", standardRef: "NIST SP 800-115 Vulnerability Scanning", category: "Vulnerability validation", title: "Bounded signed-template vulnerability assessment", objective: "Run approved signed templates with strict rate, protocol, and unsafe-category exclusions, then validate every match manually.", executionMode: "automated", capability: "template_vulnerability_scan", services: networkServices },
  { code: "NET-SEGM-01", standardRef: "NIST SP 800-115 Penetration Testing", category: "Network controls", title: "Segmentation and trust-path validation", objective: "Validate whether approved source zones can reach prohibited management, data, or control-plane destinations.", executionMode: "analyst", services: ["internal_network_vapt", "firewall_assurance"] },
  { code: "NET-ADMIN-01", standardRef: "CIS Controls v8 4, 5, 6", category: "Management plane", title: "Administrative access and AAA review", objective: "Review management exposure, strong authentication, authorization, session controls, logging, and emergency access handling.", executionMode: "analyst", services: networkServices },
  { code: "FW-RULE-01", standardRef: "NIST SP 800-41r1", category: "Firewall assurance", title: "Rulebase, NAT, VPN, and logging review", objective: "Trace business intent to rules, remove shadowed or obsolete access, verify NAT/VPN boundaries, and confirm useful logging.", executionMode: "analyst", services: ["firewall_assurance", "configuration_assurance"] },
  { code: "WSTG-INFO-04", standardRef: "OWASP WSTG v4.2 INFO-04", category: "Web discovery", title: "Web attack-surface identification", objective: "Identify application entry points, technologies, virtual hosts, exposed files, and externally reachable interfaces within scope.", executionMode: "analyst", services: webServices },
  { code: "WSTG-CONF-06", standardRef: "OWASP WSTG v4.2 CONF-06", category: "Web configuration", title: "HTTP methods and deployment posture", objective: "Review allowed methods, redirects, headers, platform disclosure, and deployment controls using passive evidence first.", executionMode: "automated", capability: "web_passive_scan", services: webServices },
  { code: "WSTG-ATHN-01", standardRef: "OWASP WSTG v4.2 ATHN", category: "Authentication", title: "Authentication and account lifecycle testing", objective: "Test enrollment, login, MFA, recovery, lockout, alternate channels, and credential transport against approved test accounts.", executionMode: "analyst", services: webServices },
  { code: "WSTG-ATHZ-01", standardRef: "OWASP WSTG v4.2 ATHZ", category: "Authorization", title: "Horizontal and vertical authorization testing", objective: "Validate object, function, tenant, and administrative authorization boundaries using approved roles and data.", executionMode: "analyst", services: webServices },
  { code: "WSTG-SESS-01", standardRef: "OWASP WSTG v4.2 SESS", category: "Session management", title: "Session, token, CSRF, and logout testing", objective: "Test session creation, rotation, expiry, concurrent use, cookie attributes, token handling, CSRF, and logout invalidation.", executionMode: "analyst", services: webServices },
  { code: "WSTG-INPV-01", standardRef: "OWASP WSTG v4.2 INPV", category: "Input validation", title: "Injection and server-side input validation testing", objective: "Test documented input boundaries for injection classes using controlled non-destructive payloads and stop conditions.", executionMode: "analyst", services: webServices },
  { code: "WSTG-API-01", standardRef: "OWASP WSTG API Testing", category: "API security", title: "API inventory, object authorization, and data exposure", objective: "Test API discovery, object-level authorization, field exposure, mass assignment, rate controls, and schema enforcement.", executionMode: "analyst", services: webServices },
  { code: "CLOUD-NET-01", standardRef: "CIS Cloud Foundations", category: "Cloud network", title: "Cloud perimeter, routing, and security policy review", objective: "Review VPC/VNet topology, routes, gateways, public addresses, peering, security groups, firewalls, and hybrid connectivity.", executionMode: "analyst", services: ["cloud_network_assurance"] },
  { code: "CLOUD-ID-01", standardRef: "CIS Controls v8 5, 6", category: "Cloud identity", title: "Cloud network administration identity review", objective: "Review privileged identities, service principals, conditional access, role assignment, and network-control change authority.", executionMode: "analyst", services: ["cloud_network_assurance"] },
  { code: "WIFI-01", standardRef: "NIST SP 800-153", category: "Wireless", title: "Wireless encryption, authentication, isolation, and rogue exposure", objective: "Review approved SSIDs, encryption and identity controls, client isolation, guest boundaries, management access, and rogue indicators.", executionMode: "analyst", services: ["wireless_assessment"] },
  { code: "CFG-HARD-01", standardRef: "CIS Benchmarks", category: "Configuration", title: "Network device hardening and logging review", objective: "Review sanitized configuration evidence for secure management protocols, AAA, secrets handling, services, time, logging, and supported software.", executionMode: "analyst", capability: "configuration_analysis", services: ["configuration_assurance", "firewall_assurance", "internal_network_vapt"] }
];

export const testCaseUpdateSchema = z.object({
  status: z.enum(["planned", "running", "passed", "finding", "not_applicable"]),
  resultSummary: z.string().trim().max(4000).optional().default(""),
  assignedTo: z.string().trim().max(160).optional().default("")
}).superRefine((value, context) => {
  if (["passed", "finding", "not_applicable"].includes(value.status) && value.resultSummary.length < 20) {
    context.addIssue({ code: "custom", path: ["resultSummary"], message: "Completed test cases require a result summary of at least 20 characters." });
  }
});

export function methodologyForService(serviceType: string) {
  return catalog.filter((item) => item.services.includes(serviceType as ServiceType)).map((item) => ({
    code: item.code,
    standardRef: item.standardRef,
    category: item.category,
    title: item.title,
    objective: item.objective,
    executionMode: item.executionMode,
    capability: item.capability
  }));
}

export async function seedVerifyGridTestPlan(tx: Prisma.TransactionClient, engagementId: string, serviceType: string) {
  const cases = methodologyForService(serviceType);
  if (!cases.length) return 0;
  const created = await tx.verifyGridTestCase.createMany({
    data: cases.map((item) => ({ engagementId, ...item, capability: item.capability || null })),
    skipDuplicates: true
  });
  return created.count;
}
