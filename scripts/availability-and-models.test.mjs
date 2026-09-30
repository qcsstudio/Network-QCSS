import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { existsSync, readFileSync } from "node:fs";
import { loadSection } from "../src/lib/section-availability.ts";
import { buildDomainModel, domainModelKinds } from "../src/components/consulting-home/domain-models.js";

test("healthy empty collections remain distinct from failed reads", async (context) => {
  context.mock.method(console, "error", () => {});
  assert.deepEqual(await loadSection("empty", async () => []), { available: true, data: [] });
  assert.deepEqual(await loadSection("quota", async () => { throw new Error("quota"); }), { available: false, data: null });
  assert.deepEqual(await loadSection("missing config", () => { throw new Error("configuration"); }), { available: false, data: null });
});

test("one rejected section cannot erase healthy siblings or unlock an operator", async (context) => {
  context.mock.method(console, "error", () => {});
  const [content, access] = await Promise.all([
    loadSection("content", async () => [{ id: "draft-1" }]),
    loadSection("access", async () => { throw new Error("storage down"); }),
  ]);
  assert.equal(content.available, true);
  assert.equal(content.data[0].id, "draft-1");
  assert.equal(access.available, false);
  assert.equal(access.data?.state, undefined);
});

const palette = { shell: 0xf7f6fb, body: 0x555d78, mint: 0xffba87, green: 0xb62962, coral: 0xed719d, metal: 0x959db3, dark: 0x292c3c };

function model(kind) {
  const boxes = [], labels = [], paths = [];
  const view = {
    root: new THREE.Group(), el: { dataset: {} },
    box(parent, x, y, z, w, h, d, color) {
      const object = new THREE.Group();
      object.position.set(x, y, z);
      parent.add(object);
      boxes.push([x, y, z, w, h, d, color]);
      return object;
    },
    label(text, point) { labels.push({ text, point }); },
    material(color) { return new THREE.MeshBasicMaterial({ color }); },
    cable(points, type, color, options) { paths.push({ points, type, color, options }); },
    plate(parent, x, z, w, d, color) { return this.box(parent, x, 0, z, w, .2, d, color); },
    monitor(parent, x, z, color) { return this.box(parent, x, 1, z, 1.3, 1, .2, color); },
    document(parent, x, y, z, color) { return this.box(parent, x, y, z, 1.8, 2.25, .12, color); },
  };
  buildDomainModel(view, kind, palette);
  for (const time of [0, 1.5, 20]) {
    view.domainMotion(time);
    view.root.traverse((object) => assert.ok([...object.position, ...object.scale].every(Number.isFinite)));
  }
  view.root.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
  return { view, boxes, labels, paths };
}

test("thirteen domain models have distinct compositions, labels and finite motion", () => {
  const signatures = new Set();
  for (const kind of domainModelKinds) {
    const output = model(kind);
    assert.equal(output.view.el.dataset.model, kind);
    assert.ok(output.labels.length >= 2, kind);
    assert.ok(output.boxes.length >= 2, kind);
    assert.equal(new Set(output.labels.map((label) => label.text)).size, output.labels.length);
    assert.ok(output.boxes.every((box) => box.slice(0, 6).every(Number.isFinite) && box.slice(3, 6).every((value) => value > 0)), kind);
    signatures.add(JSON.stringify(output.boxes));
  }
  assert.equal(signatures.size, domainModelKinds.length);
});

test("each domain has a matching static fallback rather than a generic stock image", () => {
  for (const kind of domainModelKinds) assert.ok(existsSync(new URL(`../public/brand/engineering/${kind}.png`, import.meta.url)), kind);
});

test("cloud protection is limited to the gateway-to-gateway route", () => {
  const { paths } = model("cloud");
  assert.deepEqual(paths.map((path) => path.options.secured), [false, true, false]);
  assert.ok(paths[1].points[0][0] < 0 && paths[1].points.at(-1)[0] > 0);
});

test("training illustration includes both endpoints and complete forwarding path", () => {
  const { labels, paths } = model("training");
  assert.deepEqual(labels.map((label) => label.text), ["PC1", "SWITCH", "ROUTER", "PC2"]);
  assert.equal(paths[0].points[0][0], -4.5);
  assert.equal(paths[0].points.at(-1)[0], 4.5);
  assert.ok(paths[0].points.some((point) => point[0] === -1.5));
  assert.ok(paths[0].points.some((point) => point[0] === 1.5));
});

test("wireless model contains an access point and a wired uplink", () => {
  const { view, paths } = model("wifi");
  const devices = [];
  view.root.traverse((object) => { if (object.userData.device) devices.push(object.userData.device); });
  assert.deepEqual(devices, ["wireless-access-point", "network-appliance", "workstation"]);
  assert.equal(paths[0].points.at(-1)[0], -.4);
});

test("scene cleanup disposes screen textures and caption controls do not cover the model", () => {
  const engine = readFileSync(new URL("../src/components/consulting-home/scene-engine.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/app/qcs-theme.css", import.meta.url), "utf8");
  assert.match(engine, /textures\.forEach\(\(texture\) => texture\.dispose\(\)\)/);
  assert.match(css, /\.qcs-scene-controls \{ position: relative;/);
});

test("policy illustration ends denied traffic before the gate without encryption wrappers", () => {
  const { paths } = model("security");
  assert.ok(paths[0].points.at(-1)[0] > 0);
  assert.ok(paths[1].points.at(-1)[0] < 0);
  assert.ok(paths.every((path) => path.options.secured === false));
});
