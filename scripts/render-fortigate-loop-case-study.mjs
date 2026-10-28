import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";

// Original topic-specific diagrams rendered locally, without an image API.
const dir = resolve("public/images/editorial");
mkdirSync(dir, { recursive: true });
const logo = readFileSync("public/brand/quantumcrafters-logo.png").toString("base64");
const esc = (v) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const text = (x, y, value, size = 22, fill = "#263445", weight = 400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${esc(value)}</text>`;
const box = (x, y, w, h, fill = "#fff", stroke = "#b9c6d1") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const line = (x1,y1,x2,y2,color="#247364",dash="") => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-width="5" fill="none" stroke-dasharray="${dash}"/>`;
function arrow(x1,y1,x2,y2,color) {
  const length=Math.hypot(x2-x1,y2-y1), ux=(x2-x1)/length, uy=(y2-y1)/length;
  const x=(x1+x2)/2, y=(y1+y2)/2;
  return `<polygon points="${x+ux*10},${y+uy*10} ${x-ux*8-uy*7},${y-uy*8+ux*7} ${x-ux*8+uy*7},${y-uy*8-ux*7}" fill="${color}"/>`;
}
function start(height, title, desc) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="${height*2}" viewBox="0 0 1200 ${height}" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(desc)}</desc><rect width="1200" height="${height}" fill="#f6f8fb"/><rect width="1200" height="7" fill="#93264f"/><g font-family="Arial, sans-serif"><image x="50" y="25" width="185" height="56" href="data:image/png;base64,${logo}"/>${text(790,61,"QCS / INCIDENT ANALYSIS",19,"#8b244b",700)}`;
}
function save(name, content) {
  const svg=content+"</g></svg>";
  writeFileSync(resolve(dir,name+".svg"),svg);
  writeFileSync(resolve(dir,name+".png"),new Resvg(svg,{font:{loadSystemFonts:true,defaultFontFamily:"Arial"}}).render().asPng());
}
let evidence=start(675,"After the upgrade is not the diagnosis","Reported QCS incident: three switches and nine access points offline. CPU, packet rates and topology were investigated. An access-side loop was corrected; recovery preceded completion of the planned upgrade.");
evidence+=text(50,132,"After the upgrade is not the diagnosis.",36,"#172438",700)+text(50,174,"Trace the evidence before assigning the cause.",25);
const cards=[
  [50,"01 / OBSERVED","3 switches","9 access points","Reported offline"],
  [430,"02 / INVESTIGATED","CPU + packet rates","LLDP + topology","Access-side loop found"],
  [810,"03 / REPORTED RESULT","Loop corrected","Devices restored","Then planned upgrade"]
];
for(const [x,n,a,b,c] of cards){evidence+=box(x,224,340,244,n.startsWith("03")?"#eaf6f2":"#fff")+text(x+23,265,n,18,"#8b244b",700)+text(x+23,317,a,27,"#172438",700)+text(x+23,359,b,25,"#172438",700)+text(x+23,418,c,21);}
evidence+=line(393,345,418,345)+`<polygon points="423,345 413,339 413,351" fill="#247364"/>`+line(773,345,798,345)+`<polygon points="803,345 793,339 793,351" fill="#247364"/>`;
evidence+=text(50,522,"High CPU is a clue. Correlate it with traffic and forwarding state.",25,"#172438",700)+text(50,567,"Reported target: FortiOS 7.6.8. Not proof of a firmware defect or universal fix.",23)+text(50,615,"Conceptual incident sequence, not a customer topology or measured CPU chart.",21);
save("fortigate-loop-evidence",evidence);

let topology=start(800,"An unintended forwarding cycle","Two teaching diagrams. Before isolation, Switch A, B and C form a triangle of forwarding paths. After an approved isolation of the A-to-C fault edge, A-to-B-to-C stays connected. Not the customer's wiring.");
topology+=text(50,133,"Break the proven cycle. Preserve the intended path.",33,"#172438",700)+text(50,176,"Teaching example only: no customer port, cable or AP placement is asserted.",23);
for(const [offset,restored] of [[0,false],[600,true]]){
  topology+=text(60+offset,233,restored?"AFTER / scoped isolation":"BEFORE / unintended cycle",23,restored?"#176557":"#93264f",700);
  const a={x:90+offset,y:315},b={x:350+offset,y:315},c={x:220+offset,y:500};
  topology+=line(a.x+80,a.y+26,b.x,b.y+26)+line(b.x+40,b.y+52,c.x+60,c.y)+line(c.x+20,c.y,a.x+40,a.y+52,restored?"#8a96a4":"#ba3156",restored?"9 8":"");
  if(restored)topology+=line(164+offset,424,190+offset,450,"#93264f")+line(190+offset,424,164+offset,450,"#93264f");
  else topology+=arrow(a.x+130,a.y+26,b.x,b.y+26,"#247364")+arrow(b.x+40,b.y+52,c.x+60,c.y,"#247364")+arrow(c.x+20,c.y,a.x+40,a.y+52,"#ba3156");
  for(const [p,label] of [[a,"Switch A"],[b,"Switch B"],[c,"Switch C"]])topology+=box(p.x,p.y,130,58)+text(p.x+12,p.y+37,label,22,"#172438",700);
  topology+=text(60+offset,609,restored?"All three nodes remain connected.":"Only if these paths all forward",22)+text(60+offset,643,restored?"Repeat service and state checks.":"in the same affected Layer 2 domain.",22);
}
topology+=text(50,709,"A redundant link is not automatically a fault. Confirm dependencies before isolation.",23,"#8b244b",700)+text(50,755,"AP wiring, FortiGate, HA and aggregates omitted. Never reproduce a loop in production.",21);
save("fortigate-loop-topology",topology);

let social=start(750,"High CPU was the clue, not the diagnosis","QCS case: three FortiSwitches and nine FortiAPs reported offline after a firmware change. The team identified an access-side Layer 2 loop, corrected it and reported stable recovery.");
social+=text(50,143,"High CPU was the clue.",46,"#172438",700)+text(50,204,"The access-side loop was the cause.",36,"#93264f",700);
social+=box(50,255,1100,109,"#fff")+text(80,299,"3 FortiSwitches + 9 FortiAPs",34,"#172438",700)+text(80,337,"Reported offline after a firmware change",24);
const steps=[["OBSERVE","CPU state + interface packet rates"],["CORRELATE","Neighbors + switching topology"],["VERIFY","Loop corrected; devices restored"]];
for(const [i,[label,detail]] of steps.entries())social+=text(60,425+i*74,label,20,"#8b244b",700)+text(256,425+i*74,detail,29,"#172438",700);
social+=text(50,655,"QCS case study / Evidence before assumptions",25,"#176557",700)+text(50,705,"Conceptual summary. Not a firmware-defect claim or customer topology.",21);
save("fortigate-loop-social",social);
