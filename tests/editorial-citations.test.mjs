import assert from "node:assert/strict";
import test from "node:test";
import { mapClaimSourceUrls } from "../src/lib/editorial-citations.ts";

const evidence = [
  {
    label: "Cisco PSIRT Advisory",
    url: "https://sec.cloudapps.cisco.com/security/example",
    text: "Cisco published a software advisory covering affected products, fixed releases, and remediation guidance."
  },
  {
    label: "RIPE Labs RPKI Operations",
    url: "https://labs.ripe.net/author/example/rpki-operations/",
    text: "RPKI validators retrieve ROAs and produce route-origin validation states for BGP operators."
  }
];

test("explicit approved claim citations remain unchanged", () => {
  assert.deepEqual(
    mapClaimSourceUrls([evidence[0].url], "Apply the Cisco fixed release.", evidence),
    [evidence[0].url]
  );
});

test("uncited claims map to the most relevant approved evidence", () => {
  assert.deepEqual(
    mapClaimSourceUrls([], "Use RPKI validators to verify ROAs and BGP route-origin state.", evidence),
    [evidence[1].url]
  );
});

test("claims without a reliable match fall back to the primary evidence source", () => {
  assert.deepEqual(mapClaimSourceUrls([], "Record accountable ownership and the next review date.", evidence), [evidence[0].url]);
});

test("unapproved model-supplied URLs are discarded before mapping", () => {
  assert.deepEqual(
    mapClaimSourceUrls(["https://example.com/unapproved"], "Apply the Cisco fixed release.", evidence),
    [evidence[0].url]
  );
});
