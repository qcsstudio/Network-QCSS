import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import crypto from "node:crypto";
import {spawn} from "node:child_process";
import {getPrismaClient} from "../src/lib/prisma";

async function main() {
  assert(process.env.VERIFYGRID_QA_ISOLATED && crypto.createHash("sha256").update(process.env.DATABASE_URL || "").digest("hex")===process.env.VERIFYGRID_QA_DATABASE_SHA256,"An isolated, pinned database is required");
  const fixture=JSON.parse(await fs.readFile(".vercel/staging-worker.json","utf8"));
  const destination=new URL(fixture.base);
  assert(destination.hostname==="localhost" || (destination.hostname.endsWith('.vercel.app') && process.env.VERIFYGRID_QA_BYPASS));
  const prisma=getPrismaClient();
  const methods:string[]=[];
  const target=http.createServer((req,res)=>{methods.push(req.method||"");res.writeHead(200,{"content-type":"text/plain","x-content-type-options":"nosniff"});res.end("Synthetic isolated target");});
  const proxy=https.createServer({key:await fs.readFile(".vercel/staging-key.pem"),cert:await fs.readFile(".vercel/staging-cert.pem")},(req,res)=>{
    const transport=destination.protocol==='https:'?https:http;
    const upstream=transport.request(fixture.base+req.url,{method:req.method,headers:{...req.headers,host:destination.host,...(process.env.VERIFYGRID_QA_BYPASS?{'x-vercel-protection-bypass':process.env.VERIFYGRID_QA_BYPASS}:{})}},r=>{res.writeHead(r.statusCode||502,r.headers);r.pipe(res);});
    upstream.on("error",()=>{res.writeHead(502);res.end();});req.pipe(upstream);
  });
  try {
    await new Promise<void>(resolve=>target.listen(3199,"127.0.0.1",resolve));
    await new Promise<void>(resolve=>proxy.listen(3443,"127.0.0.1",resolve));
    let output="";
    await new Promise<void>((resolve,reject)=>{
      const child=spawn(process.execPath,["sensor/verifygrid-sensor.mjs"],{windowsHide:true,env:{...process.env,VERIFYGRID_BASE_URL:"https://localhost:3443",VERIFYGRID_SENSOR_TOKEN:fixture.sensorToken,VERIFYGRID_SENSOR_ONCE:"1",VERIFYGRID_SENSOR_REGION:"isolated-staging-lab",NODE_EXTRA_CA_CERTS:path.resolve(".vercel/staging-cert.pem")}});
      const timer=setTimeout(()=>{child.kill();reject(new Error("Worker did not finish within 90 seconds"));},90_000);
      child.stdout.on("data",x=>output+=x);child.stderr.on("data",x=>output+=x);
      child.on("exit",code=>{clearTimeout(timer);code===0?resolve():reject(new Error(`Worker exited ${code}`));});
    });
    const job=await prisma.verifyGridExecutionJob.findUniqueOrThrow({where:{id:fixture.jobId}});
    assert.equal(job.status,"completed",`Worker failed: ${output.slice(-1200)}`);assert(job.resultBatchId);
    assert.deepEqual(methods,["HEAD"]);
    const observations=await prisma.verifyGridObservation.findMany({where:{batchId:job.resultBatchId}});
    assert(observations.length>0);assert(observations.every(o=>o.scopeDisposition==="in_scope"));
    const headers={"content-type":"application/json","user-agent":"VerifyGrid-Isolated-Staging-QA/1.0",cookie:fixture.cookie,...(process.env.VERIFYGRID_QA_BYPASS?{'x-vercel-protection-bypass':process.env.VERIFYGRID_QA_BYPASS}:{})};
    const promoted=await fetch(`${fixture.base}/api/admin/verifygrid/imports/${job.resultBatchId}/promote`,{method:"POST",headers,body:JSON.stringify({minimumSeverity:"informational",includeInformational:true})});
    assert.equal(promoted.status,200,await promoted.text());
    const findings=await prisma.verifyGridFinding.findMany({where:{engagementId:fixture.engagementId},include:{evidence:true}});
    assert(findings.length>0 && findings.every(f=>f.evidence.length>0));
    const replay=await fetch(`${fixture.base}/api/verifygrid/sensor/jobs/result`,{method:"POST",headers:{...headers,authorization:`Bearer ${fixture.sensorToken}`},body:JSON.stringify({jobId:job.id,manifestSha256:job.manifestSha256,contentSha256:"0".repeat(64),content:"replay"})});
    assert.equal(replay.status,400);
    async function api(route:string,body?:unknown,sensor=false,method=body===undefined?"GET":"POST") {
      const r=await fetch(fixture.base+route,{method,headers:{...headers,...(sensor?{authorization:`Bearer ${fixture.sensorToken}`,"x-verifygrid-sensor-capabilities":"http_security_headers"}:{})},body:body===undefined?undefined:JSON.stringify(body)});
      return {status:r.status,data:await r.json()};
    }
    const ep=`/api/admin/verifygrid/engagements/${fixture.engagementId}`;
    const makeJob=async(seconds=1800)=>{
      const r=await api(`${ep}/execution-jobs`,{capability:"http_security_headers",targetIds:job.targetIds,rationale:"Synthetic staging safety race and exclusive deadline validation only.",requestedStartAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+seconds*1000).toISOString(),acknowledgeNonDestructive:true});
      assert.equal(r.status,201,JSON.stringify(r.data));
      assert.equal((await api(`/api/admin/verifygrid/execution-jobs/${r.data.jobId}/queue`,{sensorId:job.sensorId})).status,200);
      const claim=await api("/api/verifygrid/sensor/jobs/claim",{},true);assert.equal(claim.status,200);assert.equal(claim.data.job.id,r.data.jobId);
      return claim.data.job;
    };
    const stopped=await makeJob();
    await Promise.all([api(`${ep}/kill-switch`,{reason:"Synthetic emergency-stop versus retry race; stop all staged execution now."}),api("/api/verifygrid/sensor/jobs/failure",{jobId:stopped.id,manifestSha256:stopped.manifestSha256,error:"Synthetic scanner retry race during emergency cancellation",retryable:true},true)]);
    const stoppedRow=await prisma.verifyGridExecutionJob.findUniqueOrThrow({where:{id:stopped.id}});
    assert.equal(stoppedRow.status,"cancelled");assert.equal(stoppedRow.leaseUntil,null);
    assert.equal((await api("/api/verifygrid/sensor/jobs/heartbeat",{jobId:stopped.id,state:"running"},true)).status,400);
    assert.equal((await api("/api/verifygrid/sensor/jobs/failure",{jobId:stopped.id,manifestSha256:stopped.manifestSha256,error:"Synthetic replay after cancellation",retryable:true},true)).status,400);
    assert.equal((await api(ep,{action:"resume"},false,"PATCH")).status,200);
    const short=await makeJob(90);
    const shortRow=await prisma.verifyGridExecutionJob.findUniqueOrThrow({where:{id:short.id}});
    assert(shortRow.leaseUntil!<=shortRow.validUntil);assert(new Date(short.leaseUntil)<=shortRow.validUntil);
    await prisma.verifyGridExecutionJob.update({where:{id:short.id},data:{validUntil:new Date(Date.now()-1)}});
    assert.equal((await api("/api/verifygrid/sensor/jobs/heartbeat",{jobId:short.id,state:"running"},true)).status,400);
    const foreign=Buffer.from(JSON.stringify({email:"different-parent@verifygrid-staging.example",expiresAt:Date.now()+3600_000})).toString("base64url");
    const foreignSignature=crypto.createHmac("sha256",process.env.ADMIN_SESSION_SECRET!).update(foreign).digest("base64url");
    const mismatched=fixture.cookie.replace(/network_qcss_admin=[^;]+/,`network_qcss_admin=${foreign}.${foreignSignature}`);
    assert.equal((await fetch(fixture.base+ep,{headers:{...headers,cookie:mismatched}})).status,401);
    assert.equal((await fetch(fixture.base+ep,{headers:{...headers,"user-agent":"Different user agent"}})).status,401);
    const evidence={success:true,at:new Date().toISOString(),jobId:job.id,checks:["HTTPS control-plane certificate validated using an isolated CA","Real sensor executes exactly one HEAD on a task-owned target","Result integrity, scope reconciliation and import persist in PostgreSQL","Observation promotion produces findings with evidence","Completed job rejects replay","Emergency stop beats a concurrent retry and rejects later heartbeats/failures","Claim lease is capped at the signed deadline; expired heartbeat rejected","Mismatched administrator/operator identities rejected","Operator session bound to its user agent"],observations:observations.length,findings:findings.length};
    await fs.writeFile(`artifacts/verifygrid-worker-${destination.protocol==='https:'?'cloud':'local'}-results.json`,JSON.stringify(evidence,null,2));
    console.log(JSON.stringify(evidence));
  } finally {proxy.close();target.close();await prisma.$disconnect();}
}
void main().catch(error=>{console.error(error instanceof Error?error.message:"Worker QA failed");process.exitCode=1;});
