import assert from "node:assert/strict";
import test from "node:test";
import { profiles } from "../src/lib/config-lens/catalog.ts";
import { fortinetFullBackup } from "./fixtures/config-lens-fortinet.ts";

const messages = [];
globalThis.self = { postMessage: value => messages.push(value) };
await import("../src/components/config-lens.worker.ts");
const selection = { profileId: "cisco-router", version: profiles[0].versions[0], build: "", configType: "running" };

test("worker reads large local files, reports progress and sends only masked analysis", async () => {
  messages.length = 0;
  const input = `hostname demo\n${" ip route 192.0.2.0 255.255.255.0 198.51.100.1\n".repeat(25000)}username admin secret WorkerSecretCanary\nend`;
  await self.onmessage({ data: { input: "", file: new File([input], "large.cfg"), selection } });
  assert.ok(messages.some(m => m.progress?.phase === "reading"));
  assert.ok(messages.some(m => m.progress?.phase === "explaining"));
  assert.equal(messages.at(-1).analysis.coverage.total, 25003);
  assert.ok(!JSON.stringify(messages).includes("WorkerSecretCanary"));
});

test("file decoder rejects malformed and incomplete UTF-8 without exposing bytes", async () => {
  for (const bytes of [new Uint8Array([0xff]), new Uint8Array([0xe2, 0x82])]) {
    messages.length = 0;
    await self.onmessage({ data: { input: "", file: new File([bytes], "invalid.cfg"), selection } });
    assert.match(messages.at(-1).error, /UTF-8/);
    assert.ok(!messages.some(m => m.analysis));
  }
});

test("Fortinet file worker preserves nested blocks and never posts masked payloads", async () => {
  const fortinet = { ...selection, profileId: "fortigate", version: "FortiOS 7.4" };
  messages.length = 0;
  await self.onmessage({ data: { input: "", file: new File([fortinetFullBackup], "synthetic.conf"), selection: fortinet } });
  assert.equal(messages.at(-1).analysis.entities.length, 3);
  assert.doesNotMatch(JSON.stringify(messages), /Hidden\w*Canary/);
  messages.length = 0;
  await self.onmessage({ data: { input: 'config system interface\n edit "HiddenValueCanary', selection: fortinet } });
  assert.match(messages.at(-1).error, /starting at line 2/);
  assert.doesNotMatch(JSON.stringify(messages), /HiddenValueCanary/);
  assert.ok(!messages.some(message => message.analysis));
});

test("stream decoder handles multibyte text split across chunks", async () => {
  messages.length = 0;
  const bytes = new TextEncoder().encode("hostname demo\n! private \u20ac\nend");
  const offset = bytes.indexOf(0xe2) + 1;
  const file = { size: bytes.length, stream: () => new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, offset)); c.enqueue(bytes.slice(offset)); c.close(); } }) };
  await self.onmessage({ data: { input: "", file, selection } });
  assert.equal(messages.at(-1).analysis.maskedCount, 1);
  assert.equal(messages.at(-1).analysis.coverage.total, 3);
});
