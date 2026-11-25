import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_INPUT_METADATA, INPUT_LIMITS, inspectConfiguration, readConfigurationFile, validateComparison, validateFileSize, validateTextLimits } from "../src/lib/config-lens/intake.ts";
import { profiles } from "../src/lib/config-lens/catalog.ts";

const metadata = { ...DEFAULT_INPUT_METADATA, completeness: "entire", scope: "device", defaults: "omitted", deviceAlias: "synthetic-edge", model: "synthetic-model", purpose: "production" };
const select = (id = "cisco-router", build = "17.15.4") => ({ profileId: id, version: id === "cisco-ftd" && build.startsWith("7.") ? "FTD 7.x" : profiles.find(profile => profile.id === id).versions[0], build, configType: "running" });
const router = "version 17.15\nhostname synthetic-edge\ninterface GigabitEthernet0/0\n ip address 192.0.2.1 255.255.255.0\nend";

test("exact byte and physical-line boundaries, including blank lines, are enforced without truncation", () => {
  validateFileSize(INPUT_LIMITS.bytes);
  assert.throws(() => validateFileSize(INPUT_LIMITS.bytes + 1), /10 MiB/);
  assert.throws(() => validateFileSize(0), /empty/);
  const exact = ("x".repeat(65535) + "\n").repeat(159) + "x".repeat(65536);
  assert.equal(validateTextLimits(exact).bytes, INPUT_LIMITS.bytes);
  assert.throws(() => validateTextLimits(exact + "x"), /10 MiB/);
  assert.equal(validateTextLimits("\n".repeat(99999) + "!").lines.length, 100000);
  assert.throws(() => validateTextLimits("\n".repeat(100000) + "!"), /100,000/);
});

test("line limits count UTF-8 bytes, not JavaScript characters", () => {
  assert.equal(validateTextLimits("€".repeat(21845)).bytes, 65535);
  assert.throws(() => validateTextLimits("€".repeat(21846)), /Line 1.*64 KiB/);
});

test("line ending normalization preserves original physical line numbers", () => {
  assert.deepEqual(validateTextLimits("\uFEFFhostname demo\r\n\rinterface x\nend").lines, ["hostname demo", "", "interface x", "end"]);
});

test("invalid pasted Unicode is rejected instead of silently replaced", () => {
  for (const input of ["hostname \ud800", "hostname \udc00"]) assert.throws(() => validateTextLimits(input), /malformed Unicode/);
  assert.ok(validateTextLimits("hostname 😀").bytes > 0);
});

function streamed(bytes, split = 1, declaredSize = bytes.length) {
  return { size: declaredSize, stream: () => new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += split) controller.enqueue(bytes.slice(i, i + split)); controller.close(); } }) };
}

test("streaming decodes UTF-8 BOM and multibyte characters split across chunks", async () => {
  const bytes = new TextEncoder().encode("\uFEFFhostname synthetic\n! €\nend");
  const result = await readConfigurationFile(streamed(bytes));
  assert.equal(result.text, "hostname synthetic\n! €\nend");
  assert.equal(result.encoding, "UTF-8");
});

test("BOM-identified UTF-16 LE and BE preserve text across odd stream boundaries", async () => {
  for (const bigEndian of [false, true]) {
    const text = "hostname synthetic\r\n! €\nend", bytes = new Uint8Array(2 + text.length * 2);
    bytes.set(bigEndian ? [254, 255] : [255, 254]);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < text.length; i++) view.setUint16(2 + i * 2, text.charCodeAt(i), !bigEndian);
    const result = await readConfigurationFile(streamed(bytes));
    assert.equal(result.text, text);
    assert.equal(result.encoding, bigEndian ? "UTF-16 BE" : "UTF-16 LE");
  }
});

test("malformed UTF-8/UTF-16, unsupported UTF-32 and inaccurate stream sizes fail closed", async () => {
  for (const bytes of [new Uint8Array([255]), new Uint8Array([226, 130]), new Uint8Array([255, 254, 65]), new Uint8Array([255, 254, 0, 0, 65, 0, 0, 0])]) await assert.rejects(readConfigurationFile(streamed(bytes)), /UTF-/);
  await assert.rejects(readConfigurationFile(streamed(new Uint8Array([65, 66, 67, 68]), 4, 3)), /declared size/);
  await assert.rejects(readConfigurationFile(streamed(new Uint8Array([65]), 1, 2)), /declared size/);
});

test("decoded UTF-16 expansion is bounded independently of original file bytes", async () => {
  const characters = 3_500_000, bytes = new Uint8Array(2 + characters * 2);
  bytes.set([255, 254]);
  const view = new DataView(bytes.buffer);
  for (let offset = 2; offset < bytes.length; offset += 2) view.setUint16(offset, 0x4e00, true);
  await assert.rejects(readConfigurationFile(streamed(bytes, 65536)), /Decoded text exceeds 10 MiB/);
});

