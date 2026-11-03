/** Integration QA only. Requires an explicitly pinned, isolated database.
 * Operator parent sessions are synthetic fixtures except the owner, whose real
 * password login is tested. WebAuthn ceremonies use real challenge verification
 * with a software test authenticator; this does not test a hardware authenticator.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import { getPrismaClient } from "../src/lib/prisma";
import { verifyCustodyEventHash, verifyReportChainSignature } from "../src/lib/verifygrid-assurance-domain";

const base = process.env.VERIFYGRID_QA_BASE || "http://localhost:3100";
const databaseHash = crypto.createHash("sha256").update(process.env.DATABASE_URL || "").digest("hex");
assert(process.env.VERIFYGRID_QA_ISOLATED && process.env.VERIFYGRID_QA_DATABASE_SHA256 === databaseHash,
  "Refusing QA without an explicit isolated database fingerprint");
assert(!new URL(base).hostname.endsWith("qcsstudio.com"), "Production QA is prohibited");
assert(process.env.ADMIN_EMAIL?.endsWith("@verifygrid-staging.example"), "The QA owner must be a synthetic identity");
const prisma = getPrismaClient();
const run = `qa-${Date.now()}`;
const passed: string[] = [];
const incomplete: string[] = [];
const ua = "VerifyGrid-Isolated-Staging-QA/1.0";
const hash = (b: crypto.BinaryLike) => crypto.createHash("sha256").update(b).digest();
const pass = (name: string) => { passed.push(name); console.log(`PASS ${name}`); };
type Client = { cookie: string; };
const anonymous: Client = { cookie: "" };
async function request(client: Client, route: string, body?: unknown, method = body === undefined ? "GET" : "POST", extra: Record<string,string> = {}) {
  const response = await fetch(base + route, { method, redirect: "manual", headers: {
    "user-agent": ua, ...(client.cookie ? { cookie: client.cookie } : {}),
    ...(body === undefined ? {} : {"content-type": body instanceof URLSearchParams ? "application/x-www-form-urlencoded" : "application/json"}),
    ...(process.env.VERIFYGRID_QA_BYPASS ? {"x-vercel-protection-bypass":process.env.VERIFYGRID_QA_BYPASS} : {}), ...extra
  }, body: body === undefined ? undefined : body instanceof URLSearchParams ? body.toString() : JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(";")[0];
    const name = pair.split("=")[0];
    client.cookie = [...client.cookie.split("; ").filter(x => x && !x.startsWith(name + "=")), pair].join("; ");
  }
  const text = await response.text(); let data: any;
  try { data = JSON.parse(text); } catch { data = { html: text }; }
  return { status: response.status, data, location: response.headers.get("location"), headers: response.headers };
}
async function ok(client: Client, route: string, body?: unknown, method?: string) {
  const r = await request(client, route, body, method);
  assert(r.status < 300 && r.data.ok, `${route}: ${r.status}: ${JSON.stringify(r.data).slice(0,500)}`);
  return r.data;
}
// Minimal CBOR encoder for a none-attestation P-256 test authenticator.
function cbor(value: any): Buffer {
  const head = (major: number, n: number) => n < 24 ? Buffer.from([(major << 5) | n]) : n < 256 ? Buffer.from([(major << 5) | 24, n]) : Buffer.from([(major << 5) | 25, n >> 8, n & 255]);
  if (typeof value === "number") return value >= 0 ? head(0,value) : head(1,-1-value);
  if (typeof value === "string") { const b = Buffer.from(value); return Buffer.concat([head(3,b.length),b]); }
  if (Buffer.isBuffer(value)) return Buffer.concat([head(2,value.length),value]);
  if (value instanceof Map) return Buffer.concat([head(5,value.size),...[...value].flatMap(([k,v]) => [cbor(k),cbor(v)])]);
  throw new Error("Unsupported CBOR fixture");
}
function authenticator() {
  const pair = crypto.generateKeyPairSync("ec", { namedCurve:"prime256v1" });
  const jwk = pair.publicKey.export({format:"jwk"});
  const id = crypto.randomBytes(32);
  const cose = cbor(new Map<any,any>([[1,2],[3,-7],[-1,1],[-2,Buffer.from(jwk.x!,"base64url")],[-3,Buffer.from(jwk.y!,"base64url")]]));
  let counter = 0;
  function response(options: any, register: boolean, origin = new URL(base).origin) {
    const clientData = Buffer.from(JSON.stringify({type:register?"webauthn.create":"webauthn.get",challenge:options.challenge,origin,crossOrigin:false}));
    const n = Buffer.alloc(4); n.writeUInt32BE(register?0:++counter);
    const prefix = Buffer.concat([hash(options.rp?.id || options.rpId),Buffer.from([register?0x45:0x05]),n]);
    if(register) {
      const len = Buffer.alloc(2); len.writeUInt16BE(id.length);
      const authData = Buffer.concat([prefix,Buffer.alloc(16),len,id,cose]);
      return {id:id.toString("base64url"),rawId:id.toString("base64url"),type:"public-key",clientExtensionResults:{},response:{
        clientDataJSON:clientData.toString("base64url"),attestationObject:cbor(new Map<any,any>([["fmt","none"],["attStmt",new Map()],["authData",authData]])).toString("base64url"),transports:["internal"]}};
    }
    return {id:id.toString("base64url"),rawId:id.toString("base64url"),type:"public-key",clientExtensionResults:{},response:{
      clientDataJSON:clientData.toString("base64url"),authenticatorData:prefix.toString("base64url"),signature:crypto.sign("sha256",Buffer.concat([prefix,hash(clientData)]),pair.privateKey).toString("base64url")}};
  }
  return {response};
}
function parentFixture(email: string): Client {
  const payload = Buffer.from(JSON.stringify({email,expiresAt:Date.now()+3600_000})).toString("base64url");
  const signature = crypto.createHmac("sha256",process.env.ADMIN_SESSION_SECRET!).update(payload).digest("base64url");
  return {cookie:`network_qcss_admin=${payload}.${signature}`};
}
async function enroll(client: Client, device: ReturnType<typeof authenticator>) {
  const {options} = await ok(client,"/api/admin/verifygrid/security",{action:"registration_options"});
  const response = device.response(options,true);
  await ok(client,"/api/admin/verifygrid/security",{action:"registration_verify",response,label:"Synthetic software authenticator"});
  return response;
}
const mail: string[] = [];
const mailServer = net.createServer(socket => {
  socket.setEncoding("utf8"); socket.write("220 isolated-staging ESMTP\r\n");
  let buffer="",data=false,message="";
  socket.on("data", chunk => {
    buffer+=chunk;
    for(let end; (end=buffer.indexOf("\r\n"))>=0;) {
      const line=buffer.slice(0,end); buffer=buffer.slice(end+2);
      if(data) { if(line===".") {mail.push(message); message="";data=false;socket.write("250 captured\r\n");} else message+=line+"\r\n"; continue; }
      if(/^EHLO|^HELO/.test(line)) socket.write("250-isolated-staging\r\n250 AUTH PLAIN\r\n");
      else if(/^AUTH PLAIN/.test(line)) socket.write("235 authenticated\r\n");
      else if(/^RCPT TO:/i.test(line)) socket.write(/@verifygrid-staging\.example>?$/i.test(line)?"250 accepted\r\n":"550 synthetic recipients only\r\n");
      else if(line==="DATA") {data=true;socket.write("354 end with dot\r\n");}
      else if(line==="QUIT") {socket.end("221 bye\r\n");}
      else socket.write("250 OK\r\n");
    }
  });
});
const review = {decision:"approve",notes:"Independent synthetic review of scope, coverage, traceability, and finding quality.",checklist:{scopeAndAuthority:true,methodologyCoverage:true,evidenceTraceability:true,findingQuality:true}};

async function main() {
try {
  await new Promise<void>((resolve,reject)=>{mailServer.once("error",reject);mailServer.listen(2525,"127.0.0.1",resolve);});
  assert.equal((await request(anonymous,"/api/admin/verifygrid/engagements")).status,401);
  pass("Unauthenticated operator access denied");
  const owner: Client = {cookie:""};
  const login = await request(owner,"/api/admin/login",new URLSearchParams({email:process.env.ADMIN_EMAIL!,password:process.env.ADMIN_PASSWORD!}));
  assert.equal(login.status,303); assert.equal(new URL(login.location!).pathname,"/admin");
  assert.equal((await request(owner,"/api/admin/verifygrid/engagements")).status,401);
  pass("Real administrator login succeeds; password alone cannot access VerifyGrid");
  // Each run gets new secondary fixtures. The bootstrap owner keeps one passkey
  // between runs, so reset only this synthetic owner's QA security records.
  const existingOwner=await prisma.verifyGridOperator.findUnique({where:{email:process.env.ADMIN_EMAIL!},include:{passkeys:{select:{label:true}}}});
  if(existingOwner) {
    assert(existingOwner.passkeys.every(key=>key.label === "Synthetic software authenticator"),"Refusing to reset an authenticator not created by this QA suite");
    await prisma.verifyGridOperatorPasskey.deleteMany({where:{operatorId:existingOwner.id,label:"Synthetic software authenticator"}});
    await prisma.verifyGridOperatorSession.updateMany({where:{operatorId:existingOwner.id,revokedAt:null},data:{revokedAt:new Date()}});
  }
  const ceremonyStartedAt=Date.now();
  const ownerDevice=authenticator(); const enrollment=await enroll(owner,ownerDevice);
  pass("Passkey enrollment verifies RP, origin, challenge, user presence and verification");
  const replay=await request(owner,"/api/admin/verifygrid/security",{action:"registration_verify",response:enrollment});
  assert.equal(replay.status,400); pass("Consumed registration challenge replay rejected");
  const roles: Record<string,Client> = {owner};
  for(const role of ["reviewer","analyst","observer"]) {
    const email=`${role}-${run}@verifygrid-staging.example`;
    await prisma.verifyGridOperator.create({data:{email,displayName:`Synthetic ${role}`,role,createdBy:"isolated-qa"}});
    const client=parentFixture(email); await enroll(client,authenticator()); roles[role]=client;
  }
  const {options:authOptions}=await ok(owner,"/api/admin/verifygrid/security",{action:"authentication_options"});
  const assertion=ownerDevice.response(authOptions,false);
  const authRace=await Promise.all([request(owner,"/api/admin/verifygrid/security",{action:"authentication_verify",response:assertion}),request(owner,"/api/admin/verifygrid/security",{action:"authentication_verify",response:assertion})]);
  assert.deepEqual(authRace.map(r=>r.status).sort(),[200,400]);
  pass("Concurrent passkey assertion replay creates exactly one session");
  await ok(roles.observer,"/api/admin/verifygrid/engagements");
  assert.equal((await request(roles.observer,"/api/admin/verifygrid/engagements",{})).status,401);
  assert.equal((await request(roles.analyst,"/api/admin/verifygrid/engagements",{})).status,401);
  pass("Observer reads allowed; observer and analyst scope creation denied");
  async function engagement(label:string) {
    const r=await ok(owner,"/api/admin/verifygrid/engagements",{organizationName:`Synthetic ${label} ${run}`,primaryContactName:`${label} Client`,primaryContactEmail:`${label.toLowerCase()}@verifygrid-staging.example`,title:`Synthetic ${label} staging assessment`,serviceType:"web_and_api_vapt",scopeSummary:"Task-owned local synthetic HTTP service; no external targets are permitted.",emergencyContactName:"Staging Operator",emergencyContactEmail:"emergency@verifygrid-staging.example",rulesOfEngagement:{prohibitedActions:["Destructive testing and third-party targets"],stopConditions:["Any unexpected target or service impact"],maxRequestsPerSecond:1,noExclusionsConfirmed:true}});
    return r.engagement;
  }
  const alpha=await engagement("Alpha"), beta=await engagement("Beta");
  const ep=`/api/admin/verifygrid/engagements/${alpha.id}`;
  let scoped=await ok(owner,`${ep}/scope`,{targetType:"url",value:"http://127.0.0.1:3199",environment:"lab",ownershipConfirmed:true,permission:"safe_checks"});
  const targetId=scoped.engagement.scopeTargets[0].id;
  const jobInput=()=>({capability:"http_security_headers",targetIds:[targetId],rationale:"Validate a task-owned synthetic HTTP service with non-destructive header checks.",requestedStartAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+30*60_000).toISOString(),acknowledgeNonDestructive:true});
  assert.equal((await request(owner,`${ep}/execution-jobs`,jobInput())).status,400);
  pass("Execution before authorization is rejected");
  await ok(owner,`${ep}/authorize`,{approvedByName:"Synthetic Client Owner",approvedByEmail:"alpha@verifygrid-staging.example",authorityConfirmed:true,validFrom:new Date(Date.now()-60_000).toISOString(),validUntil:new Date(Date.now()+2*3600_000).toISOString(),artifactSha256:hash("Synthetic staging authorization only").toString("hex")});
  await ok(owner,ep,{action:"start"},"PATCH");
  const sensor=await ok(owner,`/api/admin/verifygrid/workspaces/${alpha.workspace.id}/sensors`,{name:`Synthetic sensor ${run}`,capabilities:["http_security_headers"]});
  const sensorHeaders={authorization:`Bearer ${sensor.token}`,"x-verifygrid-sensor-capabilities":"http_security_headers"};
  assert.equal((await request(anonymous,"/api/verifygrid/sensor/jobs/claim",{},"POST",sensorHeaders)).status,200);
  const job=await ok(owner,`${ep}/execution-jobs`,jobInput());
  await ok(owner,`/api/admin/verifygrid/execution-jobs/${job.jobId}/queue`,{sensorId:sensor.sensor.id});
  const claims=await Promise.all([request(anonymous,"/api/verifygrid/sensor/jobs/claim",{},"POST",sensorHeaders),request(anonymous,"/api/verifygrid/sensor/jobs/claim",{},"POST",sensorHeaders)]);
  assert(claims.every(c=>c.status===200));
  const claimed=claims.filter(c=>c.data.job);assert.equal(claimed.length,1);
  pass("Concurrent sensor claims grant exactly one execution lease");
  const claimedJob=claimed[0].data.job;
  await request(anonymous,"/api/verifygrid/sensor/jobs/heartbeat",{jobId:job.jobId,state:"running"},"POST",sensorHeaders).then(r=>assert.equal(r.status,200));
  const firstStart=(await prisma.verifyGridExecutionJob.findUniqueOrThrow({where:{id:job.jobId}})).startedAt;
  await request(anonymous,"/api/verifygrid/sensor/jobs/heartbeat",{jobId:job.jobId,state:"running"},"POST",sensorHeaders).then(r=>assert.equal(r.status,200));
  const running=await prisma.verifyGridExecutionJob.findUniqueOrThrow({where:{id:job.jobId}});
  assert.equal(running.startedAt?.getTime(),firstStart?.getTime());assert(running.leaseUntil!<=running.validUntil);
  pass("Heartbeat preserves start time and stays within authorized deadline");
  // Scope mutation races a heartbeat; final durable state must stay cancelled.
  await Promise.all([ok(owner,`${ep}/scope`,{targetType:"url",value:"http://127.0.0.1:3199",environment:"lab",ownershipConfirmed:true,permission:"safe_checks",notes:"Changed synthetic scope version"}),request(anonymous,"/api/verifygrid/sensor/jobs/heartbeat",{jobId:job.jobId,state:"running"},"POST",sensorHeaders)]);
  const cancelled=await prisma.verifyGridExecutionJob.findUniqueOrThrow({where:{id:job.jobId}});
  assert.equal(cancelled.status,"cancelled"); assert.equal(cancelled.leaseUntil,null);
  assert.equal((await request(anonymous,"/api/verifygrid/sensor/jobs/heartbeat",{jobId:job.jobId,state:"running"},"POST",sensorHeaders)).status,400);
  pass("Scope-change/heartbeat race cannot revive a cancelled job");
  const badContent="tampered synthetic result";
  assert.equal((await request(anonymous,"/api/verifygrid/sensor/jobs/result",{jobId:job.jobId,manifestSha256:claimedJob.manifestSha256,contentSha256:"0".repeat(64),content:badContent},"POST",sensorHeaders)).status,400);
  pass("Tampered sensor result rejected");
  // Reauthorize after rescoping and run a real worker in a separate QA step.
  await ok(owner,`${ep}/authorize`,{approvedByName:"Synthetic Client Owner",approvedByEmail:"alpha@verifygrid-staging.example",authorityConfirmed:true,validFrom:new Date(Date.now()-60_000).toISOString(),validUntil:new Date(Date.now()+2*3600_000).toISOString(),artifactSha256:hash("Synthetic renewed authorization").toString("hex")});
  await ok(owner,ep,{action:"start"},"PATCH");
  const workerJob=await ok(owner,`${ep}/execution-jobs`,jobInput());
  await ok(owner,`/api/admin/verifygrid/execution-jobs/${workerJob.jobId}/queue`,{sensorId:sensor.sensor.id});
  await fs.writeFile(".vercel/staging-worker.json",JSON.stringify({base,sensorToken:sensor.token,jobId:workerJob.jobId,engagementId:alpha.id,workspaceId:alpha.workspace.id,cookie:owner.cookie}));
  // Complete a separate report-only tenant with explicitly documented N/A
  // methodology; this is workflow test data, never assessment proof.
  const bp=`/api/admin/verifygrid/engagements/${beta.id}`;
  await ok(owner,`${bp}/scope`,{targetType:"url",value:"http://127.0.0.1:3199",environment:"lab",ownershipConfirmed:true});
  await ok(owner,`${bp}/authorize`,{approvedByName:"Synthetic Beta Owner",approvedByEmail:"beta@verifygrid-staging.example",authorityConfirmed:true,validFrom:new Date(Date.now()-60_000).toISOString(),validUntil:new Date(Date.now()+2*3600_000).toISOString(),artifactSha256:hash("Synthetic beta authorization").toString("hex")});
  for(const test of beta.testCases) await ok(roles.analyst,`/api/admin/verifygrid/test-cases/${test.id}`,{status:"not_applicable",resultSummary:"Synthetic workflow fixture only. No assessment conclusion: this test is outside the local HTTP header validation scope."},"PATCH");
  const report=await ok(owner,`${bp}/reports`,{reportType:"technical"});
  const reportRow=await prisma.verifyGridReport.findUniqueOrThrow({where:{id:report.reportId}});
  assert.equal((reportRow.qualityGate as any).canApprove,true);
  assert.equal((await request(owner,`/api/admin/verifygrid/reports/${report.reportId}/review`,review)).status,400);
  pass("Report author cannot self-approve when independent operators exist");
  await ok(roles.reviewer,`/api/admin/verifygrid/reports/${report.reportId}/review`,review);
  const releaseBody={acknowledgeImmutableRelease:true,releaseNote:"Synthetic staging report release for integrity and tenant isolation validation."};
  const releaseRace=await Promise.all([request(roles.reviewer,`/api/admin/verifygrid/reports/${report.reportId}/release`,releaseBody),request(roles.reviewer,`/api/admin/verifygrid/reports/${report.reportId}/release`,releaseBody)]);
  assert.deepEqual(releaseRace.map(r=>r.status).sort(),[200,400]);
  const final=await prisma.verifyGridReport.findUniqueOrThrow({where:{id:report.reportId}});
  assert(verifyReportChainSignature(final.chainHash!,final.signature!,final.signingPublicKey!));
  assert.equal((await request(roles.reviewer,`/api/admin/verifygrid/reports/${report.reportId}/review`,review)).status,400);
  pass("Independent review releases an Ed25519-verifiable report; final review mutation denied");
  const events=await prisma.verifyGridCustodyEvent.findMany({where:{engagementId:beta.id},orderBy:{sequence:"asc"}});
  let previous:string|null=null;
  for(const event of events){assert.equal(event.previousHash,previous);assert(verifyCustodyEventHash({engagementId:event.engagementId,sequence:event.sequence,eventType:event.eventType,subjectType:event.subjectType,subjectId:event.subjectId,action:event.action,actor:event.actor,sourceSha256:event.sourceSha256,previousHash:event.previousHash,classification:event.classification,occurredAt:event.occurredAt.toISOString(),details:event.details},event.eventHash));previous=event.eventHash;}
  pass("Report custody sequence and hash chain recompute correctly");
  const invite=await ok(owner,`/api/admin/verifygrid/workspaces/${alpha.workspace.id}/memberships`,{email:"alpha@verifygrid-staging.example",displayName:"Synthetic Alpha Client",role:"client_viewer"});
  const deferEmail=process.env.VERIFYGRID_QA_DEFER_EMAIL==="1";
  if(deferEmail) incomplete.push("Cloud capture mailbox delivery remains untested; test access token supplied by authorized administrator API");
  else {assert.equal(invite.emailDelivery,"sent");if(process.env.SMTP_HOST==="127.0.0.1") assert(mail.length>=1);}
  const token=new URLSearchParams(new URL(invite.accessUrl).hash.slice(1)).get("token")!;
  const client:Client={cookie:""};
  const access=await request(client,"/api/portal/access",new URLSearchParams({token}));assert.equal(new URL(access.location!).pathname,"/portal");
  const replayAccess=await request(anonymous,"/api/portal/access",new URLSearchParams({token}));assert(new URL(replayAccess.location!).search.includes("invalid"));
  assert.equal((await request(client,`/api/portal/reports/${report.reportId}`)).status,404);
  pass(deferEmail?"Administrator-supplied one-time access and cross-tenant report denial":"Synthetic SMTP delivery, one-time access, and cross-tenant report denial");
  const betaInvite=await ok(owner,`/api/admin/verifygrid/workspaces/${beta.workspace.id}/memberships`,{email:"beta@verifygrid-staging.example",role:"client_viewer"});
  const betaClient:Client={cookie:""}; const betaToken=new URLSearchParams(new URL(betaInvite.accessUrl).hash.slice(1)).get("token")!;
  await request(betaClient,"/api/portal/access",new URLSearchParams({token:betaToken}));
  const download=await ok(betaClient,`/api/portal/reports/${report.reportId}`);assert.equal(download.report.signature,final.signature);
  await ok(owner,`/api/admin/verifygrid/memberships/${betaInvite.membership.id}`,{reason:"Synthetic staging membership revocation validation"},"PATCH");
  assert.equal((await request(betaClient,`/api/portal/reports/${report.reportId}`)).status,401);
  pass("Own-tenant final report access succeeds; membership revocation invalidates session");
  const stale=await ok(owner,`${bp}/reports`,{reportType:"technical"});
  await ok(roles.reviewer,`/api/admin/verifygrid/reports/${stale.reportId}/review`,review);
  await ok(owner,`${bp}/scope`,{targetType:"url",value:"http://127.0.0.1:3199",environment:"lab",ownershipConfirmed:true,notes:"Changed after report approval"});
  assert.equal((await request(roles.reviewer,`/api/admin/verifygrid/reports/${stale.reportId}/release`,releaseBody)).status,400);
  pass("Scope change after review blocks stale report release");
  const draft=await ok(owner,`${ep}/reports`,{reportType:"technical"});
  assert.equal((await request(roles.reviewer,`/api/admin/verifygrid/reports/${draft.reportId}/review`,review)).status,400);
  pass("Incomplete coverage and active execution block report approval");
  // A slow cloud run can consume most of the critical-action freshness window.
  // Renew through the real ceremony before handing off to the email/worker suites.
  // Wait for the ordinary ceremony rate window to age out; do not weaken it.
  if(Date.now()-ceremonyStartedAt >= 5*60_000) {
    const {options}=await ok(owner,"/api/admin/verifygrid/security",{action:"authentication_options"});
    await ok(owner,"/api/admin/verifygrid/security",{action:"authentication_verify",response:ownerDevice.response(options,false)});
  }
  const browserInvite=await ok(owner,`/api/admin/verifygrid/workspaces/${beta.workspace.id}/memberships`,{email:"browser@verifygrid-staging.example",displayName:"Synthetic browser reviewer",role:"client_viewer"});
  const browserToken=new URLSearchParams(new URL(browserInvite.accessUrl).hash.slice(1)).get("token");
  await fs.writeFile(".vercel/staging-browser.json",JSON.stringify({base,ownerCookie:owner.cookie,alphaId:alpha.id,betaId:beta.id,reportId:report.reportId,accessToken:browserToken}));
} catch(error) {
  console.error("FAIL",error instanceof Error?error.message:"Unknown QA failure");process.exitCode=1;
} finally {
  await fs.mkdir("artifacts",{recursive:true});
  await fs.writeFile(`artifacts/verifygrid-staging-${new URL(base).protocol==='https:'?'cloud':'local'}-results.json`,JSON.stringify({run,base,at:new Date().toISOString(),databaseFingerprint:databaseHash,passed,success:!process.exitCode && !incomplete.length,incomplete,limitations:["Software test authenticator; native hardware ceremony not exercised","Secondary parent identity sessions are synthetic fixtures",process.env.VERIFYGRID_QA_DEFER_EMAIL==='1'?"Cloud email delivery untested":`SMTP captured by ${process.env.SMTP_HOST==='127.0.0.1'?'local sink':'Ethereal test mailbox'}; no external delivery`]},null,2));
  mailServer.close(); await prisma.$disconnect();
}
}
void main();
