import * as THREE from "three";

export const domainModelKinds = ["network", "security", "cloud", "operations", "training", "intelligence", "resources", "assessment", "assurance", "tools"];

// A common rendering vocabulary, but a different composition and motion per task.
export function buildDomainModel(view, kind, palette) {
  const root = view.root;
  const pink = palette.green, blue = 0x285f8f, orange = 0xc77b43;
  const box = (x, y, z, w, h, d, color = palette.shell) => view.box(root, x, y, z, w, h, d, color);
  const label = (text, x, y, z) => view.label(text, [x, y, z]);
  const route = (points, color = pink) => view.cable(points, kind, color, { secured: false, featured: true });
  const moving = [];
  view.domainSpan = 10;
  view.domainHeight = 5.8;
  view.el.dataset.model = kind;
  view.mode = kind;

  if (kind === "network") {
    // Three offices form a visible branch-to-hub topology, unlike the hero rack.
    [[-3, 1.7], [0, -2], [3, 1.7]].forEach(([x, z], i) => {
      view.plate(root, x, z, 2, 1.8);
      box(x, 0.85, z, 1.2, 1.4, 0.8);
      for (let n = 0; n < 3; n++) box(x - 0.35 + n * 0.35, 0.95, z + 0.42, 0.17, 0.62, 0.04, blue);
      route([[x, .22, z], [x / 2, .3, z / 2], [0, .3, 0]]);
      label(["BRANCH A", "WAN HUB", "BRANCH B"][i], x, -.25, z + .7);
    });
    box(0, .3, 0, 1.7, .35, 1.2, pink);
  } else if (kind === "security") {
    view.domainSpan = 10.5;
    view.monitor(root, -3.2, 0, palette.dark);
    box(0, 1.6, 0, .38, 3.3, 2.7, palette.shell);
    for (let n = 0; n < 4; n++) box(.23, .55 + n * .65, .5, .05, .22, 1.7, n === 1 ? pink : blue);
    box(3.1, .7, 0, 1.35, 1.2, 1.3, blue);
    route([[-3.2, .5, .3], [-1.2, .5, .3], [1.1, .5, .3], [3.1, .5, .3]], blue);
    route([[-3.2, .35, 1.4], [-1.7, .35, 1.4], [-.5, .35, 1.4]], pink);
    const stop = box(-.48, .55, 1.4, .14, .65, .65, pink);
    moving.push((time) => { stop.scale.y = 1 + .08 * Math.sin(time * 2); });
    label("REQUESTS", -3.2, -.2, 1.5);
    label("POLICY CHECK", 0, 3.5, 0);
    label("ALLOWED", 3.1, -.2, 1.5);
    label("DENIED", -.8, -.2, 2.1);
  } else if (kind === "cloud") {
    view.domainSpan = 11;
    [-2.6, 2.6].forEach((x, i) => {
      view.plate(root, x, 0, 3.7, 3.7, i ? 0xe9f1f7 : 0xf8e9f0);
      [[-.8, -.55], [.8, .55]].forEach(([dx, z], n) => {
        box(x + dx, .65, z, .9, 1.1, .85, n ? palette.shell : blue);
        box(x + dx, 1.25, z, 1.05, .13, 1, i ? orange : pink);
      });
      label(i ? "WORKLOAD ZONE B" : "WORKLOAD ZONE A", x, -.2, 2);
    });
    box(0, 1.6, 0, 1.3, .35, 1.2, palette.shell);
    view.cable([[-2.6, .6, 0], [-1.3, 1.6, 0], [0, 1.6, 0], [1.3, 1.6, 0], [2.6, .6, 0]], kind, blue);
    label("PRIVATE CONNECTION", 0, 2.4, 0);
  } else if (kind === "operations") {
    view.domainSpan = 10;
    box(0, 1.75, 0, 6.7, 3.4, .3, palette.dark);
    for (let n = 0; n < 9; n++) {
      const bar = box(-2.7 + n * .66, 1.2, .25, .32, .8 + (n % 3) * .35, .16, n === 5 ? pink : blue);
      moving.push((time) => { bar.scale.y = .75 + .25 * Math.sin(time * 1.5 + n); });
    }
    box(0, .2, .5, 7.7, .25, 2.8);
    [pink, blue, orange].forEach((color, i) => box(-2.3 + i * 2.3, .42, 1.2, 1.7, .17, .65, color));
    label("SERVICE SIGNALS", 0, 3.8, 0);
    label("OBSERVE", -2.3, -.2, 1.8);
    label("TRIAGE", 0, -.2, 1.8);
    label("RESPOND", 2.3, -.2, 1.8);
  } else if (kind === "training") {
    view.domainSpan = 9.5;
    const colors = [blue, palette.shell, pink, palette.shell, orange];
    colors.forEach((color, i) => {
      const layer = box(-1.8, .3 + i * .45, 0, 2.7, .3, 2.3, color);
      moving.push((time) => { layer.position.x = -1.8 + Math.sin(time * .65 + i * .25) * .12; });
    });
    view.monitor(root, 2.3, .15, palette.dark);
    [0, 1, 2].forEach((n) => box(2.3, 1.22 - n * .18, .28, .8 - n * .12, .045, .025, orange));
    route([[-.45, .25, 0], [.5, .25, .6], [2.3, .25, .6]], blue);
    label("BUILD UNDERSTANDING", -1.8, -.3, 1.7);
    label("TRY AND VERIFY", 2.3, -.3, 1.7);
  } else if (kind === "intelligence") {
    view.domainSpan = 11;
    [-.9, 0, .9].forEach((z, i) => {
      box(-3.4, 1.2, z, 1.3, 1.9, .14, i === 1 ? palette.shell : 0xe8edf5);
      box(-3.4, 1.75, z + .09, .8, .12, .025, i === 1 ? pink : blue);
      route([[-2.8, .3, z], [-1.5, .3, z / 2], [0, .3, 0]], i === 1 ? pink : blue);
    });
    const lens = new THREE.Mesh(new THREE.TorusGeometry(.95, .13, 14, 48), view.material(orange));
    lens.position.set(0, 1.3, 0); root.add(lens);
    box(.7, .5, 0, .2, .95, .2, palette.dark).rotation.z = -.6;
    for (let n = 0; n < 3; n++) box(3.2, .45 + n * .65, 0, 2.1, .42, 1.35, [blue, orange, pink][n]);
    route([[0, .3, 0], [1.5, .3, 0], [3.2, .3, 0]], orange);
    moving.push((time) => { lens.rotation.y = Math.sin(time * .6) * .16; });
    label("OFFICIAL SOURCES", -3.4, -.35, 1.5);
    label("VERIFY CONTEXT", 0, -.35, 1.5);
    label("PRIORITIZE", 3.2, -.35, 1.5);
  } else if (kind === "resources") {
    view.domainSpan = 9;
    box(0, .25, 0, 6.7, .35, 3.5, palette.dark);
    [-1.6, 1.6].forEach((x, index) => {
      const page = box(x, .52, 0, 3.05, .14, 3.15);
      page.rotation.z = index ? -.1 : .1;
      for (let n = 0; n < 5; n++) box(x, .76, -.95 + n * .45, 2.1 - (n % 2) * .55, .035, .055, n === 0 ? pink : palette.metal);
    });
    [pink, blue, orange].forEach((color, i) => box(3.35, .65, -.85 + i * .85, .5, .15, .55, color));
    const cursor = box(-1.6, .82, -.95, 2.25, .03, .22, orange);
    moving.push((time) => { cursor.position.z = -.95 + ((time * .3) % 1) * 1.8; });
    label("PRACTICAL GUIDES", -1.6, -.15, 2.1);
    label("REFERENCE LIBRARY", 1.8, -.15, 2.1);
  } else if (kind === "assessment") {
    view.domainSpan = 9;
    const dial = new THREE.Mesh(new THREE.TorusGeometry(1.55, .22, 16, 56, Math.PI * 1.5), view.material(blue));
    dial.position.set(-1.8, 1.8, 0); root.add(dial);
    const pointer = new THREE.Group(); pointer.position.set(-1.8, 1.8, 0); root.add(pointer);
    view.box(pointer, .55, 0, .15, 1.35, .12, .16, pink);
    moving.push((time) => { pointer.rotation.z = .8 + Math.sin(time * .7) * .5; });
    view.document(root, 2.2, 1.4, 0, blue);
    label("REVIEW READINESS", -1.8, -.3, 1.3);
    label("COLLECT EVIDENCE", 2.2, -.3, 1.3);
  } else if (kind === "assurance") {
    view.domainSpan = 10;
    view.plate(root, -1.8, 0, 4.8, 3.7, 0xe9f1f7);
    for (const x of [-3.7, .1]) for (const z of [-1.4, 1.4]) {
      box(x, .45, z, .14, .65, .14, pink);
      box(x, .76, z, .5, .07, .07, pink);
    }
    box(-1.8, .9, 0, 1.6, 1.5, 1.2, palette.dark);
    const sweep = box(-3.4, .25, 0, .07, .05, 2.6, orange);
    moving.push((time) => { sweep.position.x = -3.4 + ((time * .2) % 1) * 3.2; });
    view.document(root, 3, 1.4, 0, blue);
    label("AUTHORIZED SCOPE", -1.8, -.3, 2.1);
    label("VALIDATED FINDINGS", 3, -.3, 1.4);
  } else {
    view.domainSpan = 10;
    box(-1.7, 1.7, 0, 4.3, 3.2, .25, palette.dark);
    for (let n = 0; n < 5; n++) box(-2.25 + (n % 2) * .2, 2.5 - n * .42, .15, 2.5 - n * .25, .08, .04, n === 4 ? pink : 0xffba87);
    const cursor = box(-.3, .82, .18, .13, .26, .06, pink);
    moving.push((time) => { cursor.scale.y = .6 + .4 * Math.cos(time * 3); });
    [blue, pink, orange].forEach((color, n) => {
      box(2.7, .6 + n * .85, 0, 2.1, .55, 1, palette.shell);
      box(2, .6 + n * .85, .53, .25, .25, .05, color);
      box(2.8, .6 + n * .85, .53, .75, .06, .05, palette.metal);
    });
    label("FOCUSED INPUT", -1.7, -.3, 1.2);
    label("USEFUL OUTPUT", 2.7, -.3, 1.2);
  }

  view.domainMotion = (time) => moving.forEach((animate) => animate(time));
}
