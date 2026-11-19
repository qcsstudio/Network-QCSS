import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const out = resolve("public/images/editorial");
mkdirSync(out, { recursive: true });
const logo = readFileSync("public/brand/quantumcrafters-logo.png").toString("base64");
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const text = (x, y, s, size = 23, color = "#243647", weight = 400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(s)}</text>`;
const rect = (x,y,w,h,fill="#ffffff",stroke="#b8c9d1") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const arrow = (x,y,xx,yy,color="#247766",dash="") => {
  const length=Math.hypot(xx-x,yy-y),ux=(xx-x)/length,uy=(yy-y)/length;
  const bx=xx-ux*12,by=yy-uy*12;
  return `<path d="M${x} ${y} L${bx} ${by}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${dash}"/><polygon points="${xx},${yy} ${bx-uy*6},${by+ux*6} ${bx+uy*6},${by-ux*6}" fill="${color}"/>`;
};
function start(h,title,description) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="${h*2}" viewBox="0 0 1200 ${h}" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(description)}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs><rect width="1200" height="${h}" fill="#f5f8fa"/><rect width="1200" height="7" fill="#92254f"/><g font-family="Arial,sans-serif"><image x="48" y="27" width="185" height="56" href="data:image/png;base64,${logo}"/>${text(785,61,"QCS / CASE STUDY",20,"#92254f",700)}`;
}
function save(name,svg) {
  const source=svg+"</g></svg>";
  writeFileSync(resolve(out,`${name}.svg`),source);
  writeFileSync(resolve(out,`${name}.png`),new Resvg(source,{font:{loadSystemFonts:true,defaultFontFamily:"Arial"}}).render().asPng());
}
let f=start(675,"Online does not mean installed","Conceptual incident sequence: firewall reachable, generated profile contains an incompatible attribute, installation verification fails. The reported model/build is FortiGate 50G on FortiOS 7.6.7 managed by FortiManager 7.6.8.");
f+=text(48,141,"Online does not mean installed.",40,"#152e39",700)+text(48,184,"FortiManager: separate reachability from configuration acceptance.",25);
for(const [x,n,title,lines,fill] of [
  [48,"01 / REACHABILITY","Firewall online",["Management responds.","Not an install verdict."],"#e5f3ee"],
  [430,"02 / GENERATED CLI","Profile mismatch",["Inspect the exact target", "and configuration context."],"#fff"],
  [812,"03 / RESULT","Verification fails",["Read the device response.","Do not blindly retry."],"#fceef1"]
]) f+=rect(x,235,340,245,fill)+text(x+22,276,n,18,"#92254f",700)+text(x+22,330,title,29,"#152e39",700)+text(x+22,388,lines[0],22)+text(x+22,425,lines[1],22);
f+=arrow(392,355,419,355)+arrow(774,355,801,355)+text(48,535,"Reported pairing: FortiManager 7.6.8 / FortiGate 50G / FortiOS 7.6.7",23,"#152e39",700)+text(48,579,"A model-specific finding is not a fleet-wide compatibility guarantee.",23)+text(48,628,"Conceptual evidence map. No customer logs or appliance-runtime result shown.",20);
save("fortimanager-install-evidence",f);

f=start(800,"Follow the generated configuration","Three evidence layers: intended policy and device profile, generated per-device configuration, device acceptance and resulting state. The feedback loop is human review, not automated device execution.");
f+=text(48,137,"Follow the generated configuration.",37,"#152e39",700)+text(48,181,"A policy diff and a device-level preview answer different questions.",24);
const rows=[
  [226,"01","MANAGER INTENT","Package + device profile","Confirm ADOM, revision, target and intended inspection."],
  [387,"02","GENERATED OUTPUT","Per-device Install Preview","Compare the disputed attribute and its enclosing object."],
  [548,"03","DEVICE EVIDENCE","Acceptance + readback","Match the result to this model/build; then test services."]
];
for(const [y,num,label,title,detail] of rows) {
  f+=rect(48,y,1104,130,num==="03"?"#e5f3ee":"#fff")+text(75,y+47,num,31,"#92254f",700)+text(147,y+36,label,17,"#92254f",700)+text(147,y+77,title,28,"#152e39",700)+text(147,y+111,detail,21);
  if(num!=="03")f+=arrow(603,y+135,603,y+157);
}
f+=text(48,728,"Approve a scoped correction. Preserve inspection controls and recovery access.",23,"#92254f",700)+text(48,771,"Arrows show an evidence sequence, not packet flow. No automatic fix is implied.",20);
save("fortimanager-install-flow",f);

