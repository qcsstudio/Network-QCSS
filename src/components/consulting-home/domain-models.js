import * as THREE from "three";
import { accessPoint, appliance, display, serverCabinet } from "./hardware-models.js";

export const domainModelKinds = ["network", "security", "cloud", "operations", "training", "intelligence", "resources", "assessment", "assurance", "tools", "wifi", "firewall", "troubleshooting"];

export function buildDomainModel(view, kind) {
  const root = view.root;
  const pink = 0xad2058, blue = 0x285f8f, green = 0x19735e;
  const label = (text, x, y, z) => view.label(text, [x, y, z]);
  const route = (points, color = blue, options = {}) => view.cable(points, kind, color, { secured: false, featured: true, ...options });
  const port = (x, z = .65) => [x, .55, z];
  const workstation = (x, z, title, lines, width = 2.5) => display(view, root, x, z, { title, lines, width });
  const animate = [];
  view.domainSpan = 11;
  view.domainHeight = 6.2;
  view.el.dataset.model = kind;
  view.mode = kind;

  if (kind === "network") {
    workstation(-3.8, 0, "BRANCH A", ["Users + applications"], 2);
    appliance(view, root, 0, 0, { ports: 8 });
    serverCabinet(view, root, 3.5, 0, 2.5);
    route([[-3.8, .2, .8], [-3.8, .3, 1.7], [-.5, .3, 1.7], port(-.5)]);
    route([port(.5), [.5, .3, 1.7], [3.5, .3, 1.7], [3.5, .65, .7]], pink);
    label("BRANCH", -3.8, -.35, 1.5);
    label("WAN ROUTER", 0, -.35, 2.1);
    label("SERVER", 3.5, -.35, 1.5);
  } else if (kind === "security" || kind === "firewall") {
    workstation(-3.6, -.3, "CLIENT REQUEST", ["HTTPS / TCP 443", "Unapproved port"], 2.4);
    appliance(view, root, 0, 0, { accent: pink, ports: 6 });
    serverCabinet(view, root, 3.6, 0, 2.5, green);
    route([[-3.6, .4, .7], [-2, .45, .7], port(0), [1.8, .55, .7], [3.6, .6, .65]], green);
    route([[-3.6, .3, 1.5], [-2, .3, 1.5], [-1.2, .3, 1.5]], pink);
    const stop = view.box(root, -1.15, .45, 1.5, .12, .55, .6, pink);
    animate.push((time) => { stop.scale.y = 1 + .04 * Math.sin(time * 2); });
    label("SOURCE", -3.6, -.35, 1.9);
    label("FIREWALL", 0, 1.6, -.15);
    label("ALLOWED", 3.6, -.35, 1.5);
    label("DENIED", -.9, -.5, 2.7);
    if (kind === "firewall") {
      workstation(0, -2.6, "RULE REVIEW", ["Source > destination", "Service / action / log"], 3.3);
      view.domainSpan = 11.5;
      view.domainHeight = 7.2;
    }
  } else if (kind === "cloud") {
    view.plate(root, -3.4, 0, 3.8, 4, 0xedf2f6);
    view.plate(root, 3.2, 0, 4.2, 4, 0xf9edf2);
    serverCabinet(view, root, -3.5, -.75, 2.1);
    appliance(view, root, -2.9, 1, { ports: 4 });
    appliance(view, root, 2.8, 1, { ports: 4, accent: pink });
    serverCabinet(view, root, 3.3, -.75, 2.1, pink);
    route([[-3.5, .5, -.1], [-4.45, .45, .4], [-3.7, .55, 1.65]]);
    route([[-2.1, .55, 1.65], [-1, .7, 2.1], [1, .7, 2.1], [2, .55, 1.65]], pink, { secured: true });
    route([[3.6, .55, 1.65], [4.45, .45, .4], [3.3, .5, -.1]]);
    label("ON-PREMISES", -3.3, -.4, 2.6);
    label("IPSEC VPN", 0, 1.6, 1.8);
    label("CLOUD NETWORK", 3.2, -.4, 2.6);
    view.domainSpan = 12.5;
  } else if (kind === "operations" || kind === "troubleshooting") {
    const triage = kind === "troubleshooting";
    serverCabinet(view, root, -3.6, 0, 2.7);
    appliance(view, root, -.9, .3, { ports: 8 });
    workstation(2.6, -.3, triage ? "PATH DIAGNOSIS" : "SERVICE MONITOR", triage
      ? ["1  Check interface", "2  Compare counters", "3  Test destination", "4  Verify the repair"]
      : ["Interfaces / counters", "Latency / packet loss", "Alert > incident", "Owner > next action"], 3.8);
    route([[-3.6, .6, .65], [-2.2, .4, 1.6], port(-1.4, .95)], blue);
    route([port(-.4, .95), [.4, .4, 1.6], [2.6, .25, 1]], triage ? pink : green);
    if (triage) {
      view.box(root, -.9, 1.1, .5, .3, .3, .3, pink);
      label("SUSPECT LINK", -.9, 2.2, .3);
    } else label("COLLECT", -.9, 1.8, .3);
    label("DEVICES", -3.6, -.3, 1.5);
    label(triage ? "DIAGNOSE / RETEST" : "MONITOR / RESPOND", 2.6, -.3, 1.5);
  } else if (kind === "training") {
    view.domainSpan = 13;
    workstation(-4.5, 0, "PC1", ["Source host"], 1.9);
    appliance(view, root, -1.5, 0, { ports: 8 });
    appliance(view, root, 1.5, 0, { ports: 4, accent: pink });
    workstation(4.5, 0, "PC2", ["Destination host"], 1.9);
    route([[-4.5, .3, .75], [-3, .3, 1.7], port(-1.5), [0, .3, 1.7], port(1.5), [3, .3, 1.7], [4.5, .3, .75]]);
    ["PC1", "SWITCH", "ROUTER", "PC2"].forEach((name, i) => label(name, -4.5 + i * 3, -.4, 2));
  } else if (kind === "wifi") {
    accessPoint(view, root, -.4, -.1);
    appliance(view, root, -3.6, 0, { ports: 8 });
    workstation(3.5, 0, "WIRELESS CLIENT", ["SSID / authentication", "Signal / channel"], 2.7);
    route([port(-3.1), [-2, .35, 1.2], [-.4, .45, .55]]);
    for (let i = 0; i < 3; i++) {
      const wave = new THREE.Mesh(new THREE.TorusGeometry(.9 + i * .43, .025, 6, 48, Math.PI * .75), new THREE.MeshBasicMaterial({ color: blue, transparent: true, opacity: .45 }));
      wave.rotation.x = -Math.PI / 2; wave.rotation.z = -.4; wave.position.set(-.4, .65, -.1); root.add(wave);
      animate.push((time) => { wave.material.opacity = .18 + .32 * ((Math.sin(time * 1.8 - i) + 1) / 2); });
    }
    label("WIRED UPLINK", -3.6, -.3, 1.7);
    label("ACCESS POINT", -.4, -.3, 1.7);
    label("RADIO LINK", 3.5, -.3, 1.7);
  } else if (kind === "assurance") {
    view.plate(root, 1.5, 0, 5.5, 3.7, 0xeaf0f5);
    workstation(-3.5, 0, "AUTHORIZED TEST", ["Agreed assets only", "Methods + stop rules"], 2.7);
    serverCabinet(view, root, .8, 0, 2.5);
    workstation(3.2, 0, "FINDING RECORD", ["Evidence + impact", "Fix + retest"], 2.6);
    route([[-3.5, .3, .8], [-2.2, .3, 1.6], [.8, .5, .7]], pink);
    for (const x of [-1, 4]) for (const z of [-1.5, 1.5]) view.box(root, x, .25, z, .13, .45, .13, pink);
    label("TESTER", -3.5, -.4, 2);
    label("IN SCOPE", .8, -.4, 2);
    label("FINDING / FIX", 3.8, -.4, 2);
    view.domainSpan = 12;
  } else if (kind === "intelligence") {
    workstation(-3.5, 0, "VENDOR BULLETIN", ["Product + versions", "Impact + fixed release"], 3);
    workstation(0, -.6, "EVIDENCE REVIEW", ["Confirm source", "Check applicability", "Separate fact / advice"], 3);
    workstation(3.5, 0, "TECHNICAL BRIEF", ["What changed", "What to do next"], 3);
    route([[-3.5, .2, 1], [-1.7, .2, 1.6], [0, .2, .4]], blue);
    route([[0, .2, .4], [1.7, .2, 1.6], [3.5, .2, 1]], pink);
    label("SOURCE", -3.5, -.4, 2);
    label("VERIFY", 0, -.4, 2);
    label("EXPLAIN", 3.5, -.4, 2);
    view.domainSpan = 13;
  } else if (kind === "assessment") {
    workstation(-2.7, 0, "YOUR ENVIRONMENT", ["Assets + owners", "Access boundaries", "Business dependency"], 4);
    workstation(2.7, 0, "EVIDENCE CHECKLIST", ["Configuration: needed", "Logs: needed", "Priority: to review"], 4);
    route([[-2.7, .2, 1], [-1, .2, 1.7], [1, .2, 1.7], [2.7, .2, 1]], pink);
    label("QUESTIONS", -2.7, -.4, 2);
    label("EVIDENCE", 2.7, -.4, 2);
  } else if (kind === "resources") {
    workstation(-2.6, 0, "TECHNICAL GUIDE", ["Problem + context", "Steps + checks", "Sources + boundaries"], 3.8);
    view.document(root, 2.6, 1.3, 0, blue);
    appliance(view, root, 2.6, 1.1, { ports: 6 });
    label("READ", -2.6, -.4, 2);
    label("APPLY / CHECK", 2.6, -.4, 2);
  } else {
    workstation(-2.6, 0, "DNS LOOKUP EXAMPLE", ["> query example.test", "> type A", "> use an owned target"], 3.8);
    workstation(2.6, 0, "ILLUSTRATIVE OUTPUT", ["Name: example.test", "Type: A", "Address: 192.0.2.10"], 3.8);
    route([[-2.6, .2, 1], [-1, .2, 1.7], [1, .2, 1.7], [2.6, .2, 1]], blue);
    label("QUERY", -2.6, -.4, 2);
    label("ANSWER", 2.6, -.4, 2);
  }
  view.domainMotion = (time) => animate.forEach((update) => update(time));
}
