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
});
