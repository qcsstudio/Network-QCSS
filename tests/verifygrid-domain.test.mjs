import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizationSchema,
  engagementTransition,
  findingRiskScore,
  scopeHash,
  scopeTargetSchema
} from "../src/lib/verifygrid-domain.ts";
import {
  parseScannerImport,
  reconcileObservationScope,
  severityMeetsMinimum
} from "../src/lib/verifygrid-import-domain.ts";
import {
  buildExecutionManifest,
  validateExecutionBoundary
} from "../src/lib/verifygrid-execution-domain.ts";
import {
  parseSensorToken,
  retryDelayMinutes,
  safeEqual,
  sensorCreateSchema,
  sensorToken,
  signSensorManifest,
  validateConnectorBaseUrl
} from "../src/lib/verifygrid-automation-domain.ts";
import { matchObservationToCpes } from "../src/lib/verifygrid-nvd.ts";
import {
  parseVerifyGridOnboardingToken,
  verifyGridOnboardingRequestSchema,
  verifyGridOnboardingReviewSchema
} from "../src/lib/verifygrid-onboarding-domain.ts";
import { methodologyForService, testCaseUpdateSchema } from "../src/lib/verifygrid-methodology.ts";
import {
  buildCustodyEventHash,
  buildReportChainHash,
  evaluateReportQuality,
  signReportChain,
  verifyReportChainSignature
} from "../src/lib/verifygrid-assurance-domain.ts";
import crypto from "node:crypto";

const firstTarget = {
  targetType: "domain",
  value: "example.com",
  environment: "production",
  criticality: "high",
  permission: "safe_checks",
  inScope: true,
  ownershipConfirmed: true
};

const exclusion = {
  targetType: "hostname",
  value: "payments.example.com",
  environment: "production",
  criticality: "critical",
  permission: "manual_only",
  inScope: false,
  ownershipConfirmed: false
};

test("scope hash is deterministic and order independent", () => {
  assert.equal(scopeHash([firstTarget, exclusion]), scopeHash([exclusion, firstTarget]));
});

test("scope hash changes when a testing permission changes", () => {
  const changed = { ...firstTarget, permission: "controlled_validation" };
  assert.notEqual(scopeHash([firstTarget, exclusion]), scopeHash([changed, exclusion]));
});

test("in-scope targets require ownership confirmation", () => {
  const result = scopeTargetSchema.safeParse({ ...firstTarget, ownershipConfirmed: false });
  assert.equal(result.success, false);
});

test("authorization windows are bounded and ordered", () => {
  const validFrom = new Date("2026-07-22T00:00:00.000Z");
  const valid = authorizationSchema.safeParse({
    approvedByName: "Authorized Owner",
    approvedByEmail: "owner@example.com",
    authorityConfirmed: true,
    validFrom,
    validUntil: new Date("2026-07-29T00:00:00.000Z")
  });
  const excessive = authorizationSchema.safeParse({
    approvedByName: "Authorized Owner",
    approvedByEmail: "owner@example.com",
    authorityConfirmed: true,
    validFrom,
    validUntil: new Date("2026-11-01T00:00:00.000Z")
  });
  assert.equal(valid.success, true);
  assert.equal(excessive.success, false);
});

test("engagement state machine blocks unsafe shortcuts", () => {
  assert.equal(engagementTransition("authorized", "start"), "active");
  assert.equal(engagementTransition("draft", "start"), null);
  assert.equal(engagementTransition("active", "close"), null);
  assert.equal(engagementTransition("remediation", "close"), "closed");
});

test("known exploitation materially raises risk priority", () => {
  const baseline = findingRiskScore({ severity: "high", knownExploited: false, epssScore: 0.1, confidence: "likely", assetCriticality: "high" });
  const exploited = findingRiskScore({ severity: "high", knownExploited: true, epssScore: 0.1, confidence: "likely", assetCriticality: "high" });
  assert.ok(exploited >= baseline + 18);
});

test("Nmap XML becomes bounded service observations", () => {
  const observations = parseScannerImport("nmap_xml", `<?xml version="1.0"?>
    <nmaprun scanner="nmap" startstr="2026-07-22T10:00:00Z">
      <host><status state="up"/><address addr="203.0.113.10" addrtype="ipv4"/>
        <hostnames><hostname name="edge.example.com"/></hostnames>
        <ports><port protocol="tcp" portid="443"><state state="open" reason="syn-ack"/><service name="https" product="nginx" version="1.26" method="probed" conf="10"/></port></ports>
      </host>
    </nmaprun>`);
  assert.equal(observations.length, 1);
  assert.equal(observations[0].assetIdentifier, "203.0.113.10");
  assert.equal(observations[0].port, 443);
  assert.equal(observations[0].severity, "informational");
  assert.match(observations[0].title, /https/i);
});

