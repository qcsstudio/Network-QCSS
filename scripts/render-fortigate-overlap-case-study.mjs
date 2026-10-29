import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const dir = resolve("public/images/editorial");
mkdirSync(dir, { recursive: true });
const logo = readFileSync("public/brand/quantumcrafters-logo.png").toString("base64");
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const text = (x,y,s,size=23,color="#263445",weight=400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(s)}</text>`;
const rect = (x,y,w,h,fill="#fff",stroke="#bdcbd3") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
function start(h,title,desc) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="${h*2}" viewBox="0 0 1200 ${h}" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(desc)}</desc><defs><marker id="green" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="#186a5d" stroke-width="2"/></marker><marker id="red" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="#a32954" stroke-width="2"/></marker></defs><rect width="1200" height="${h}" fill="#f4f7fa"/><rect width="1200" height="7" fill="#93264f"/><g font-family="Arial, sans-serif"><image x="50" y="25" width="190" height="58" href="data:image/png;base64,${logo}"/>${text(770,62,"QCS / NETWORK CASE STUDY",18,"#8b244b",700)}`;
}
function save(name,body){const svg=body+"</g></svg>";writeFileSync(resolve(dir,name+".svg"),svg);writeFileSync(resolve(dir,name+".png"),new Resvg(svg,{font:{loadSystemFonts:true,defaultFontFamily:"Arial"}}).render().asPng());}
let e=start(675,"A DNS answer is not a working application","Reported FortiGate case: direct laptop browsing worked; internal clients failed. A resolver comparison and management-subnet overlap guided the diagnosis. Correction and validation remain recommendations, not claimed results.");
e+=text(50,140,"Ping works. A DNS answer arrives.",38,"#14263b",700)+text(50,193,"Why can browsing still fail?",38,"#93264f",700);
const rows=[
  ["DIRECT LAPTOP","Browsing worked","Different path"],
  ["INTERNAL CLIENTS","Browsing failed","Original problem"],
  ["DNS COMPARISON","Public resolver worked","Internal lookup had timeouts"]
];
for(const [i,[label,result,meaning]] of rows.entries()){
  const y=233+i*91;e+=rect(50,y,1100,76,i===1?"#fff2f4":"#fff")+text(72,y+31,label,18,"#8b244b",700)+text(370,y+45,result,26,"#14263b",700)+text(770,y+45,meaning,21);
}
e+=text(50,555,"Reported diagnosis: management-subnet overlap.",28,"#14263b",700)+text(50,604,"Next: verify routing context, correct safely, then test the real service.",24)+text(50,647,"Evidence summary, not a packet capture. Completed remediation was not reported.",19);
save("fortigate-overlap-evidence",e);

let t=start(800,"Verify the branch, not just the name","Illustrative DNS path goes from Client through FortiGate and Transit Router to DNS Server, with replies on the return path. A dashed branch leads to an overlapping Management Port and is a hypothesis to verify. Addresses are fictional documentation examples.");
t+=text(50,137,"Which interface actually carries the DNS request?",34,"#14263b",700)+text(50,180,"Illustrative routing model. All addresses are examples, not customer data.",23);
const nodes=[[50,"Client","198.51.100.10"],[342,"FortiGate","Check VDOM / VRF"],[634,"Transit Router","Intended next hop"],[926,"DNS Server","192.0.2.53"]];
for(const [x,label,detail] of nodes)t+=rect(x,270,224,118)+text(x+16,313,label,26,"#14263b",700)+text(x+16,355,detail,20);
for(const x of [274,566,858])t+=`<path d="M${x} 300H${x+60}" fill="none" stroke="#186a5d" stroke-width="3" marker-end="url(#green)"/><path d="M${x+68} 367H${x+8}" fill="none" stroke="#186a5d" stroke-width="3" marker-end="url(#green)"/>`;
t+=text(50,236,"INTENDED DNS REQUEST AND REPLY",20,"#186a5d",700);
t+=`<path d="M454 388V510" fill="none" stroke="#a32954" stroke-width="4" stroke-dasharray="9 7" marker-end="url(#red)"/>`;
t+=rect(342,526,330,105,"#fff2f4","#a32954")+text(362,565,"Management Port",27,"#14263b",700)+text(362,602,"192.0.2.1/24 overlap",23,"#8b244b",700);
t+=text(705,480,"HYPOTHESIS TO VERIFY",20,"#8b244b",700)+text(705,522,"Does this assignment compete",22)+text(705,557,"in the same routing context?",22)+text(705,601,"Observe actual egress; do not guess.",21);
t+=text(50,697,"An isolated management table can change the interpretation.",26,"#14263b",700)+text(50,739,"HA, VLAN cabling and internet traffic omitted. No device or packet simulation.",21)+text(50,776,"Protect recovery access before changing an interface address.",22,"#8b244b",700);
save("fortigate-overlap-topology",t);

let s=start(900,"Ping works. Browsing does not.","QCS reported a FortiGate 120G case with partial DNS success and internal browsing failures. Investigation identified management-subnet overlap. Verify the routing context and correct safely; completed post-change success was not reported.");
s+=text(55,152,"Ping works.",62,"#14263b",700)+text(55,225,"Browsing does not.",62,"#93264f",700)+text(55,280,"FortiGate 120G / a QCS troubleshooting case",27);
const steps=[["01","COMPARE","Direct laptop works; internal users fail."],["02","TRACE","Internal DNS times out before answering."],["03","VERIFY","Management-subnet overlap was identified."]];
for(const [i,[n,label,detail]] of steps.entries()){const y=330+i*126;s+=rect(55,y,1090,105)+text(80,y+64,n,38,"#93264f",700)+text(160,y+39,label,20,"#186a5d",700)+text(160,y+78,detail,28,"#14263b",700);}
s+=text(55,757,"Protect management access. Check the actual route.",28,"#14263b",700)+text(55,805,"Correction + application validation are the next steps.",26)+text(55,859,"qcsstudio.com / Resources    |    Reported diagnosis, not a completed retest.",21);
save("fortigate-overlap-social",s);
