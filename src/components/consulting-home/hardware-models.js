import * as THREE from "three";

const colors = { metal: 0xb9c2cd, dark: 0x202b38, blue: 0x285f8f, pink: 0xad2058, paper: 0xf6f8fa };

export function appliance(view, parent, x, z, { accent = colors.blue, ports = 8, y = .55 } = {}) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.userData.device = "network-appliance";
  parent.add(group);
  view.box(group, 0, 0, 0, 2.1, .48, 1.2, colors.metal, .035, .7);
  view.box(group, 0, 0, .62, 2, .38, .045, colors.dark);
  for (let i = 0; i < ports; i++) {
    const px = -.72 + i * (1.44 / Math.max(ports - 1, 1));
    view.box(group, px, -.015, .655, .13, .13, .035, 0x080e15, .008);
    view.box(group, px, .1, .68, .045, .025, .02, i < 3 ? 0x4cbb98 : colors.metal, .004);
  }
  for (let i = 0; i < 7; i++) view.box(group, -.55 + i * .18, .245, -.15, .035, .012, .55, 0x7b8795, .003);
  view.box(group, 0, .25, .35, .38, .02, .13, accent);
  return group;
}

export function serverCabinet(view, parent, x, z, height = 2.4, accent = colors.blue) {
  const group = new THREE.Group();
  group.position.set(x, .15, z);
  group.userData.device = "server-cabinet";
  parent.add(group);
  view.box(group, 0, height / 2, 0, 1.1, height, 1.1, colors.dark, .04, .6);
  [-.5, .5].forEach((px) => view.box(group, px, height / 2, .58, .065, height, .05, colors.metal));
  for (let row = 0; row < 6; row++) {
    const y = .22 + row * ((height - .36) / 6);
    view.box(group, 0, y, .59, .87, height / 8, .06, 0x475566, .012, .6);
    for (let i = 0; i < 5; i++) view.box(group, -.28 + i * .12, y, .63, .035, .09, .015, colors.dark, .002);
    view.box(group, .35, y + .02, .64, .035, .035, .015, row % 2 ? accent : 0x4cbb98, .004);
  }
  view.box(group, 0, height + .015, 0, 1, .03, 1, colors.metal);
  return group;
}

// High-resolution screen content depicts an example, never live telemetry.
export function display(view, parent, x, z, { title = "ENGINEERING CONSOLE", lines = [], accent = colors.blue, width = 3.3, y = 1.65 } = {}) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.userData.device = "workstation";
  parent.add(group);
  const height = width * .65;
  view.box(group, 0, y, 0, width, height, .16, colors.dark, .045, .5);
  view.box(group, 0, (y - height / 2) / 2, -.05, .16, y - height / 2, .2, colors.metal);
  view.box(group, 0, .13, .1, width * .55, .12, .72, colors.metal);
  view.box(group, 0, .12, .86, width * .74, .07, .4, 0xdfe4ea);
  for (let i = 0; i < 10; i++) view.box(group, -width * .3 + i * width / 15, .16, .84, width / 20, .025, .18, 0xb0bbc8, .005);
  const material = new THREE.MeshBasicMaterial({ color: colors.paper });
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 1024; canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#f6f8fa"; ctx.fillRect(0, 0, 1024, 640);
      ctx.fillStyle = `#${accent.toString(16).padStart(6, "0")}`; ctx.fillRect(0, 0, 1024, 110);
      const write = (text, y, size, family) => {
        ctx.font = `bold ${size}px ${family}`;
        while (ctx.measureText(text).width > 936 && size > 16) ctx.font = `bold ${--size}px ${family}`;
        ctx.fillText(text, 44, y);
      };
      ctx.fillStyle = "#ffffff"; write(title, 70, 44, "Arial");
      lines.slice(0, 5).forEach((line, i) => {
        ctx.fillStyle = i % 2 ? "#e9eef3" : "#f6f8fa"; ctx.fillRect(24, 144 + i * 85, 976, 76);
        ctx.fillStyle = "#263b50"; write(line, 195 + i * 85, 40, "Arial");
      });
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      material.map = texture;
    }
  }
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(width - .14, height - .14), material);
  screen.position.set(0, y, .09);
  group.add(screen);
  return group;
}

export function accessPoint(view, parent, x, z) {
  const group = new THREE.Group();
  group.position.set(x, .45, z);
  group.userData.device = "wireless-access-point";
  parent.add(group);
  view.box(group, 0, 0, 0, 1.35, .23, 1.35, colors.paper, .13);
  view.box(group, 0, .13, .3, .28, .018, .045, colors.blue);
  return group;
}