test("Nessus XML preserves vulnerability identity without raw file storage", () => {
  const observations = parseScannerImport("nessus_xml", `<?xml version="1.0"?>
    <NessusClientData_v2><Report name="QCS"><ReportHost name="edge.example.com">
      <HostProperties><tag name="host-ip">203.0.113.10</tag><tag name="host-fqdn">edge.example.com</tag></HostProperties>
      <ReportItem port="443" svc_name="https" protocol="tcp" severity="4" pluginID="12345" pluginName="Critical TLS issue" pluginFamily="General">
        <risk_factor>Critical</risk_factor><synopsis>A vulnerable TLS component is exposed.</synopsis>
        <description>The detected component is affected and requires validation.</description><solution>Upgrade to the vendor-supported fixed release.</solution>
        <cve>CVE-2026-12345</cve><cvss3_base_score>9.8</cvss3_base_score><plugin_output>Version evidence only.</plugin_output>
      </ReportItem>
    </ReportHost></Report></NessusClientData_v2>`);
  assert.equal(observations[0].severity, "critical");
  assert.equal(observations[0].advisoryExternalId, "CVE-2026-12345");
  assert.equal(observations[0].cvssScore, 9.8);
  assert.match(observations[0].sourceReference, /^nessus:/);
});

test("Burp XML maps issue confidence, location, and remediation", () => {
  const observations = parseScannerImport("burp_xml", `<?xml version="1.0"?>
    <issues burpVersion="2026"><issue><serialNumber>1001</serialNumber><type>2097936</type><name>Cleartext submission of password</name>
      <host ip="203.0.113.20">https://portal.example.com</host><path>/login</path><location>https://portal.example.com/login</location>
      <severity>High</severity><confidence>Certain</confidence><issueDetail>The login endpoint accepts a sensitive workflow without the expected transport control.</issueDetail>
      <remediationBackground>Require HTTPS and a modern TLS policy for the complete workflow.</remediationBackground>
    </issue></issues>`);
  assert.equal(observations[0].assetKind, "application");
  assert.equal(observations[0].severity, "high");
  assert.equal(observations[0].confidence, "validated");
  assert.match(observations[0].assetIdentifier, /^https:/);
});

test("vendor CSV aliases normalize into the same observation contract", () => {
  const observations = parseScannerImport("qualys_csv", `IP Address,QID,Title,Severity,CVE ID,CVSS Base Score,Solution,Port\n203.0.113.15,9001,Exposed management service,4,CVE-2026-5000,8.8,Restrict management access and patch the device,8443`);
  assert.equal(observations.length, 1);
  assert.equal(observations[0].assetIdentifier, "203.0.113.15");
  assert.equal(observations[0].severity, "critical");
  assert.equal(observations[0].port, 8443);
});

test("scanner XML with entity declarations is rejected", () => {
  assert.throws(() => parseScannerImport("nmap_xml", `<!DOCTYPE nmaprun [<!ENTITY secret SYSTEM "file:///etc/passwd">]><nmaprun>&secret;</nmaprun>`), /entity declarations/i);
});

test("scope reconciliation gives explicit exclusions priority", () => {
  const targets = [
    { id: "cidr", targetType: "cidr", value: "203.0.113.0/24", environment: "production", criticality: "high", permission: "safe_checks", inScope: true, ownershipConfirmed: true },
    { id: "exclude", targetType: "ip", value: "203.0.113.10", environment: "production", criticality: "critical", permission: "manual_only", inScope: false, ownershipConfirmed: false }
  ];
  assert.equal(reconcileObservationScope("203.0.113.10", targets).disposition, "out_of_scope");
  assert.equal(reconcileObservationScope("203.0.113.11", targets).disposition, "in_scope");
  assert.equal(reconcileObservationScope("198.51.100.9", targets).disposition, "unmatched");
});

test("severity promotion policy excludes informational noise by default", () => {
  assert.equal(severityMeetsMinimum("medium", "low"), true);
  assert.equal(severityMeetsMinimum("informational", "low"), false);
});

