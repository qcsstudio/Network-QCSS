import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const dir = resolve("public/images/editorial");
mkdirSync(dir, { recursive: true });
const logo = readFileSync("public/brand/quantumcrafters-logo.png").toString("base64");
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const text = (x,y,s,size=24,color="#263445",weight=400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(s)}</text>`;
const box = (x,y,w,h,fill="#fff",stroke="#bdcbd3") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const arrow = (x1,y1,x2,y2,color="red") => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color==="red"?"#93264f":"#186a5d"}" stroke-width="4" marker-end="url(#${color})"/>`;
function start(h,title,desc) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="${h*2}" viewBox="0 0 1200 ${h}" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(desc)}</desc><defs>${["red","green"].map(c=>`<marker id="${c}" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="${c==="red"?"#93264f":"#186a5d"}" stroke-width="2"/></marker>`).join("")}</defs><rect width="1200" height="${h}" fill="#f4f7fa"/><rect width="1200" height="7" fill="#93264f"/><g font-family="Arial, sans-serif"><image x="50" y="24" width="190" height="58" href="data:image/png;base64,${logo}"/>${text(785,60,"QCS / CASE STUDY",18,"#8b244b",700)}`;
}
function save(name,body){const svg=body+"</g></svg>";writeFileSync(resolve(dir,name+".svg"),svg);writeFileSync(resolve(dir,name+".png"),new Resvg(svg,{font:{loadSystemFonts:true,defaultFontFamily:"Arial"}}).render().asPng());}

let e=start(675,"A security update became a reboot trigger","Reported event chain: AV and IPS database update triggers IPS_AV_DB, which invokes an unintended reboot action and interrupts service. Keep legitimate updates; correct the action. Conceptual sequence, not captured logs.");
e+=text(50,146,"The update was legitimate.",43,"#14263b",700)+text(50,204,"The reboot action was unintended.",43,"#93264f",700);
const nodes=[[50,"01 / EVENT","AV / IPS database","update"],[340,"02 / STITCH","IPS_AV_DB","Automation Stitch"],[630,"03 / ACTION","Unintended","reboot"],[920,"04 / IMPACT","Service","interruption"]];
for(const [x,k,a,b] of nodes)e+=box(x,273,230,154)+text(x+16,309,k,18,"#8b244b",700)+text(x+16,356,a,24,"#14263b",700)+text(x+16,391,b,24,"#14263b",700);
for(const x of [280,570,860])e+=arrow(x+5,351,x+48,351);
e+=text(50,495,"Reported cadence: about two hours in this environment.",27,"#14263b",700)+text(50,542,"Not a universal update interval. Not proof of a hardware defect.",23);
e+=box(50,574,1100,58,"#e9f5ef","#9cbdb0")+text(70,612,"KEEP UPDATES     /     CORRECT THE ACTION     /     VERIFY SERVICES",22,"#186a5d",700)+text(50,658,"Conceptual event chain, not a device screenshot or runtime test.",18);
save("fortigate-automation-reboot-evidence",e);

let d=start(800,"Inspect dependencies before changing automation","An update trigger connects to the suspect stitch and unintended reboot action. Check all shared references and targets before a scoped correction. Retain updates and validate subsequent events and business services. Arrows show automation dependencies, not network traffic.");
d+=text(50,140,"Find the action. Check its reach. Correct narrowly.",36,"#14263b",700)+text(50,185,"Arrows represent automation dependencies, not packet paths.",24);
d+=box(50,235,300,120)+text(70,276,"Update trigger",28,"#14263b",700)+text(70,315,"Match the actual event",23);
d+=arrow(355,295,423,295)+box(440,235,310,120)+text(460,276,"Suspect stitch",28,"#14263b",700)+text(460,315,"Check enabled state",23);
d+=arrow(755,295,823,295)+box(840,235,310,120,"#fff2f4","#93264f")+text(860,276,"Reboot action",28,"#93264f",700)+text(860,315,"Read; do not execute",22);
d+=arrow(995,360,995,421)+box(840,440,310,110)+text(860,478,"CHECK BEFORE EDIT",20,"#8b244b",700)+text(860,512,"Shared uses + targets",23);
d+=box(50,440,700,110,"#e9f5ef","#9cbdb0")+text(70,481,"Retain legitimate security updates",29,"#186a5d",700)+text(70,519,"Remove only the confirmed unintended execution path",23);
d+=arrow(835,495,765,495,"green");
d+=arrow(400,555,400,615,"green")+box(50,635,1100,75)+text(70,681,"VERIFY: updates continue + no recurrence + business services healthy",26,"#14263b",700);
d+=text(50,754,"Other stitches and device targets are not inventoried here; inspect the real configuration.",21)+text(50,788,"Conceptual correction plan. No device execution or measured outcome is depicted.",20);
save("fortigate-automation-reboot-dependencies",d);

let s=start(900,"FortiGate reboots every two hours: inspect the automation","Reported FortiGate case: signature updates invoked an unintended reboot action through an Automation Stitch. Correlate evidence, retain updates, correct the action, and verify recovery. The interval and resolution are reported, not independently measured.");
s+=text(55,151,"A reboot every two hours.",51,"#14263b",700)+text(55,214,"The clue was automation.",51,"#93264f",700)+text(55,267,"FortiGate / reported incident, practical investigation",25);
const steps=[["01","CORRELATE","Update events + reboot timing + autod evidence"],["02","INSPECT","Trigger + linked action + shared references"],["03","CORRECT","Keep updates. Remove the unintended reboot path."]];
for(const [i,[n,title,detail]] of steps.entries()){const y=310+i*132;s+=box(55,y,1090,112)+text(80,y+65,n,40,"#93264f",700)+text(158,y+38,title,20,"#186a5d",700)+text(158,y+80,detail,26,"#14263b",700);}
s+=text(55,757,"Warm reboot is a clue, not proof of the cause.",29,"#14263b",700)+text(55,804,"Validate continued updates and the original business service.",25)+text(55,862,"qcsstudio.com / Resources     |     Source-based case study; no runtime test",20);
save("fortigate-automation-reboot-social",s);
