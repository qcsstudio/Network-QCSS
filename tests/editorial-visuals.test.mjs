import assert from "node:assert/strict";
import test from "node:test";
import { advisoryVisualProfile, resourceVisualProfile } from "../src/lib/editorial-visuals.ts";

function post(overrides) {
  return {
    contentType: "blog",
    title: "Network engineering guide",
    category: "Network Engineering",
    primaryKeyword: "network engineering",
    keywords: ["network operations", "evidence", "validation"],
    ...overrides
  };
}

test("resource visual profiles select a subject-specific motif", () => {
  const routing = resourceVisualProfile(
    post({
      title: "RPKI and ROA validation before a BGP change",
      primaryKeyword: "RPKI validation",
      keywords: ["BGP", "ROA", "route origin"]
    })
  );
  const capture = resourceVisualProfile(
    post({
      title: "Packet capture runbook for FortiGate incidents",
      primaryKeyword: "packet capture",
      keywords: ["PCAP", "FortiGate", "incident evidence"]
    })
  );

  assert.equal(routing.motif, "routing");
  assert.equal(capture.motif, "capture");
  assert.notEqual(routing.signature, capture.signature);
  assert.ok(routing.tags.some((tag) => /rpki/i.test(tag)));
});

test("articles in the same visual family remain uniquely branded", () => {
  const first = resourceVisualProfile(post({ title: "AWS VPC exposure review", keywords: ["AWS", "VPC", "cloud exposure", "hybrid cloud VPN"] }));
  const second = resourceVisualProfile(post({ title: "Azure VNet route inspection", keywords: ["Azure", "VNet", "cloud routes"] }));

  assert.equal(first.motif, "cloud");
  assert.equal(second.motif, "cloud");
  assert.notEqual(first.signature, second.signature);
});

test("dominant password context wins over a supporting VPN keyword", () => {
  const profile = resourceVisualProfile(
    post({
      title: "Strong password hygiene for VPN administrators",
      primaryKeyword: "strong password generator",
      keywords: ["VPN password", "Wi-Fi password", "credential hygiene"]
    })
  );

  assert.equal(profile.motif, "identity");
});

test("advisory profiles carry vendor and product context", () => {
  const profile = advisoryVisualProfile({
    title: "FortiGate remote access vulnerability",
    vendor: "Fortinet",
    summary: "A security update affecting SSL VPN access.",
    products: ["FortiGate", "FortiOS"],
    cves: ["CVE-2026-12345"],
    severity: "critical"
  });

  assert.equal(profile.motif, "remote-access");
  assert.ok(profile.tags.includes("Fortinet"));
  assert.match(profile.signature, /^QCS-[A-F0-9]{8}$/);
});