test("execution boundary enforces authorization, mode, and target permission", () => {
  const now = new Date("2026-07-22T10:00:00.000Z");
  const authorization = { id: "auth", status: "active", scopeHash: "scope", validFrom: new Date("2026-07-22T09:00:00.000Z"), validUntil: new Date("2026-07-22T18:00:00.000Z"), authorityConfirmed: true };
  const targets = [{ ...firstTarget, id: "target" }];
  const safe = validateExecutionBoundary({ engagementStatus: "authorized", testMode: "safe_checks", scopeHash: "scope", capability: "tls_posture", targets, authorization, requestedStartAt: now, validUntil: new Date("2026-07-22T11:00:00.000Z"), now });
  const controlled = validateExecutionBoundary({ engagementStatus: "authorized", testMode: "safe_checks", scopeHash: "scope", capability: "controlled_exploit_validation", targets, authorization, requestedStartAt: now, validUntil: new Date("2026-07-22T11:00:00.000Z"), now });
  assert.equal(safe.allowed, true);
  assert.equal(controlled.allowed, false);
  assert.ok(controlled.blockers.some((blocker) => blocker.includes("does not permit")));
});

test("execution manifest hash is deterministic across target ordering", () => {
  const authorization = { id: "auth", status: "active", scopeHash: "scope", validFrom: new Date("2026-07-22T09:00:00.000Z"), validUntil: new Date("2026-07-22T18:00:00.000Z"), authorityConfirmed: true };
  const targetA = { ...firstTarget, id: "a" };
  const targetB = { ...firstTarget, id: "b", value: "api.example.com" };
  const base = { engagementId: "eng", engagementReference: "VG-2026-TEST", workspaceId: "workspace", scopeHash: "scope", authorization, capability: "tls_posture", rationale: "Validate approved TLS posture without changing production state.", requestedStartAt: new Date("2026-07-22T10:00:00.000Z"), validUntil: new Date("2026-07-22T11:00:00.000Z"), maxRequestsPerSecond: 5, prohibitedActions: ["Persistence", "Denial of service"], stopConditions: ["Client stop request"] };
  const first = buildExecutionManifest({ ...base, targets: [targetA, targetB] });
  const second = buildExecutionManifest({ ...base, targets: [targetB, targetA] });
  assert.equal(first.manifestSha256, second.manifestSha256);
  assert.equal(first.manifest.controls.denialOfServiceAllowed, false);
  assert.equal(first.manifest.controls.dispatchPolicy, "outbound_sensor_only");
  assert.equal(first.manifest.controls.approval.required, false);
});

test("controlled scanner manifests require approval while remaining sensor dispatchable", () => {
  const authorization = { id: "auth", status: "active", scopeHash: "scope", validFrom: new Date("2026-07-22T09:00:00.000Z"), validUntil: new Date("2026-07-22T18:00:00.000Z"), authorityConfirmed: true };
  const target = { ...firstTarget, id: "target", permission: "controlled_validation" };
  const built = buildExecutionManifest({ engagementId: "eng", engagementReference: "VG-2026-SCAN", workspaceId: "workspace", scopeHash: "scope", authorization, capability: "template_vulnerability_scan", targets: [target], rationale: "Run the approved bounded signed-template validation against the explicit URL.", requestedStartAt: new Date("2026-07-22T10:00:00.000Z"), validUntil: new Date("2026-07-22T11:00:00.000Z"), maxRequestsPerSecond: 5, prohibitedActions: ["Denial of service"], stopConditions: ["Client stop request"] });
  assert.equal(built.capability.sensorDispatch, true);
  assert.equal(built.capability.humanApprovalRequired, true);
  assert.equal(built.manifest.controls.dispatchPolicy, "outbound_sensor_only");
  assert.equal(built.manifest.controls.approval.required, true);
  assert.equal(built.manifest.controls.approval.approvedAt, null);
});

test("cloud connector origins reject SSRF targets while sensor endpoints may remain private", () => {
  assert.throws(() => validateConnectorBaseUrl("https://127.0.0.1", "tenable"), /private addresses/i);
  assert.throws(() => validateConnectorBaseUrl("http://cloud.tenable.com", "tenable"), /HTTPS/i);
  assert.equal(validateConnectorBaseUrl("https://greenbone.local:9392", "greenbone"), "https://greenbone.local:9392");
});

test("sensor enrollment tokens are parseable without storing the bearer secret", () => {
  const enrollment = sensorToken("12345678-test-sensor");
  const parsed = parseSensorToken(enrollment.token);
  assert.equal(parsed?.sensorId, "12345678-test-sensor");
  assert.equal(parsed?.tokenHash, enrollment.tokenHash);
  assert.notEqual(enrollment.tokenHash, parsed?.secret);
  assert.equal(signSensorManifest(parsed.secret, "manifest"), signSensorManifest(parsed.secret, "manifest"));
});

