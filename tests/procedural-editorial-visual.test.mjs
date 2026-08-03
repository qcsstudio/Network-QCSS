import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { advisoryFixedReleaseTrains, createProceduralEditorialVisual } from "../src/lib/procedural-editorial-visual.ts";

test("advisory hotfix trains preserve major releases beyond 7.x", () => {
  assert.deepEqual(
    advisoryFixedReleaseTrains(
      "7.0 Hotfix GB-7.0.9.1-3, 7.2 Hotfix HL-7.2.11.1-4, 7.7 Hotfix AM-7.7.12.1-2, 10.0 Hotfix P-10.0.1.1-2"
    ),
    ["7.0", "7.2", "7.7", "10.0"]
  );
});

test("advisory fallback produces a retina-ready contextual source without a paid provider", async () => {
  const generated = await createProceduralEditorialVisual({
    altText: "QCS advisory visual for a Cisco FMC static credential vulnerability",
    contentId: "advisory-cisco-fmc-static-credential",
    contentRevision: "1",
    contentType: "security_advisory",
    context: [
      "Vendor: Cisco.",
      "Severity: high, CVSS 5.3.",
      "Affected products: Cisco Secure Firewall Management Center.",
      "Technical mechanism from the reviewed advisory: Static user credentials permit unauthenticated access to a low-privileged account.",
      "Exploitation status: Cisco reports active exploitation."
    ].join("\n"),
    title: "Cisco FMC static credential vulnerability"
  });
  const metadata = await sharp(generated.source).metadata();
  const headlineStats = await sharp(generated.source).extract({ left: 60, top: 170, width: 630, height: 400 }).stats();
  assert.equal(metadata.width, 1440);
  assert.equal(metadata.height, 810);
  assert.equal(generated.trace.provider, "qcs-procedural");
  assert.equal(generated.trace.imageModel, "qcs-editorial-resvg-v7");
  assert.match(generated.trace.direction.focalSubject, /static credential/i);
  assert.equal(generated.trace.qa.approved, true);
  assert.ok(headlineStats.entropy > 2, "the headline region should contain rendered text, not only the background grid");
});

test("related advisories produce distinct evidence maps", async () => {
  const common = {
    altText: "QCS Ubuntu Linux kernel advisory visual",
    contentRevision: "1",
    contentType: "security_advisory",
    context: [
      "Vendor: Ubuntu.",
      "Severity: unrated.",
      "Affected products: Ubuntu Intel IoTG kernel.",
      "Technical mechanism from the reviewed advisory: NTFS validation can expose kernel memory."
    ].join("\n")
  };
  const first = await createProceduralEditorialVisual({
    ...common,
    contentId: "ubuntu-usn-8620-3",
    title: "USN-8620-3: Linux kernel (Intel IoTG) vulnerabilities"
  });
  const second = await createProceduralEditorialVisual({
    ...common,
    contentId: "ubuntu-usn-8620-4",
    title: "USN-8620-4: Linux kernel (Intel IoTG) vulnerabilities"
  });
  assert.notDeepEqual(first.source, second.source);
  assert.notEqual(first.trace.direction.diversitySignature, second.trace.direction.diversitySignature);
});

test("FortiGate CAPWAP advisories render a managed-device trust boundary instead of routing assurance", async () => {
  const generated = await createProceduralEditorialVisual({
    altText: "QCS FortiGate CAPWAP vulnerability advisory visual",
    contentId: "fortinet-cve-2025-53844",
    contentRevision: "2",
    contentType: "security_advisory",
    context: [
      "Vendor: Fortinet.",
      "Severity: high, CVSS 8.3.",
      "Affected products: FortiGate, FortiOS, FortiAP, FortiExtender, FortiSwitch.",
      "Technical mechanism from the reviewed advisory: An out-of-bounds write in the CAPWAP daemon can cross an authenticated managed-device trust relationship.",
      "Operational and business consequence: A compromised extension device may gain execution privileges on the FortiGate and affect firewall policy or routing.",
      "Required action: Patch FortiOS and review managed-device events."
    ].join("\n"),
    title: "Fortinet FortiOS CAPWAP Out-of-Bounds Write Vulnerability"
  });
  assert.equal(generated.trace.direction.focalSubject, "CAPWAP CONTROL PATH");
  assert.deepEqual(generated.trace.direction.supportingElements, ["MAP DEVICES", "PATCH FORTIOS", "REVIEW EVENTS"]);
  assert.match(generated.trace.direction.mechanismStatement, /extension device to fortigate/i);
  assert.doesNotMatch(generated.trace.direction.sceneConcept, /route origin/i);
  assert.equal(generated.trace.imageModel, "qcs-editorial-resvg-v7");
});