test("a fully identified primary input is ready, independently of default inclusion", () => {
  const result = inspectConfiguration(router, select(), metadata);
  assert.equal(result.state, "ready");
  assert.equal(result.detectedVersion, "17.15");
  assert.equal(result.declaredVersion, "17.15.4");
  assert.equal(result.metadata.defaults, "omitted");
  assert.equal(result.support, "primary");
  assert.equal(result.detectedVendor, "Cisco");
  assert.equal(inspectConfiguration('! Model number: C9300-48P\n' + router, select(), metadata).detectedModel, "C9300-48P");
  const forti = inspectConfiguration('#config-version=FGT60F-7.6.4-FW-build\nconfig system interface\nend', select("fortigate", "7.6.4"), metadata);
  assert.equal(forti.detectedVendor, "Fortinet");
  assert.equal(forti.detectedModel, "FGT60F");
  assert.ok(forti.issues.some(issue => issue.code === "model-mismatch"));
});

test("missing metadata stays limited; declarations do not infer absent settings", () => {
  const result = inspectConfiguration(router, { ...select(), build: "", configType: "unknown" }, DEFAULT_INPUT_METADATA);
  assert.equal(result.state, "limited");
  for (const code of ["completeness", "scope", "model", "defaults", "config-state"]) assert.ok(result.issues.some(issue => issue.code === code));
});

test("all eight primary profile/version targets can be identified", () => {
  const cases = [
    ["cisco-router", "17.15.4", router], ["cisco-switch", "17.18.4", "version 17.18\nhostname test\ninterface Gi1/0/1\n switchport mode access\nend"],
    ["cisco-nexus", "10.5(6)", "! NXOS: version 10.5(6)\nhostname test\ninterface Ethernet1/1\n no shutdown"],
    ["cisco-asa", "9.20(4)", "ASA Version 9.20(4)\nhostname test\ninterface GigabitEthernet0/0\n nameif inside"],
    ["cisco-ftd", "7.6.6", "NGFW Version 7.6.6\nhostname test\ninterface GigabitEthernet0/0\n nameif inside"],
    ["fortigate", "7.6.4", "#config-version=FGT-7.6.4-FW-build\nconfig system interface\n edit port1\n next\nend"],
    ["fortiswitch", "7.6.5", "#config-version=FS-7.6.5-FW-build\nconfig switch interface\n edit port1\n next\nend"],
    ["fortiweb", "7.6.1", "#config-version=FWB-7.6.1-FW-build\nconfig server-policy policy\n edit test\n next\nend"]
  ];
  for (const [id, build, input] of cases) {
    const result = inspectConfiguration(input, select(id, build), metadata);
    assert.equal(result.support, "primary", id);
    assert.notEqual(result.state, "blocked", id);
    if (id === "cisco-ftd") assert.ok(result.issues.some(issue => issue.code === "ftd-partial"));
  }
});

test("Fortinet 8.0 remains preview for all three profiles, including selection without a header", () => {
  for (const id of ["fortigate", "fortiswitch", "fortiweb"]) {
    const version = profiles.find(profile => profile.id === id).versions.find(version => version.includes("8.0"));
    const selection = { ...select(id, ""), version };
    const result = inspectConfiguration("config system interface\n edit port1\n next\nend", selection, metadata);
    assert.equal(result.support, "preview", id);
    assert.equal(result.state, "preview", id);
  }
});

test("version mismatches include patch conflicts and do not confuse 4 with 40", () => {
  assert.equal(inspectConfiguration(router, select("cisco-router", "17.18.4"), metadata).state, "blocked");
  const input = router.replace("version 17.15", "version 17.15.4");
  assert.ok(inspectConfiguration(input, select("cisco-router", "17.15.40"), metadata).issues.some(issue => issue.code === "version-mismatch"));
});

test("mixed devices, mixed vendors and wrong device families are blocked", () => {
  for (const input of [router + "\nhostname other-device", router + "\nconfig system interface\nend", "ASA Version 9.20\nhostname test\nend", "NGFW Version 7.6.6\nhostname test\nend", "! NXOS: version 10.5(6)\nhostname test\nend"]) assert.equal(inspectConfiguration(input, select(), metadata).state, "blocked");
});

test("paginated and error-contaminated terminal captures cannot be labelled ready", () => {
  for (const damage of ["--More--", "% Invalid input detected", "%SYS-5-CONFIG_I: changed", "  ^"]) assert.equal(inspectConfiguration(router + "\n" + damage, select(), metadata).state, "blocked");
});

test("repeated full headers are blocked even with the same hostname", () => {
  assert.equal(inspectConfiguration(router + "\n" + router, select(), metadata).state, "blocked");
});