test("sensor capability policy allows packaged scanners and refuses manual work", () => {
  assert.equal(sensorCreateSchema.safeParse({ name: "Safe sensor", capabilities: ["dns_posture", "tls_posture"] }).success, true);
  assert.equal(sensorCreateSchema.safeParse({ name: "Scanner node", capabilities: ["network_service_scan", "web_passive_scan", "template_vulnerability_scan"] }).success, true);
  assert.equal(sensorCreateSchema.safeParse({ name: "Unsafe sensor", capabilities: ["controlled_exploit_validation"] }).success, false);
  assert.equal(sensorCreateSchema.safeParse({ name: "Manual sensor", capabilities: ["configuration_analysis"] }).success, false);
});

test("methodology plans are service-specific and traceable to standards", () => {
  const networkPlan = methodologyForService("external_network_vapt");
  const webPlan = methodologyForService("web_and_api_vapt");
  assert.ok(networkPlan.some((item) => item.code === "NET-SVC-01" && item.capability === "network_service_scan"));
  assert.ok(webPlan.some((item) => item.code.startsWith("WSTG-") && item.standardRef.includes("OWASP")));
  assert.equal(networkPlan.some((item) => item.code === "WSTG-ATHZ-01"), false);
});

test("completed methodology tests require an evidence conclusion", () => {
  assert.equal(testCaseUpdateSchema.safeParse({ status: "running", assignedTo: "QCS analyst" }).success, true);
  assert.equal(testCaseUpdateSchema.safeParse({ status: "passed", resultSummary: "Too short" }).success, false);
  assert.equal(testCaseUpdateSchema.safeParse({ status: "finding", resultSummary: "Validated exposure was recorded as finding VG-F-1001." }).success, true);
});

test("retry backoff is bounded", () => {
  assert.equal(retryDelayMinutes(1), 5);
  assert.equal(retryDelayMinutes(4), 40);
  assert.equal(retryDelayMinutes(20), 360);
});

test("secret comparison rejects different values and lengths", () => {
  assert.equal(safeEqual("same-secret", "same-secret"), true);
  assert.equal(safeEqual("same-secret", "other-value"), false);
  assert.equal(safeEqual("short", "longer-secret"), false);
});

test("client onboarding records contact consent without granting testing authority", () => {
  const base = {
    displayName: "Authorized Contact",
    email: "OWNER@EXAMPLE.COM",
    phone: "+91 98765 43210",
    organizationName: "Example Industries",
    countryCode: "in",
    timezone: "Asia/Kolkata",
    serviceType: "external_network_vapt",
    scopeSummary: "Review the externally exposed production perimeter before a customer assurance deadline.",
    emergencyContactName: "Operations Owner",
    emergencyContactEmail: "operations@example.com",
    contactConsent: true,
    authorityAcknowledgement: true
  };
  const accepted = verifyGridOnboardingRequestSchema.safeParse(base);
  const missingBoundary = verifyGridOnboardingRequestSchema.safeParse({ ...base, authorityAcknowledgement: false });
  assert.equal(accepted.success, true);
  assert.equal(accepted.data?.email, "owner@example.com");
  assert.equal(accepted.data?.countryCode, "IN");
  assert.equal(missingBoundary.success, false);
});

test("onboarding tokens are structured and stored as hashes", () => {
  const token = "vg_onboard_12345678-request.abcdefghijklmnopqrstuvwxyzABCDEFG1234567890";
  const parsed = parseVerifyGridOnboardingToken(token);
  assert.equal(parsed?.id, "12345678-request");
  assert.notEqual(parsed?.secret, parsed?.tokenHash);
  assert.equal(parsed?.tokenHash.length, 64);
  assert.equal(parseVerifyGridOnboardingToken("invalid"), null);
});

test("onboarding rejection requires an accountable reason", () => {
  assert.equal(verifyGridOnboardingReviewSchema.safeParse({ action: "approve" }).success, true);
  assert.equal(verifyGridOnboardingReviewSchema.safeParse({ action: "reject", reviewNote: "too short" }).success, false);
  assert.equal(verifyGridOnboardingReviewSchema.safeParse({ action: "reject", reviewNote: "The requester could not establish an eligible business relationship." }).success, true);
});

test("NVD CPE matching requires vendor, product, and reported version evidence", () => {
  const observation = { service: "https nginx", title: "Nginx web service", rawMetadata: { vendor: "f5", product: "nginx", version: "1.26.1" } };
  const exact = matchObservationToCpes(observation, ["cpe:2.3:a:f5:nginx:1.26.1:*:*:*:*:*:*:*"]);
  const mismatch = matchObservationToCpes(observation, ["cpe:2.3:a:apache:http_server:2.4.62:*:*:*:*:*:*:*"]);
  assert.equal(exact.disposition, "exact");
  assert.equal(mismatch.disposition, "unmatched");
});

