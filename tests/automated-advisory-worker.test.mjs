import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {transform} from 'esbuild';
import * as domain from '../src/lib/automated-advisory-domain.ts';
import {syntheticRelease,bindSyntheticRelease,syntheticRuntime,syntheticMediaBytes,syntheticSourceBody} from './helpers/automated-release-fixture.mjs';
import {publishAutomatedLinkedIn} from '../src/lib/automated-advisory-linkedin.ts';

// Every receipt, account and publication in this file is an in-memory fixture.
// There is no production URL fetch, credential read, real review or database.
const require=createRequire(import.meta.url);
const code=await transform(await fs.readFile(new URL('../src/lib/automated-advisory-worker.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs',supported:{'dynamic-import':false}});
function load(releases){
 const m={exports:{}};
 const mockDomain={...domain,validateRelease:(value,options)=>domain.validateRelease(JSON.parse(JSON.stringify(value)),options?JSON.parse(JSON.stringify(options)):undefined),getAutomatedReleases:()=>releases,getAutomatedReleaseCatalog:()=>({activation:'enabled',releases})};
 const mocks={
  './automated-advisory-domain.ts':mockDomain,
  './automated-advisory-configuration.ts':{automatedAdvisoriesEnabled:env=>env.QCS_REVIEWED_ADVISORIES_ENABLED==='1'},
  './linkedin-commentary.ts':{assertLinkedInProtocol:v=>v},
  './automated-advisory-linkedin.ts':{automatedLinkedInConnection:async()=>({accountId:'synthetic-member-id',status:'connected',scope:'w_member_social',expiresAt:new Date(Date.now()+3600000)}),publishAutomatedLinkedIn:async()=>{throw new Error('Unexpected platform call');},ReviewedLinkedInError:class extends Error{}},
  './automated-advisory-transports.ts':{createAutomatedMetaTransport:()=>({verifyAccounts:async()=>({pageId:'428759466975905',instagramId:'17841468939564779'})})}
 };
 vm.runInNewContext(code.code,{module:m,exports:m.exports,require:id=>Object.hasOwn(mocks,id)?mocks[id]:require(id),process:{env:{}},Buffer,URL,Date,AbortSignal,fetch:()=>{throw new Error('Live fetch forbidden');},setTimeout,clearTimeout},{filename:'automated-advisory-worker.ts'});
 return m.exports;
}
function database(){
 let state={advisories:[],posts:[],jobs:[],nearby:[],recentAdmissions:[],writes:[],audits:[],race:false,failReceipt:false};
 const externalChanges=[];
 const client={get state(){return state;},
  beforeUpdate:null,
  onCadence:null,
  externalChange:fn=>{fn(state);externalChanges.push(fn);},
  $queryRaw:async()=>structuredClone(state.posts),
  advisorySource:{upsert:async()=>{state.writes.push('new_source');return {id:'fixture-source'};}},
  securityAdvisory:{findMany:async query=>{
   if(query?.where?.createdBy)return structuredClone(state.recentAdmissions);
   let rows=state.advisories.filter(row=>(!query?.where?.id?.in||query.where.id.in.includes(row.id))&&(!query?.where?.id?.gt||row.id>query.where.id.gt)).toSorted((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
   if(query?.take)rows=rows.slice(0,query.take);return structuredClone(rows);
  },create:async({data})=>{const row={id:'fixture-advisory',...data};state.advisories.push(row);state.writes.push('new_advisory');return structuredClone(row);}},
  securityAdvisoryRevision:{create:async()=>{state.writes.push('new_revision');return {id:'fixture-revision'};}},
  socialPublication:{
   findMany:async query=>{if(query.select&&client.onCadence)await client.onCadence();return structuredClone(query.select?state.nearby:query.where?.id?state.jobs.filter(j=>j.id===query.where.id):state.jobs);},
   create:async({data})=>{const row={id:`fixture-job-${data.channel}`,externalId:null,publishedAt:null,nextAttemptAt:new Date(),updatedAt:new Date(),...data};state.jobs.push(row);state.writes.push('new_job');return structuredClone(row);},
   updateMany:async({where,data})=>{
    if(client.beforeUpdate)await client.beforeUpdate({where,data});
    const job=state.jobs.find(j=>j.id===where.id&&j.status===where.status&&j.externalId===where.externalId&&['channel','contentType','contentId','contentRevision'].every(key=>where[key]===undefined||j[key]===where[key])&&(!where.updatedAt||j.updatedAt.getTime()===where.updatedAt.getTime()));
    if(!job)return {count:0};
    if(where.metadata&&job.metadata.automatedAdvisory.dispatchToken!==where.metadata.equals)return {count:0};
    if(data.status==='publishing'&&state.race)return {count:0};
    if(data.status==='published'&&state.failReceipt){state.failReceipt=false;throw new Error('Synthetic receipt-storage failure');}
    Object.assign(job,data,{updatedAt:new Date(Math.max(Date.now(),job.updatedAt.getTime()+1))});state.writes.push(data.status||'checkpoint');return {count:1};
   }
  },
  auditLog:{create:async({data})=>{state.writes.push('audit');state.audits.push(structuredClone(data));return {id:'fixture-audit'};}},
  $transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'Serializable');const before=structuredClone(state),externalStart=externalChanges.length;try{return await fn(client);}catch(error){state=before;for(const change of externalChanges.slice(externalStart))change(state);throw error;}}
 };
 return client;
}
const noFetch=async()=>{throw new Error('Live fetch forbidden');};
function hooks(r,counter){return {
 verifyBytes:async()=>({verifiedAt:new Date().toISOString(),candidateSha256:domain.automatedCandidateHash(r),sourceHashes:r.sources.map(s=>s.bodySha256),assetHashes:r.assets.map(a=>a.sha256),runtime:syntheticRuntime(r)}),
 verifyPublic:async()=>({checkedAt:new Date().toISOString(),htmlSha256:'a'.repeat(64),canonical:domain.automatedCanonicalUrl(r.slug)}),
 publish:async(_release,channel,boundary)=>{await boundary.beforePublish();await boundary.checkpoint({stage:'dispatching',publishAttempted:true});await boundary.beforePublish();counter.count++;return {externalId:`fixture-${channel}`,permalink:`https://example.invalid/${channel}`};}
};}
async function setup(){const r=syntheticRelease(),worker=load([r]),db=database(),counter={count:0},h=hooks(r,counter);await worker.importAutomatedAdvisory(r,db,noFetch,h);return {r,worker,db,counter,h};}

test('Disabled or empty pipeline cannot query/write/publish anything',async()=>{
 const db=database(),worker=load([]);
 assert.equal((await worker.runAutomatedAdvisories({client:db,env:{}})).status,'held');
 assert.equal((await worker.runAutomatedAdvisories({client:db,env:{QCS_REVIEWED_ADVISORIES_ENABLED:'1'}})).status,'idle');
 assert.equal(db.state.writes.length,0);
});
test('Prospective import creates only its own advisory, revision and three held exact jobs',async()=>{
 const {r,db,counter}=await setup();
 assert.equal(db.state.advisories.length,1);assert.equal(db.state.jobs.length,3);assert.equal(counter.count,0);
 for(const j of db.state.jobs){assert.equal(j.status,'held');assert.equal(j.commentary,r.social[j.channel].caption);assert.equal(j.metadata.automatedAdvisory.candidateSha256,domain.automatedCandidateHash(r));}
});
test('Import is idempotent and does not update already owned content/jobs',async()=>{
 const {r,worker,db,h}=await setup(),before=JSON.stringify(db.state);
 const result=await worker.importAutomatedAdvisory(r,db,noFetch,h);assert.equal(result.alreadyImported,true);assert.equal(JSON.stringify(db.state),before);
});
for(const kind of ['advisory','post','job'])test(`Existing unrelated ${kind} ownership prevents import with no writes`,async()=>{
 const r=syntheticRelease(),worker=load([r]),db=database(),h=hooks(r,{count:0});
 if(kind==='advisory')db.state.advisories.push({id:'old',slug:r.slug,status:'published',contentHash:'old',editorialTrace:{}});
 if(kind==='post')db.state.posts.push({id:'old'});
 if(kind==='job')db.state.jobs.push({id:'old',channel:'instagram',status:'queued'});
 const before=JSON.stringify(db.state);await assert.rejects(worker.importAutomatedAdvisory(r,db,noFetch,h));assert.equal(JSON.stringify(db.state),before);
});
test('An existing nearby reservation is not moved to make room',async()=>{
 const r=syntheticRelease(),worker=load([r]),db=database();db.state.nearby.push({id:'course-reservation',sourceUrl:'https://www.qcsstudio.com/courses/ccna/lessons/original'});
 const before=JSON.stringify(db.state);await assert.rejects(worker.importAutomatedAdvisory(r,db,noFetch,hooks(r,{count:0})));assert.equal(JSON.stringify(db.state),before);
});
test('Rolling-day admission is capped at two new families, without altering old records',async()=>{
 const r=syntheticRelease(),worker=load([r]),db=database();db.state.recentAdmissions=[{id:'prior-one'},{id:'prior-two'}];
 const before=JSON.stringify(db.state);await assert.rejects(worker.importAutomatedAdvisory(r,db,noFetch,hooks(r,{count:0})));assert.equal(JSON.stringify(db.state),before);
});
test('Each channel claims once before transmission and stores a separate receipt',async()=>{
 const {r,worker,db,counter,h}=await setup();
 for(const channel of ['linkedin','facebook','instagram']){
  const result=await worker.dispatchAutomatedDestination(r,'fixture-advisory',channel,db,noFetch,h);
  assert.equal(result.status,'published');assert.equal(db.state.jobs.find(j=>j.channel===channel).externalId,`fixture-${channel}`);
 }
 assert.equal(counter.count,3);
 const before=JSON.stringify(db.state);await worker.dispatchAutomatedDestination(r,'fixture-advisory','instagram',db,noFetch,h);assert.equal(counter.count,3);assert.equal(JSON.stringify(db.state),before);
});
test('Concurrent claim failure makes no platform call',async()=>{
 const {r,worker,db,counter,h}=await setup();db.state.race=true;
 await assert.rejects(worker.dispatchAutomatedDestination(r,'fixture-advisory','facebook',db,noFetch,h));assert.equal(counter.count,0);
});
test('Post-dispatch failure stays needs_review and cannot be retried',async()=>{
 const {r,worker,db,counter,h}=await setup();h.publish=async()=>{counter.count++;throw Object.assign(new Error('Synthetic ambiguous transport'),{videoId:'12345',publishAttempted:true});};
 const result=await worker.dispatchAutomatedDestination(r,'fixture-advisory','facebook',db,noFetch,h);assert.equal(result.status,'needs_review');
 const job=db.state.jobs.find(j=>j.channel==='facebook');assert.equal(job.status,'needs_review');assert.equal(job.metadata.automatedAdvisory.transportDetails.videoId,'12345');
 await assert.rejects(worker.dispatchAutomatedDestination(r,'fixture-advisory','facebook',db,noFetch,h));assert.equal(counter.count,1);
});
test('A receipt-write failure never permits another publication',async()=>{
 const {r,worker,db,counter,h}=await setup();db.state.failReceipt=true;
 const result=await worker.dispatchAutomatedDestination(r,'fixture-advisory','instagram',db,noFetch,h);assert.equal(result.status,'needs_review');
 const job=db.state.jobs.find(j=>j.channel==='instagram');assert.equal(job.metadata.automatedAdvisory.uncommittedReceipt.externalId,'fixture-instagram');
 await assert.rejects(worker.dispatchAutomatedDestination(r,'fixture-advisory','instagram',db,noFetch,h));assert.equal(counter.count,1);
});
test('Changed exact job payload or existing unconfirmed ID holds without publishing',async()=>{
 for(const mutate of [j=>j.commentary='changed',j=>j.externalId='unconfirmed',j=>j.metadata.automatedAdvisory.candidateSha256='b'.repeat(64)]){
  const {r,worker,db,counter,h}=await setup();mutate(db.state.jobs.find(j=>j.channel==='linkedin'));
  await assert.rejects(worker.dispatchAutomatedDestination(r,'fixture-advisory','linkedin',db,noFetch,h));assert.equal(counter.count,0);
 }
});
test('Actual source/media fetches must match exact reviewed byte hashes',async()=>{
 const r=syntheticRelease(),worker=load([r]);
 const fetcher=async url=>{
  if(url===r.sources[0].url)return new Response(syntheticSourceBody,{headers:{'content-type':'text/html'}});
  const asset=r.assets.find(a=>domain.automatedAssetUrl(a)===url);assert.ok(asset);return new Response(syntheticMediaBytes(asset.key),{headers:{'content-type':asset.mimeType}});
 };
 const result=await worker.verifyAutomatedReleaseBytes(r,fetcher);assert.equal(result.runtime.accounts.instagram.accountId,'17841468939564779');
 await assert.rejects(worker.verifyAutomatedReleaseBytes(r,async()=>new Response('changed source')));
});

for(const mutate of [j=>j.nextAttemptAt=new Date(Date.now()+3600000),j=>j.metadata.nativeScheduleId='existing',j=>j.metadata.automatedAdvisory.nativeOwner='existing'])test('Future or native reservations in any destination block the entire family',async()=>{
 const {r,worker,db,counter,h}=await setup();mutate(db.state.jobs.find(j=>j.channel==='instagram'));
 const before=JSON.stringify(db.state);await assert.rejects(worker.dispatchAutomatedDestination(r,'fixture-advisory','linkedin',db,noFetch,h));
 assert.equal(counter.count,0);assert.equal(JSON.stringify(db.state),before);
});

test('Whole-family canonical matching catches case, tracking, trailing slash and encoded aliases',async()=>{
 const r=syntheticRelease(),worker=load([r]),url=new URL(r.sources[0].url);
 for(const sourceUrl of [r.sources[0].url+'?utm_source=prior',url.origin+url.pathname.toUpperCase()+'/',url.origin+url.pathname.replace(/([a-z])/i,letter=>'%'+letter.charCodeAt(0).toString(16))]){
  const client={securityAdvisory:{findMany:async query=>{assert.equal(query.take,256);assert.equal(query.select.content,undefined);assert.equal(query.where,undefined);return [{id:'foreign-alias',slug:'different',externalId:'different',cves:[],sourceUrl},{id:'unrelated',sourceUrl:url.origin+'/different/path'}];}}};
  assert.deepEqual(JSON.parse(JSON.stringify(await worker.automatedFamilyAdvisoryIds(client,[r]))),[{id:'foreign-alias'}]);
 }
});

test('A source-only content-post alias is included in the database query without loading bodies',async()=>{
 const r=syntheticRelease(),worker=load([r]);let query;
 const result=await worker.automatedFamilyPosts({$queryRaw:async(strings,pattern)=>{query={sql:strings.join('?'),pattern};return [{id:'alias-post'}];}},[r]);
 assert.match(query.sql,/SELECT "id"/);assert.match(query.sql,/content/);assert.ok(query.pattern.includes('(?:'));
 assert.deepEqual(JSON.parse(JSON.stringify(result)),[{id:'alias-post'}]);
});

test('Evidence expiring during media preparation prevents the actual publish boundary',async()=>{
 const {r,worker,db,h}=await setup();let submissions=0,boundaryError;const originalNow=Date.now,current=Date.now();
 h.publish=async(_release,_channel,boundary)=>{
  await boundary.checkpoint({stage:'prepared',publishAttempted:false,videoId:'12345'});
  Date.now=()=>current+16*60000;
  try{await boundary.beforePublish();}catch(error){boundaryError=error;throw error;}
  submissions++;throw new Error('Unreachable');
 };
 let result;try{result=await worker.dispatchAutomatedDestination(r,'fixture-advisory','facebook',db,noFetch,h);}finally{Date.now=originalNow;}
 assert.equal(result.status,'needs_review');assert.equal(submissions,0);
 assert.match(boundaryError.message,/reconciliation.*stale/i);
 assert.equal(db.state.jobs.find(j=>j.channel==='facebook').metadata.automatedAdvisory.transportProgress.videoId,'12345');
});

test('Concurrent native ownership acquired while uploading prevents submission',async()=>{
 const {r,worker,db,h}=await setup();let submissions=0;
 h.publish=async(_release,_channel,boundary)=>{db.state.jobs.find(j=>j.channel==='instagram').metadata.nativeScheduleId='new-reservation';await boundary.beforePublish();submissions++;throw new Error('Unreachable');};
 assert.equal((await worker.dispatchAutomatedDestination(r,'fixture-advisory','linkedin',db,noFetch,h)).status,'needs_review');assert.equal(submissions,0);
 assert.equal(db.state.jobs.find(j=>j.channel==='instagram').metadata.nativeScheduleId,'new-reservation');
});

test('Lost dispatch token blocks the final boundary without replacing the new owner',async()=>{
 const {r,worker,db,h}=await setup();let submissions=0;
 h.publish=async(_release,_channel,boundary)=>{db.state.jobs.find(j=>j.channel==='linkedin').metadata.automatedAdvisory.dispatchToken='different';await boundary.beforePublish();submissions++;throw new Error('Unreachable');};
 assert.equal((await worker.dispatchAutomatedDestination(r,'fixture-advisory','linkedin',db,noFetch,h)).status,'needs_review');assert.equal(submissions,0);
 assert.equal(db.state.jobs.find(j=>j.channel==='linkedin').metadata.automatedAdvisory.dispatchToken,'different');
});

test('Accepted identity and preparation IDs are durable before transport returns',async()=>{
 const {r,worker,db,h}=await setup();
 h.publish=async(_release,_channel,boundary)=>{
  await boundary.checkpoint({stage:'prepared',publishAttempted:false,imageAssetId:'urn:li:image:fixture'});
  assert.equal(db.state.jobs.find(j=>j.channel==='linkedin').metadata.automatedAdvisory.transportProgress.imageAssetId,'urn:li:image:fixture');
  await boundary.beforePublish();await boundary.checkpoint({stage:'accepted',publishAttempted:true,imageAssetId:'urn:li:image:fixture',externalId:'urn:li:share:12345'});
  throw Object.assign(new Error('Readback interrupted'),{externalId:'urn:li:share:12345'});
 };
 assert.equal((await worker.dispatchAutomatedDestination(r,'fixture-advisory','linkedin',db,noFetch,h)).status,'needs_review');
 const release=db.state.jobs.find(j=>j.channel==='linkedin').metadata.automatedAdvisory;
 assert.equal(release.transportProgress.externalId,'urn:li:share:12345');assert.equal(release.transportDetails.externalId,'urn:li:share:12345');
});

test('Default-port and percent-encoded-host aliases cannot be filtered out before canonical matching',async()=>{
 const r=syntheticRelease(),url=new URL(r.sources[0].url),aliases=[url.origin+':443'+url.pathname,'https://%'+url.hostname.charCodeAt(0).toString(16)+url.hostname.slice(1)+url.pathname];
 for(const sourceUrl of aliases){
  const worker=load([r]),db=database();db.state.advisories.push({id:'older-record',slug:'unrelated-slug',externalId:'unrelated-id',cves:[],sourceUrl,status:'published',contentHash:'old',editorialTrace:{}});
  assert.equal(domain.matchesAutomatedFamily(db.state.advisories[0],r),true);
  assert.equal((await worker.automatedFamilyAdvisoryIds(db,[r]))[0].id,'older-record');
  await assert.rejects(worker.importAutomatedAdvisory(r,db,noFetch,hooks(r,{count:0})));
  assert.equal(db.state.advisories.length,1);assert.equal(db.state.jobs.length,0);assert.equal(db.state.writes.length,0);
 }
});

test('Complete metadata pagination includes a family beyond the first page',async()=>{
 const r=syntheticRelease(),worker=load([r]),db=database();
 db.state.advisories=Array.from({length:257},(_,index)=>({id:'row-'+String(index).padStart(6,'0'),slug:'unrelated',externalId:'unrelated',cves:[],sourceUrl:index===256?r.sources[0].url:'https://example.invalid/'+index}));
 assert.equal((await worker.automatedFamilyAdvisoryIds(db,[r]))[0].id,'row-000256');
});

test('A non-advancing metadata page is a hold, never duplicate clearance',async()=>{
 const r=syntheticRelease(),worker=load([r]),rows=Array.from({length:256},(_,index)=>({id:'row-'+index}));
 await assert.rejects(worker.automatedFamilyAdvisoryIds({securityAdvisory:{findMany:async()=>rows}},[r]),/did not progress/);
});

test('Source-only content-post aliases include alternate normalized authorities without article transfer',async()=>{
 const r=syntheticRelease(),worker=load([r]),url=new URL(r.sources[0].url),aliases=[url.origin+':443'+url.pathname,'https://%'+url.hostname.charCodeAt(0).toString(16)+url.hostname.slice(1)+url.pathname,url.origin+url.pathname.replace(/\//g,'%2f')+'?utm_source=prior'];
 for(const sourceUrl of aliases){
  const client={$queryRaw:async(strings,pattern)=>{assert.match(strings.join('?'),/SELECT "id"/);const matches=new RegExp(pattern,'i').test(JSON.stringify({references:[sourceUrl]}));return matches?[{id:'source-alias'}]:[];}};
  assert.equal((await worker.automatedFamilyPosts(client,[r]))[0].id,'source-alias');
 }
});

test('Selected-row native ownership survives final-boundary failure without any job rewrite',async()=>{
 const {r,worker,db,h}=await setup();let submitted=0;
 h.publish=async(_release,_channel,boundary)=>{const selected=db.state.jobs.find(j=>j.channel==='linkedin');selected.metadata.nativeScheduleId='preserve-native';selected.updatedAt=new Date(selected.updatedAt.getTime()+1);await boundary.beforePublish();submitted++;throw new Error('Unreachable');};
 assert.equal((await worker.dispatchAutomatedDestination(r,'fixture-advisory','linkedin',db,noFetch,h)).status,'needs_review');
 const selected=db.state.jobs.find(j=>j.channel==='linkedin');assert.equal(selected.metadata.nativeScheduleId,'preserve-native');assert.equal(selected.status,'publishing');assert.equal(submitted,0);
 assert.equal(db.state.audits.at(-1).action,'advisory.automated_dispatch_conflict');
});

test('An operator hold during receipt return is preserved with a separate durable accepted receipt',async()=>{
 const {r,worker,db,h}=await setup();
 h.publish=async(_release,_channel,boundary)=>{await boundary.checkpoint({stage:'accepted',publishAttempted:true,externalId:'urn:li:share:12345'});const selected=db.state.jobs.find(j=>j.channel==='linkedin');selected.metadata.operatorHold='preserve-operator';selected.updatedAt=new Date(selected.updatedAt.getTime()+1);return {externalId:'urn:li:share:12345',permalink:'https://www.linkedin.com/feed/update/urn:li:share:12345/'};};
 assert.equal((await worker.dispatchAutomatedDestination(r,'fixture-advisory','linkedin',db,noFetch,h)).status,'needs_review');
 const selected=db.state.jobs.find(j=>j.channel==='linkedin');assert.equal(selected.metadata.operatorHold,'preserve-operator');assert.equal(selected.status,'publishing');
 assert.equal(db.state.audits.at(-1).metadata.uncommittedReceipt.externalId,'urn:li:share:12345');
});

for(const status of ['published','needs_review'])test(`A ${status} version conflict never falls back to stale metadata`,async()=>{
 const {r,worker,db,h}=await setup();let raced=false;
 db.beforeUpdate=async({data})=>{if(data.status===status&&!raced){raced=true;const selected=db.state.jobs.find(j=>j.channel==='facebook');selected.metadata.operatorHold='concurrent-hold';selected.updatedAt=new Date(selected.updatedAt.getTime()+1);}};
 h.publish=async()=>{if(status==='needs_review')throw Object.assign(new Error('Interrupted transport'),{videoId:'12345'});return {externalId:'12345',permalink:'https://example.invalid/accepted'};};
 assert.equal((await worker.dispatchAutomatedDestination(r,'fixture-advisory','facebook',db,noFetch,h)).status,'needs_review');
 const selected=db.state.jobs.find(j=>j.channel==='facebook');assert.equal(selected.metadata.operatorHold,'concurrent-hold');assert.equal(selected.status,'publishing');assert.equal(raced,true);
 assert.equal(db.state.audits.at(-1).metadata.reason,'destination_version_changed');
});

test('Actual LinkedIn transport rejects ownership acquired during the second authorization cadence await',async()=>{
 const r=syntheticRelease();
 r.social.linkedin.caption=['Vendor advisory: review the affected service.','','What Changed','The vendor published revised security guidance.','','Why It Matters','Exposure depends on the installed version and enabled service.','','Action And Verification','1. Identify installed versions.','2. Compare the official affected conditions.','3. Back up before a controlled fix.','4. Verify the service after the change.','Verification: Record the installed version and the expected service response.','',`QCS technical brief: ${domain.automatedCanonicalUrl(r.slug)}`,'','#NetworkSecurity #SecurityAdvisory #Vulnerability #PatchManagement #QCS'].join('\n');
 bindSyntheticRelease(r);
 const worker=load([r]),db=database(),h=hooks(r,{count:0});await worker.importAutomatedAdvisory(r,db,noFetch,h);
 let cadenceReads=0,posts=0;
 db.onCadence=async()=>{if(++cadenceReads===3)db.externalChange(state=>{const selected=state.jobs.find(j=>j.channel==='linkedin');selected.metadata.nativeScheduleId='arrived-during-final-cadence';selected.updatedAt=new Date(selected.updatedAt.getTime()+1);});};
 const asset=r.assets.find(a=>a.key==='linkedin'),fetcher=async(url,options={})=>{
  if(url.includes('initializeUpload'))return Response.json({value:{uploadUrl:'https://www.linkedin.com/dms-uploads/synthetic',image:'urn:li:image:synthetic'}});
  if(url===domain.automatedAssetUrl(asset))return new Response(syntheticMediaBytes('linkedin'),{headers:{'content-type':'image/jpeg'}});
  if(url.includes('/dms-uploads/'))return new Response('',{status:200});
  if(url==='https://api.linkedin.com/rest/posts'){posts++;assert.equal(options.method,'POST');return new Response('',{status:201,headers:{'x-restli-id':'urn:li:share:12345'}});}
  throw new Error('Unexpected synthetic endpoint');
 };
 h.publish=async(_release,_channel,boundary)=>publishAutomatedLinkedIn({accountId:r.social.linkedin.accountId,caption:r.social.linkedin.caption,imageUrl:domain.automatedAssetUrl(asset),alt:asset.alt},{accountId:r.social.linkedin.accountId,accessToken:'SYNTHETIC-NEVER-A-REAL-TOKEN',expiresAt:new Date(Date.now()+3600000),scope:'w_member_social',status:'connected'},fetcher,undefined,boundary);
 assert.equal((await worker.dispatchAutomatedDestination(r,'fixture-advisory','linkedin',db,noFetch,h)).status,'needs_review');
 assert.equal(cadenceReads,3);assert.equal(posts,0);
 assert.equal(db.state.jobs.find(j=>j.channel==='linkedin').metadata.nativeScheduleId,'arrived-during-final-cadence');
});

test('Changed content type after acceptance remains untouched with accepted receipt in the conflict audit',async()=>{
 const {r,worker,db,h}=await setup();
 h.publish=async(_release,_channel,boundary)=>{await boundary.checkpoint({stage:'accepted',publishAttempted:true,externalId:'urn:li:share:12345'});const selected=db.state.jobs.find(j=>j.channel==='linkedin');selected.contentType='content_post';selected.updatedAt=new Date(selected.updatedAt.getTime()+1);return {externalId:'urn:li:share:12345',permalink:'https://www.linkedin.com/feed/update/urn:li:share:12345/'};};
 assert.equal((await worker.dispatchAutomatedDestination(r,'fixture-advisory','linkedin',db,noFetch,h)).status,'needs_review');
 const selected=db.state.jobs.find(j=>j.channel==='linkedin');assert.equal(selected.contentType,'content_post');assert.equal(selected.status,'publishing');
 assert.equal(db.state.audits.at(-1).metadata.uncommittedReceipt.externalId,'urn:li:share:12345');
});