test("quoted Fortinet payloads and Cisco banners cannot spoof vendor, device or version", () => {
  const forti = 'config system global\n set alias "inside\nhostname fake\nversion 17.15\n--More--\ntext"\nend';
  const result = inspectConfiguration(forti, select("fortigate", "7.6.4"), metadata);
  assert.notEqual(result.state, "blocked");
  assert.equal(result.detectedVersion, "");
  const cisco = router + '\nbanner motd ^C\n<html>\nconfig system interface\nhostname fake\nversion 1.0\n^C';
  assert.notEqual(inspectConfiguration(cisco, select(), metadata).state, "blocked");
});

test("documents, binary text, control characters and malformed quoting are blocked without input echo", () => {
  for (const input of ['{"secret":"SensitiveCanary"}', '<html>SensitiveCanary</html>', 'hostname test\n\x00SensitiveCanary', 'config system global\n set alias "SensitiveCanary']) {
    const result = inspectConfiguration(input, select(input.startsWith("config") ? "fortigate" : "cisco-router", ""), metadata);
    assert.equal(result.state, "blocked");
    assert.ok(!JSON.stringify(result).includes("SensitiveCanary"));
  }
});

test("unknown named scope stays limited and comparison requires the same context", () => {
  const before = { selection: select(), metadata: { ...metadata, scope: "context", scopeName: "blue" } };
  assert.ok(validateComparison(before, { ...before, metadata: { ...before.metadata, scopeName: "red" } }).some(issue => issue.code === "compare-context"));
  assert.ok(inspectConfiguration(router, select(), { ...metadata, scope: "context", scopeName: "" }).issues.some(issue => issue.code === "scope-name"));
  assert.deepEqual(validateComparison({ selection: select(), metadata: { ...metadata, scopeName: "blue" } }, { selection: select(), metadata: { ...metadata, scopeName: "red" } }), []);
});

test("comparison requires matching profile, declared identity and scope; differing states are visible", () => {
  const before = { selection: select(), metadata };
  assert.deepEqual(validateComparison(before, before), []);
  assert.ok(validateComparison(before, { ...before, selection: select("cisco-switch") }).some(issue => issue.level === "blocked"));
  assert.ok(validateComparison(before, { ...before, metadata: { ...metadata, deviceAlias: "other" } }).some(issue => issue.code === "compare-device"));
  assert.ok(validateComparison(before, { ...before, metadata: { ...metadata, scope: "global" } }).some(issue => issue.code === "compare-scope"));
  assert.ok(validateComparison(before, { ...before, selection: { ...before.selection, configType: "saved" } }).some(issue => issue.code === "compare-state" && issue.level === "notice"));
});

test("worker returns only masked results and supports a validated Before/After pair", async () => {
  const messages = [];
  globalThis.self = { postMessage: value => messages.push(value) };
  await import("../src/components/config-analyzer-input.worker.ts");
  const input = { input: router + "\nusername admin secret InputSecretCanary", selection: select(), metadata };
  await self.onmessage({ data: { inputs: [input, input] } });
  assert.equal(messages.at(-1).validated.intakes.length, 2);
  assert.equal(messages.at(-1).validated.analyses.length, 2);
  assert.ok(!JSON.stringify(messages).includes("InputSecretCanary"));
  messages.length = 0;
  await self.onmessage({ data: { inputs: [input, { ...input, metadata: { ...metadata, deviceAlias: "other" } }] } });
  assert.deepEqual(messages.at(-1).validated.analyses, []);
  assert.ok(messages.at(-1).validated.comparisonIssues.some(issue => issue.level === "blocked"));
  messages.length = 0;
  await self.onmessage({ data: { inputs: [input, input, input] } });
  assert.match(messages.at(-1).error, /Batch imports/);
  messages.length = 0;
  const large = 'config firewall addrgrp\n edit group1\n' + (' set member ' + 'a '.repeat(6000) + '\n').repeat(17) + ' next\nend';
  await self.onmessage({ data: { inputs: [{ input: large, selection: select("fortigate", "7.6.4"), metadata }] } });
  assert.match(messages.at(-1).error, /100,000-reference safety budget/);
  assert.ok(!messages.some(message => message.validated));
  for (const candidate of [
    { input: router + '\n description NX-OS --More--\nbanner motd ^C\nconfig system interface\nversion 1.0\n! NXOS: version 9.3(1)\nPayloadSecretCanary\n^C', selection: select() },
    { input: '#config-version=FGT-7.6.4-FW-build\nconfig system global\n set alias "quoted\n#config-version=FGT-9.9.9-FW-build\nPayloadSecretCanary\ntext"\nend\nconfig system interface\n edit port1\n set ip 192.0.2.1 255.255.255.0\n next\nend', selection: select("fortigate", "7.6.4") }
  ]) {
    messages.length = 0;
    await self.onmessage({ data: { inputs: [{ ...candidate, metadata }] } });
    assert.equal(messages.at(-1).validated?.analyses.length, 1, messages.at(-1).error);
    assert.ok(!JSON.stringify(messages).includes("PayloadSecretCanary"));
  }
});