test("API connector payloads reuse the normalized observation boundary", () => {
  const observations = parseScannerImport("tenable_api", JSON.stringify([{ assetIdentifier: "203.0.113.55", title: "API imported exposure", severity: "high", sourceReference: "tenable:plugin:42", remediation: "Apply the verified vendor fix.", metadata: { product: "ios xe", version: "17.12" } }]));
  assert.equal(observations.length, 1);
  assert.equal(observations[0].sourceReference, "tenable:plugin:42");
  assert.equal(observations[0].rawMetadata.version, "17.12");
});

test("technical report quality gate blocks incomplete methodology and missing authority", () => {
  const gate = evaluateReportQuality({
    reportType: "technical",
    now: new Date("2026-07-24T12:00:00.000Z"),
    currentScopeHash: "scope-v2",
    scopeTargets: [{ inScope: true, ownershipConfirmed: true }],
    activeAuthorization: null,
    testCases: [{ status: "planned", resultSummary: null }],
    findings: [],
    importStatuses: [],
    executionStatuses: []
  });
  assert.equal(gate.canApprove, false);
  assert.ok(gate.checks.some((item) => item.code === "authority.active" && item.status === "fail"));
  assert.ok(gate.checks.some((item) => item.code === "methodology.complete" && item.status === "fail"));
});

test("complete evidence-led report passes release-blocking controls", () => {
  const gate = evaluateReportQuality({
    reportType: "technical",
    now: new Date("2026-07-24T12:00:00.000Z"),
    currentScopeHash: "scope-v2",
    scopeTargets: [{ inScope: true, ownershipConfirmed: true }, { inScope: false, ownershipConfirmed: false }],
    activeAuthorization: { scopeHash: "scope-v2", authorityConfirmed: true, validFrom: new Date("2026-07-24T00:00:00.000Z"), validUntil: new Date("2026-07-30T00:00:00.000Z"), artifactSha256: "a".repeat(64) },
    testCases: [{ status: "passed", resultSummary: "The approved target was tested and the expected control was confirmed." }],
    findings: [{ severity: "high", status: "validated", businessImpact: "Material exposure is possible.", remediation: "Apply the verified control change.", ownerName: "Network owner", dueAt: new Date("2026-08-01T00:00:00.000Z"), evidenceCount: 1, evidenceSummary: "Scanner evidence", retestStatuses: [] }],
    importStatuses: ["completed"],
    executionStatuses: ["completed"]
  });
  assert.equal(gate.canApprove, true);
  assert.equal(gate.summary.failed, 0);
});

test("custody and report chains are deterministic and bind prior state", () => {
  const custody = { engagementId: "eng", sequence: 2, eventType: "evidence_received", subjectType: "import_batch", subjectId: "batch", action: "ingested", actor: "analyst@example.com", sourceSha256: "b".repeat(64), previousHash: "a".repeat(64), occurredAt: "2026-07-24T12:00:00.000Z", classification: "confidential", details: { connector: "nmap" } };
  assert.equal(buildCustodyEventHash(custody), buildCustodyEventHash(custody));
  assert.notEqual(buildCustodyEventHash(custody), buildCustodyEventHash({ ...custody, previousHash: "c".repeat(64) }));
  const first = buildReportChainHash({ engagementId: "eng", reportType: "technical", version: 1, snapshotSha256: "d".repeat(64), generatedAt: "2026-07-24T12:00:00.000Z" });
  const second = buildReportChainHash({ engagementId: "eng", reportType: "technical", version: 2, snapshotSha256: "e".repeat(64), previousChainHash: first, generatedAt: "2026-07-24T13:00:00.000Z" });
  assert.notEqual(first, second);
});

test("Ed25519 report releases are verifiable and reject modified chain hashes", () => {
  const keys = crypto.generateKeyPairSync("ed25519");
  const privateKey = keys.privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
  const publicKey = keys.publicKey.export({ type: "spki", format: "der" }).toString("base64");
  const chainHash = "f".repeat(64);
  const signature = signReportChain(chainHash, privateKey);
  assert.equal(verifyReportChainSignature(chainHash, signature, publicKey), true);
  assert.equal(verifyReportChainSignature(`0${chainHash.slice(1)}`, signature, publicKey), false);
});
