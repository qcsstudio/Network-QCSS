import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

let assets, calls, fail;
const now = new Date();
const advisories = [
  { id: "ordinary", priorityScore: 40, vendorPublishedAt: now, updatedAt: now, revisions: [{version:1}] },
  { id: "urgent", priorityScore: 100, vendorPublishedAt: now, updatedAt: now, revisions: [{version:2}] }
];
const prisma = {
  contentPost: { findMany: async () => [] },
  securityAdvisory: { findMany: async () => advisories },
  editorialImage: {
    createMany: async ({data, skipDuplicates}) => {
      assert.equal(skipDuplicates, true);
      for (const item of data) if (!assets.some(a=>a.contentId===item.contentId && a.contentRevision===item.contentRevision)) assets.push({...item,updatedAt:now,agentTrace:null});
    },
    findMany: async () => assets,
    updateMany: async ({where,data}) => { Object.assign(assets.find(a=>a.contentId===where.contentId && a.contentRevision===where.contentRevision),data); }
  }
};
globalThis.__imageQueue = { prisma, run: async job => {calls.push(job); if(fail)throw new Error('bad revision');return {status:'ready'};} };
const hook=registerHooks({resolve(specifier,context,next){
  if(context.parentURL?.endsWith('/editorial-image-queue.ts')) {
    if(specifier==='./prisma.ts')return {url:'data:text/javascript,export const getPrismaClient=()=>globalThis.__imageQueue.prisma',shortCircuit:true};
    if(specifier==='./editorial-image-generation.ts')return {url:'data:text/javascript,export const ensureEditorialImageForPublication=job=>globalThis.__imageQueue.run(job)',shortCircuit:true};
  }
  return next(specifier,context);
}});
const {discoverEditorialImageJobs,processEditorialImageQueue}=await import('../src/lib/editorial-image-queue.ts');
function reset(){assets=[];calls=[];fail=false;}
test('discovery durably queues every current revision without paid generation or social jobs',async()=>{reset();await discoverEditorialImageJobs();await discoverEditorialImageJobs();assert.equal(assets.length,2);assert.equal(calls.length,0);assert.equal(assets.find(a=>a.contentId==='urgent').contentRevision,'2');});
test('worker chooses critical advisory independently and attempts only one image',async()=>{reset();const r=await processEditorialImageQueue();assert.equal(r.contentId,'urgent');assert.equal(calls.length,1);});
test('ready current artwork is retained and never auto-regenerated',async()=>{reset();assets=[{contentId:'urgent',contentType:'security_advisory',contentRevision:'2',status:'ready',updatedAt:now}];const r=await processEditorialImageQueue();assert.equal(r.contentId,'ordinary');});
test('failed paid renders require explicit manual retry and do not starve other images',async()=>{reset();assets=[{contentId:'urgent',contentType:'security_advisory',contentRevision:'2',status:'failed',agentTrace:{renderAttempts:1},updatedAt:new Date(0)}];assert.equal((await processEditorialImageQueue()).contentId,'ordinary');});
test('active generation lease is not selected by another worker',async()=>{reset();assets=[{contentId:'urgent',contentType:'security_advisory',contentRevision:'2',status:'generating',updatedAt:now}];assert.equal((await processEditorialImageQueue()).contentId,'ordinary');});
test('preparation failure is saved for one image and next invocation reaches other jobs',async()=>{reset();fail=true;assert.equal((await processEditorialImageQueue()).status,'failed');assert.equal(assets.find(a=>a.contentId==='urgent').status,'failed');fail=false;assert.equal((await processEditorialImageQueue()).contentId,'ordinary');});
test('explicit selection does not generate an unrelated image',async()=>{reset();assert.equal((await processEditorialImageQueue('missing')).status,'idle');assert.equal(calls.length,0);});
test.after(()=>{hook.deregister();delete globalThis.__imageQueue;});