let a=start(675,"Backup tunnel available. Site still down.","Three independent observations for ADVPN troubleshooting: transport availability, BGP peer path, application recovery. Do not infer a passing service test from a tunnel-up status.");
a+=text(48,140,"Backup tunnel available. Site still down.",36,"#152e39",700)+text(48,183,"ADVPN failover needs more than one green status.",26);
for(const [x,num,title,l1,l2,color] of [
  [48,"01 / TRANSPORT","IPsec overlay","Is an alternative", "tunnel available?","#e5f3ee"],
  [430,"02 / CONTROL PLANE","BGP peer path","Which path carries", "the peer connection?","#fff"],
  [812,"03 / SERVICE","Application","Does the required", "transaction succeed?","#edf1fa"]
]) a+=rect(x,236,340,245,color)+text(x+22,277,num,18,"#92254f",700)+text(x+22,332,title,28,"#152e39",700)+text(x+22,391,l1,24)+text(x+22,428,l2,24);
a+=text(48,539,"Reported clue: the SLA probe and BGP peer shared one hub destination.",25,"#152e39",700)+text(48,584,"Correlate health checks, kernel routes and observed BGP egress.",24)+text(48,628,"Conceptual checklist, not a packet trace, customer topology or timing measurement.",20);
save("fortigate-advpn-evidence",a);

a=start(800,"Separate destination roles","Before: BGP and health probes address the same hub destination P. After: BGP keeps P and probes use a distinct reachable target H. Only one logical hub is shown. Probe routes can remain after failure; separately verify BGP egress and application recovery.");
a+=text(48,135,"Separate the probe from the peer.",38,"#152e39",700)+text(48,177,"Destination roles only. One logical hub shown; not the customer's topology.",23);
a+=text(48,227,"BEFORE / shared destination",23,"#92254f",700)+text(648,227,"AFTER / distinct destinations",23,"#176557",700);
a+=rect(48,264,230,244)+text(70,310,"Branch",29,"#152e39",700)+text(70,376,"BGP connection",22)+text(70,453,"Health probe",22);
a+=rect(405,315,147,151,"#fceef1")+text(425,354,"Hub",26,"#152e39",700)+text(425,397,"P",38,"#92254f",700)+text(425,438,"One target",20);
a+=arrow(282,369,399,369,"#92254f")+arrow(282,446,399,412,"#92254f","7 5");
a+=rect(648,264,230,244)+text(670,310,"Branch",29,"#152e39",700)+text(670,376,"BGP connection",22)+text(670,453,"Health probe",22);
a+=rect(1005,280,147,113,"#e5f3ee")+text(1023,317,"Hub / P",25,"#152e39",700)+text(1023,357,"BGP peer",20);
a+=rect(1005,418,147,113,"#edf1fa")+text(1023,455,"Hub / H",25,"#152e39",700)+text(1023,495,"Probe target",19);
a+=arrow(882,369,999,339)+arrow(882,446,999,475,"#4167a2","7 5");
a+=text(48,578,"Probe routes can influence",23)+text(48,611,"the peer's path in this condition.",23)+text(648,578,"P and H are different addresses.",23)+text(648,611,"Verify H on each intended overlay.",23);
a+=text(48,681,"Solid arrow: BGP destination role. Dashed arrow: probe destination role.",22,"#152e39",700)+text(48,722,"Arrows are not measured traffic paths. Probe routes may remain after a failure.",21)+text(48,764,"The second hub, overlays and shortcuts are omitted. Validate them separately.",21);
save("fortigate-advpn-roles",a);
