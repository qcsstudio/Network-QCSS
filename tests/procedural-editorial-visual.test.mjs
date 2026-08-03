import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { createProceduralEditorialVisual } from "../src/lib/procedural-editorial-visual.ts";

test("advisory fallback produces a retina-ready contextual source without a paid provider", async () => {
  const generated = await createProceduralEditorialVisual({
    altText: "QCS advisory visual for a Cisco FMC static credential vulnerability",
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
  assert.equal(metadata.width, 1440);
  assert.equal(metadata.height, 810);
  assert.equal(generated.trace.provider, "qcs-procedural");
  assert.match(generated.trace.direction.focalSubject, /static credential/i);
  assert.equal(generated.trace.qa.approved, true);
});
