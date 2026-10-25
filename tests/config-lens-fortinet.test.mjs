import assert from "node:assert/strict";
import test from "node:test";
import { analyzeConfiguration, reportText } from "../src/lib/config-lens/engine.ts";
import { fortinetWords } from "../src/lib/config-lens/fortinet-syntax.ts";
import { fortinetFullBackup } from "./fixtures/config-lens-fortinet.ts";

const selection = { profileId: "fortigate", version: "FortiOS 7.4", build: "", configType: "saved" };
const analyze = input => analyzeConfiguration(input, selection);

test("valid password-policy section survives masking without an unmatched end", () => {
  const result = analyze("config system password-policy\n set status enable\nend\nconfig system interface\n edit port1\n set ip 192.0.2.1 255.255.255.0\n next\nend");
  assert.equal(result.lines[0].status, "context");
  assert.equal(result.entities[0].name, "port1");
});

test("full backup preserves syntax and masks complete text, certificates, keys and SNMP names", () => {
  const result = analyze(fortinetFullBackup);
  for (const output of [JSON.stringify(result), reportText(result), result.maskedSource]) {
    assert.doesNotMatch(output, /Hidden\w*Canary|GhostInterface|FakeCiscoInterface/);
  }
  assert.deepEqual(result.entities.map(entity => entity.name), ["port1", "OfficeSubnet", "10"]);
  assert.equal(result.relationships.filter(ref => ref.to).length, 2);
  assert.equal(result.lines.length, fortinetFullBackup.split("\n").length);
  assert.deepEqual(result.lines.map(line => line.line), result.lines.map((_, index) => index + 1));
  assert.equal(result.maskedCount, result.coverage.masked);
  assert.equal(result.maskedSource.split("\n").length, fortinetFullBackup.split("\n").length);
  const second = analyze(result.maskedSource);
  assert.deepEqual(second.coverage, result.coverage);
  assert.deepEqual(second.entities, result.entities);
  assert.equal(second.maskedSource, result.maskedSource);
});

test("large realistic backup retains all 12155 physical lines without losing boundaries", () => {
  const padded = `${fortinetFullBackup}\n${"# local synthetic padding\n".repeat(12155 - fortinetFullBackup.split("\n").length - 1)}# last line`;
  assert.equal(padded.split("\n").length, 12155);
  const result = analyze(padded);
  assert.equal(result.lines.length, 12155);
  assert.equal(result.lines.at(-1).line, 12155);
  assert.equal(result.entities.length, 3);
});

test("escaped quotes, apostrophes, backslashes and spaces resolve exact object references", () => {
  assert.deepEqual(fortinetWords(String.raw`"Office \"A\"" 'O\'Brien' Office\ B "C:\\path" ""`), ['Office "A"', "O'Brien", "Office B", "C:\\path", ""]);
  const result = analyze(String.raw`config firewall address
 edit "Office \"A\""
 set subnet 192.0.2.0 255.255.255.0
 next
 edit Office\ B
 set subnet 198.51.100.0 255.255.255.0
 next
end
config firewall addrgrp
 edit Group
 set member "Office \"A\"" Office\ B
 next
end`);
  assert.deepEqual(result.relationships.map(ref => ref.target), ['Office "A"', "Office B"]);
  assert.ok(result.relationships.every(ref => ref.to));
});

test("multiline values and backslash continuations cannot introduce parsed commands", () => {
  for (const field of [
    'set comments "HiddenValueCanary\nnext\nend\nlast line"',
    "set comments 'HiddenValueCanary\nnext\nend\nlast line'",
    "set unknown-field HiddenValueCanary\\\nend\\\nlast-line",
    'set unknown-field "HiddenValueCanary\n\nnext\nend\nlast line"'
  ]) {
    const result = analyze(`config system interface\n edit port1\n ${field}\n set ip 192.0.2.1 255.255.255.0\n next\nend`);
    assert.equal(result.entities.length, 1);
    assert.equal(result.entities[0].settings.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /HiddenValueCanary/);
    assert.deepEqual(analyze(result.maskedSource).coverage, result.coverage);
  }
});

test("redacted entry names and multiline entries retain structural identity without raw values", () => {
  for (const name of ['"password-HiddenValueCanary"', '"HiddenValueCanary\ncontinued"']) {
    const result = analyze(`config system interface\n edit ${name}\n set ip 192.0.2.1 255.255.255.0\n next\nend`);
    assert.equal(result.entities.length, 1);
    assert.match(result.entities[0].name, /MASKED: entry/);
    assert.doesNotMatch(JSON.stringify(result), /HiddenValueCanary/);
    assert.deepEqual(analyze(result.maskedSource).entities, result.entities);
    assert.equal(result.maskedCount, result.coverage.masked);
  }
});

test("end closes only its active table, with or without an explicit next", () => {
  const result = analyze(`config vdom
 edit BLUE
 config system interface
 edit port1
 set ip 192.0.2.1 255.255.255.0
 end
 next
 edit RED
 config system interface
 edit port1
 set ip 198.51.100.1 255.255.255.0
 next
 end
 config firewall policy
 edit 1
 set srcintf port1
 end
 end`);
  assert.equal(result.relationships[0].scope, "VDOM RED");
  assert.equal(result.relationships[0].to, result.entities.find(entity => entity.scope === "VDOM RED" && entity.name === "port1").id);
});

test("genuine syntax errors include safe line numbers and never a secret snippet", () => {
  for (const [input, expected] of [
    ['config system interface\n edit "HiddenValueCanary', /starting at line 2/],
    ['config system interface\n set comments HiddenValueCanary\\', /starting at line 2/],
    ['config system interface\n next\nend', /Unbalanced.*line 2/],
    ['end', /Unbalanced.*line 1/],
    ['config system interface\n edit "password-HiddenValueCanary"\n next', /opened at line 1.*closing/],
    ['config system interface\n edit port1\n edit "HiddenValueCanary"\nend', /Unbalanced.*line 3/]
  ]) {
    assert.throws(() => analyze(input), error => {
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, /HiddenValueCanary/);
      return true;
    });
  }
});

test("mixed real vendor commands are still rejected outside quoted content", () => {
  assert.throws(() => analyze(`${fortinetFullBackup}\ninterface GigabitEthernet0/0`), /Mixed vendor/);
});

test("standalone PEM content remains masked under the Fortinet selection", () => {
  const result = analyze(`${fortinetFullBackup}\n-----BEGIN PRIVATE KEY-----\nHiddenPemCanary\nend\n-----END PRIVATE KEY-----`);
  assert.doesNotMatch(JSON.stringify(result), /HiddenPemCanary/);
  assert.deepEqual(result.entities, analyze(fortinetFullBackup).entities);
});

test("CRLF and tab-indented backup syntax has the same semantic output", () => {
  const expected = analyze(fortinetFullBackup);
  const actual = analyze(fortinetFullBackup.replace(/^ +/gm, "\t").replace(/\n/g, "\r\n"));
  assert.deepEqual(actual.coverage, expected.coverage);
  assert.deepEqual(actual.entities, expected.entities);
});
