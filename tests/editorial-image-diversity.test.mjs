import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { editorialPerceptualHash, visuallyRepeated } from "../src/lib/editorial-image-diversity.ts";

test("identical pixels retain a stable compact composition hash", async () => {
  const fixture = await sharp({ create: { width: 100, height: 70, channels: 3, background: "#a32487" } }).png().toBuffer();
  const first = await editorialPerceptualHash(fixture);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, await editorialPerceptualHash(fixture));
  assert.equal(visuallyRepeated(first, [first]), true);
});

test("small hash changes trigger review while unrelated composition hashes and legacy entries do not", () => {
  const source = "0".repeat(64);
  assert.equal(visuallyRepeated(source, ["0".repeat(62) + "ff"]), true);
  assert.equal(visuallyRepeated(source, ["f".repeat(64)]), false);
  assert.equal(visuallyRepeated(source, ["legacy", ""]), false);
});
