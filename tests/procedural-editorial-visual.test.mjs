import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { createProceduralEditorialVisual } from "../src/lib/procedural-editorial-visual.ts";

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
  assert.equal(generated.trace.imageModel, "qcs-editorial-resvg-v5");
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
