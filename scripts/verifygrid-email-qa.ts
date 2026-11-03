import assert from "node:assert/strict";
import fs from "node:fs/promises";
import net from "node:net";
import crypto from "node:crypto";
import {getPrismaClient} from "../src/lib/prisma";

async function main() {
  assert(process.env.VERIFYGRID_QA_ISOLATED && crypto.createHash("sha256").update(process.env.DATABASE_URL||"").digest("hex")===process.env.VERIFYGRID_QA_DATABASE_SHA256,"Isolated database required");
  const base="http://localhost:3100";
  assert.equal(process.env.SMTP_HOST,"127.0.0.1","This suite uses only the local capture server");
  const fixture=JSON.parse(await fs.readFile(".vercel/staging-browser.json","utf8"));
  const messages:string[]=[];
  const capture=net.createServer(socket=>{
    socket.setEncoding("utf8");socket.write("220 local-capture ESMTP\r\n");let input="",data=false,message="";
    socket.on("data",chunk=>{input+=chunk;for(let i;(i=input.indexOf("\r\n"))>=0;){const line=input.slice(0,i);input=input.slice(i+2);
      if(data){if(line==="."){messages.push(message);message="";data=false;socket.write("250 captured\r\n");}else message+=line+"\r\n";continue;}
      if(/^EHLO|^HELO/.test(line))socket.write("250-local-capture\r\n250 AUTH PLAIN\r\n");
      else if(/^AUTH/.test(line))socket.write("235 accepted\r\n");
      else if(/^RCPT TO:/i.test(line))socket.write(/@verifygrid-staging\.example>?$/i.test(line)?"250 accepted\r\n":"550 synthetic recipients only\r\n");
      else if(line==="DATA"){data=true;socket.write("354 end with dot\r\n");}
      else if(line==="QUIT")socket.end("221 bye\r\n");else socket.write("250 OK\r\n");
    }});
  });
  const prisma=getPrismaClient();const email=`intake-${Date.now()}@verifygrid-staging.example`;
  async function api(route:string,body:unknown,admin=false,method="POST") {
    const r=await fetch(base+route,{method,redirect:"manual",headers:{"content-type":body instanceof URLSearchParams?"application/x-www-form-urlencoded":"application/json","user-agent":"VerifyGrid-Isolated-Staging-QA/1.0",...(admin?{cookie:fixture.ownerCookie}:{})},body:body instanceof URLSearchParams?body.toString():JSON.stringify(body)});
    const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={};}return{status:r.status,data,location:r.headers.get("location")};
  }
  const tokenFromLastMail=(prefix:string)=>{
    const decoded=messages.at(-1)!.replace(/=\r?\n/g,"").replace(/=3D/g,"=");
    const token=decoded.match(new RegExp(`${prefix}_[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]{32,}`))?.[0];assert(token,"Expected one-time token in captured MIME message");return token;
  };
  try {
    await new Promise<void>((resolve,reject)=>{capture.once("error",reject);capture.listen(2525,"127.0.0.1",resolve);});
    const intake=await api("/api/verifygrid/onboarding/request",{displayName:"Synthetic Intake Client",email,phone:"+1 202 555 0101",organizationName:`Synthetic Onboarding ${Date.now()}`,serviceType:"web_and_api_vapt",scopeSummary:"Synthetic workflow validation for a task-owned local HTTP test service only.",emergencyContactName:"Synthetic Emergency Owner",emergencyContactEmail:email,contactConsent:true,authorityAcknowledgement:true});
    assert.equal(intake.status,202);assert(!intake.data.verificationUrl);assert.equal(messages.length,1);
    const onboarding=await prisma.verifyGridOnboardingRequest.findFirstOrThrow({where:{email}});
    assert.equal(onboarding.status,"pending_email");
    assert.equal((await api(`/api/admin/verifygrid/onboarding/${onboarding.id}`,{action:"approve"},true,"PATCH")).status,400);
    const verification=tokenFromLastMail("vg_onboard");
    assert.equal((await api("/api/verifygrid/onboarding/verify",{token:verification})).status,200);
    assert.equal((await api("/api/verifygrid/onboarding/verify",{token:verification})).status,400);
    const approved=await api(`/api/admin/verifygrid/onboarding/${onboarding.id}`,{action:"approve",reviewNote:"Synthetic verified onboarding acceptance"},true,"PATCH");
    assert.equal(approved.status,200,JSON.stringify(approved.data));assert.equal(approved.data.emailDelivery,"sent");
    const old=tokenFromLastMail("vg_access");
    const known=await api("/api/portal/request-link",{email});assert.equal(known.status,202);
    const fresh=tokenFromLastMail("vg_access");assert.notEqual(fresh,old);
    const unknown=await api("/api/portal/request-link",{email:"unknown@verifygrid-staging.example"});
    assert.equal(unknown.status,202);assert.deepEqual(unknown.data,known.data);
    const oldAccess=await api("/api/portal/access",new URLSearchParams({token:old}));assert(new URL(oldAccess.location!).search.includes("invalid"));
    const valid=await api("/api/portal/access",new URLSearchParams({token:fresh}));assert.equal(new URL(valid.location!).pathname,"/portal");
    const replay=await api("/api/portal/access",new URLSearchParams({token:fresh}));assert(new URL(replay.location!).search.includes("invalid"));
    const report={success:true,at:new Date().toISOString(),checks:["Public intake persists pending-email record and captures verification mail","Unverified intake cannot be approved","Verification token is single-use","Reviewed intake provisions workspace and captures invitation","Known and unknown passwordless-link requests have the same response","Reissued link revokes previous token; new token is single-use"],capturedMessages:messages.length};
    await fs.writeFile("artifacts/verifygrid-email-local-results.json",JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  } finally {capture.close();await prisma.$disconnect();}
}
void main().catch(error=>{console.error(error instanceof Error?error.message:"Email QA failed");process.exitCode=1;});
