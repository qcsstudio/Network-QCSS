import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import crypto from 'node:crypto';

const root=process.cwd(),testRoot=path.join(root,'test-results');fs.mkdirSync(testRoot,{recursive:true});
const directory=fs.mkdtempSync(path.join(testRoot,'qcs-reviewed-advisory-test-'));
after(()=>{assert.ok(path.resolve(directory).startsWith(path.resolve(testRoot)+path.sep));fs.rmSync(directory,{recursive:true,force:true});});
const candidateRoot=process.env.QCS_REVIEWED_FIXTURE_ROOT;
assert.ok(candidateRoot,'Provide the private exact reviewed candidate directory; tests never use a database.');
const candidateText=fs.readFileSync(path.join(candidateRoot,'qcs-resource-draft.json'),'utf8');
const reviewText=fs.readFileSync(path.join(candidateRoot,'independent-rereview-20261118.json'),'utf8');
const manifest=JSON.parse(fs.readFileSync('src/content/reviewed-advisory-release.json','utf8'));
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const sort=v=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,sort(x)])):v;
const hash=v=>digest(JSON.stringify(sort(v)));
const mediaBytes=Buffer.from('MOCK TEST ASSET: not production evidence');
const mediaHash=digest(mediaBytes);
manifest.origin='https://www.qcsstudio.com';
manifest.assets=['image/jpeg','video/mp4'].map((mimeType,i)=>({key:i?'test-reel':'test-poster',path:`${manifest.assetPathPrefix}/${mediaHash}.${i?'mp4':'jpg'}`,sha256:mediaHash,bytes:mediaBytes.length,mimeType}));
manifest.socialReviewSha256='a'.repeat(64);
manifest.social={};
for(const channel of ['linkedin','facebook','instagram']){
 const asset=manifest.assets[channel==='linkedin'?0:1],caption=`Mock diagnostic caption. ${manifest.canonical}\n#Cisco #Networking #Security #Vulnerability #Patching`,accountId=`test-${channel}`;
 manifest.social[channel]={caption,accountId,assetKey:asset.key,payloadSha256:hash({channel,caption,accountId,assetSha256:asset.sha256,mediaUrl:manifest.origin+asset.path})};
}
fs.mkdirSync(path.join(directory,'src/lib'),{recursive:true});fs.mkdirSync(path.join(directory,'src/content'),{recursive:true});
for(const name of ['domain','store','social','guard','family'])fs.copyFileSync(path.join(root,`src/lib/reviewed-advisory-${name}.ts`),path.join(directory,`src/lib/reviewed-advisory-${name}.ts`));
for(const name of fs.readdirSync(path.join(root,'src/lib')).filter(name=>name.startsWith('automated-advisory-')&&name.endsWith('.ts')).concat(['linkedin-commentary.ts','linkedin-little-text.ts']))fs.copyFileSync(path.join(root,'src/lib',name),path.join(directory,'src/lib',name));
fs.copyFileSync(path.join(root,'src/content/automated-advisory-releases.json'),path.join(directory,'src/content/automated-advisory-releases.json'));
fs.writeFileSync(path.join(directory,'src/content/reviewed-advisory-release.json'),JSON.stringify(manifest));
const domain=await import(pathToFileURL(path.join(directory,'src/lib/reviewed-advisory-domain.ts')));
const store=await import(pathToFileURL(path.join(directory,'src/lib/reviewed-advisory-store.ts')));
const social=await import(pathToFileURL(path.join(directory,'src/lib/reviewed-advisory-social.ts')));
const guard=await import(pathToFileURL(path.join(directory,'src/lib/reviewed-advisory-guard.ts')));
const family=await import(pathToFileURL(path.join(directory,'src/lib/reviewed-advisory-family.ts')));
const guide=domain.parseApprovedGuide(candidateText,reviewText);
const now=()=>new Date().toISOString();
const activation=()=>({deploymentId:'test-deployment',checkedAt:now(),cutoverAt:new Date(Date.now()-7*60000).toISOString(),evidenceSha256:'c'.repeat(64),sources:{checkedAt:now(),ciscoRevision:'1.14',materialChangeFound:false,evidenceSha256:'d'.repeat(64)}});
const escaped=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const mockPublicHtml=()=>`<article data-reviewed-release="${manifest.releaseId}" data-reviewed-candidate="${manifest.candidateSha256}">${manifest.canonical}${domain.expectedReviewedText(guide).map(t=>`<p>${escaped(t)}</p>`).join('')}</article>`;
const fetcher=async url=>url===manifest.canonical?new Response(mockPublicHtml(),{headers:{'content-type':'text/html'}}):new Response(mediaBytes,{headers:{'content-type':url.endsWith('.mp4')?'video/mp4':'image/jpeg'}});

function matches(row,where={}){
 return Object.entries(where).every(([key,value])=>{
  if(key==='AND')return value.every(x=>matches(row,x));
  if(key==='OR')return value.some(x=>matches(row,x));
  if(key==='NOT')return !(Array.isArray(value)?value.some(x=>matches(row,x)):matches(row,value));
  if(value instanceof Date)return row[key]?.getTime()===value.getTime();
  if(value&&typeof value==='object')return Object.entries(value).every(([op,arg])=>op==='not'?row[key]!==arg:op==='in'?arg.includes(row[key]):op==='array_contains'?Array.isArray(row[key])&&arg.every(item=>row[key].includes(item)):op==='contains'?value.mode==='insensitive'?String(row[key]||'').toLowerCase().includes(arg.toLowerCase()):row[key]?.includes(arg):op==='equals'?String(row[key]).toLowerCase()===String(arg).toLowerCase():op==='mode');
  return row[key]===value;
 });
}
function fakeDatabase(){
 const old=new Date('2026-11-18T08:39:22.500Z');
 const advisory={id:'selected',slug:manifest.slug,externalId:manifest.externalId,vendor:'Cisco',status:'published',deletedAt:null,firstSeenAt:old,vendorPublishedAt:old,vendorUpdatedAt:old,updatedAt:old,contentHash:'original-hash',title:'Original title',summary:'Original summary',qualityScore:91,editorialTrace:{preserve:'this'},revisions:[{version:1,payload:{originalSource:'preserve'},contentHash:'original-hash',createdAt:old}]};
 const job={id:'selected-linkedin',channel:'linkedin',contentType:'security_advisory',contentId:'selected',contentRevision:'1',status:'queued',externalId:null,publishedAt:null,createdAt:old,updatedAt:old,nextAttemptAt:old,sourceUrl:manifest.canonical,commentary:'Original queued caption',imageUrl:'original-image',metadata:{preserve:'job'}};
 let state={advisory,jobs:[job,{...job,id:'ccna-native',contentType:'ccna_lesson',contentId:'day60',sourceUrl:'https://www.qcsstudio.com/courses/ccna/lessons/test',status:'held',metadata:{nativeSchedule:'2026-12-07T05:30:00Z'}}],audits:[]};
 let tail=Promise.resolve();
 const db={
  state:()=>structuredClone(state),
  edit:fn=>fn(state),
  $queryRaw:async()=>[],
  securityAdvisory:{
   findUnique:async({where})=>where.id===state.advisory.id?structuredClone(state.advisory):null,
   findUniqueOrThrow:async args=>{const r=await db.securityAdvisory.findUnique(args);assert.ok(r);return r;},
   findMany:async()=>[{id:'selected',slug:manifest.slug,sourceUrl:'https://vendor.example/advisory',cves:familyCves}],
   updateMany:async({where,data})=>{if(!matches(state.advisory,where))return {count:0};Object.assign(state.advisory,structuredClone(data),{updatedAt:new Date()});return {count:1};}
  },
  socialPublication:{
   findMany:async({where})=>structuredClone(state.jobs.filter(j=>matches(j,where))),
   count:async({where})=>state.jobs.filter(j=>matches(j,where)).length,
   findUnique:async({where})=>structuredClone(state.jobs.find(j=>j.id===where.id)||null),
   updateMany:async({where,data})=>{const rows=state.jobs.filter(j=>matches(j,where));for(const j of rows)Object.assign(j,structuredClone(data),{updatedAt:new Date()});return {count:rows.length};},
   create:async({data})=>{const j={...structuredClone(job),...structuredClone(data),id:`created-${state.jobs.length}`};state.jobs.push(j);return structuredClone(j);}
  },
  securityAdvisoryRevision:{create:async({data})=>{state.advisory.revisions.unshift({...structuredClone(data),createdAt:new Date()});return data;}},
  auditLog:{create:async({data})=>{state.audits.push(structuredClone(data));return data;}},
  $transaction:(fn,options)=>{assert.equal(options.isolationLevel,'Serializable');const result=tail.then(async()=>{const before=structuredClone(state);try{return await fn(db);}catch(error){state=before;throw error;}});tail=result.catch(()=>{});return result;}
 };
 return db;
}
async function apply(db){const s=await store.reviewedAdvisorySnapshot('selected',db);return store.applyReviewedAdvisory('selected',{candidateText,reviewText,expectedBaselineSha256:s.baselineSha256,activation:activation()},'test-admin',db,fetcher,'test-deployment');}
const clearance=channel=>({destination:channel,checkedAt:now(),accountId:`test-${channel}`,canonical:manifest.canonical,historyEvidenceSha256:'e'.repeat(64),sourceWindowStart:new Date(Date.now()-73*3600000).toISOString(),completed:true});
const familyCves=['CVE-2026-111497','CVE-2026-105482','CVE-2026-105483','CVE-2026-106069'];
const reserve=(db,channel='linkedin')=>store.reserveReviewedDestination('selected',{channel,manifestSha256:domain.manifestHash,clearance:clearance(channel),activation:activation()},'test-admin',db,fetcher,'test-deployment');

test('accepts only the exact reviewed candidate bytes',()=>{assert.equal(guide.title,JSON.parse(candidateText).post.title);assert.throws(()=>domain.parseApprovedGuide(candidateText+' ',reviewText),/exact/);assert.throws(()=>domain.parseApprovedGuide(candidateText,reviewText+' '),/exact/);});
test('canonical identity guard does not freeze unrelated Cisco records',()=>{assert.throws(()=>domain.assertOutsideReviewedScope({externalId:manifest.externalId.toLowerCase()}),/reserved/);assert.doesNotThrow(()=>domain.assertOutsideReviewedScope({slug:'another-cisco-advisory'}));});
test('stable binding includes actual date values',()=>{assert.notEqual(domain.stableHash({d:new Date(0)}),domain.stableHash({d:new Date(1)}));});
test('requires genuine-current deployment identity, bounded freshness and drain',()=>{assert.doesNotThrow(()=>domain.requireDeploymentActivation(activation(),'test-deployment'));for(const a of [{...activation(),deploymentId:'wrong'},{...activation(),cutoverAt:now()},{...activation(),checkedAt:new Date(Date.now()-6*60000).toISOString()}])assert.throws(()=>domain.requireDeploymentActivation(a,'test-deployment'));});
test('source verification rejects changed, stale and unknown revision',()=>{const s=activation().sources;assert.doesNotThrow(()=>domain.requireSourceVerification(s));for(const v of [{...s,materialChangeFound:true},{...s,ciscoRevision:'1.15'},{...s,checkedAt:'invalid'}])assert.throws(()=>domain.requireSourceVerification(v));});
test('media validates status, MIME, bytes and hashes',async()=>{await domain.verifyReviewedMedia(fetcher);await assert.rejects(domain.verifyReviewedMedia(async()=>new Response('bad',{headers:{'content-type':'image/jpeg'}})));await assert.rejects(domain.verifyReviewedMedia(async()=>new Response(mediaBytes,{status:404})));});
test('content-addressed paths cannot be replaced with arbitrary URLs',()=>{const asset=manifest.assets[0];assert.throws(()=>domain.assetUrl({...asset,path:'/other.jpg'}));assert.throws(()=>domain.assetUrl({...asset,bytes:26*1024*1024}));});
test('exact guide envelope rejects changed guide, review, assets and origin',()=>{const env=domain.newEnvelope(guide,'test',{origin:manifest.origin,assets:manifest.assets});assert.ok(domain.reviewedEnvelope({reviewedGuide:env}));for(const patch of [{guide:{...guide,title:'tampered'}},{reviewSha256:'0'.repeat(64)},{assets:[]},{origin:'https://example.com'}])assert.throws(()=>domain.reviewedEnvelope({reviewedGuide:{...env,...patch}}));});
test('social captions are exact, channel-bound and media-specific',()=>{for(const c of ['linkedin','facebook','instagram'])assert.equal(social.reviewedSocialPayload(c).accountId,`test-${c}`);});
test('receipts require specific platform permalinks and matching post IDs',()=>{assert.throws(()=>social.receiptUrl('instagram','https://www.instagram.com/qcsstudio/'));assert.throws(()=>social.receiptUrl('facebook','https://facebook.com/'));assert.doesNotThrow(()=>social.assertReceiptIdentity('linkedin','https://www.linkedin.com/feed/update/urn:li:activity:123/','123'));assert.throws(()=>social.assertReceiptIdentity('linkedin','https://www.linkedin.com/feed/update/urn:li:activity:123/','124'));assert.doesNotThrow(()=>social.assertReceiptIdentity('instagram','https://www.instagram.com/reel/BA/','64'));assert.throws(()=>social.assertReceiptIdentity('instagram','https://www.instagram.com/reel/BA/','65'));});
test('apply preserves original identity, dates, previous revisions and all unrelated jobs',async()=>{const db=fakeDatabase(),before=db.state();await apply(db);const after=db.state();for(const k of ['id','slug','externalId','firstSeenAt','vendorPublishedAt','vendorUpdatedAt'])assert.deepEqual(after.advisory[k],before.advisory[k]);assert.deepEqual(after.advisory.revisions[1],before.advisory.revisions[0]);assert.deepEqual(after.jobs[1],before.jobs[1]);assert.equal(after.jobs[0].status,'held');for(const k of ['id','commentary','imageUrl','contentRevision','nextAttemptAt'])assert.deepEqual(after.jobs[0][k],before.jobs[0][k]);assert.equal(hash(after.audits[0].metadata.beforeSnapshot.advisory),hash(before.advisory));});
test('stale baseline rolls the entire import back',async()=>{const db=fakeDatabase(),before=db.state();await assert.rejects(store.applyReviewedAdvisory('selected',{candidateText,reviewText,expectedBaselineSha256:'wrong',activation:activation()},'test',db,fetcher,'test-deployment'),/changed/);assert.deepEqual(db.state(),before);});
for(const status of ['publishing','needs_review'])test(`apply holds when selected job is ${status}`,async()=>{const db=fakeDatabase();db.edit(s=>s.jobs[0].status=status);const before=db.state();await assert.rejects(apply(db));assert.deepEqual(db.state(),before);});
test('native schedules and nested interrupted reservations cannot be rewritten',async()=>{for(const metadata of [{nativeOwnership:'linkedin'},{reviewedLocalRelease:{dispatchStartedAt:now()}}]){const db=fakeDatabase();db.edit(s=>s.jobs[0].metadata=metadata);await assert.rejects(apply(db));}});
test('selected future jobs block import rather than shifting their dates',async()=>{const db=fakeDatabase();db.edit(s=>s.jobs[0].nextAttemptAt=new Date(Date.now()+3600000));const before=db.state();await assert.rejects(apply(db));assert.deepEqual(db.state(),before);});
test('confirmed destination cannot be reserved again, even on an older revision',async()=>{const db=fakeDatabase();await apply(db);db.edit(s=>Object.assign(s.jobs[0],{status:'published',externalId:'123',publishedAt:new Date()}));await assert.rejects(reserve(db),/already/);});
test('two concurrent reservations yield exactly one intent and no duplicate',async()=>{const db=fakeDatabase();await apply(db);const results=await Promise.allSettled([reserve(db),reserve(db)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(db.state().jobs.filter(j=>j.contentId==='selected'&&j.channel==='linkedin').length,1);});
test('wrong destination account and stale duplicate proof cannot reserve',async()=>{const db=fakeDatabase();await apply(db);for(const c of [{...clearance('linkedin'),accountId:'wrong'},{...clearance('linkedin'),completed:false},{...clearance('linkedin'),checkedAt:new Date(Date.now()-6*60000).toISOString()}])await assert.rejects(store.reserveReviewedDestination('selected',{channel:'linkedin',manifestSha256:domain.manifestHash,clearance:c,activation:activation()},'test',db,fetcher,'test-deployment'),/wrong destination|wrong.*account|different|reconciliation|destination account/i);});
test('interrupted dispatch stays needs_review; later real matching receipt resolves once',async()=>{const db=fakeDatabase();await apply(db);const r=await reserve(db);await store.markReviewedUncertain('selected',r,'test',db);await assert.rejects(reserve(db),/uncertain/);const input={...r,proof:{kind:'native-publication-observation',channel:'linkedin',observedAt:now(),evidenceSha256:'f'.repeat(64),accountId:'test-linkedin',payloadSha256:r.payloadSha256,platformId:'123',url:'https://www.linkedin.com/feed/update/urn:li:activity:123/',reservationToken:r.dispatchToken,observedCaptionSha256:digest(r.caption),mediaMatched:true}};assert.equal((await store.recordReviewedReceipt('selected',input,'test',db)).status,'published');assert.equal((await store.recordReviewedReceipt('selected',input,'test',db)).alreadyRecorded,true);await assert.rejects(reserve(db),/already/);});
test('reservation preserves queued copy, revision, source and schedule fields',async()=>{const db=fakeDatabase();await apply(db);const before=db.state().jobs[0];await reserve(db);const after=db.state().jobs[0];for(const field of ['id','contentRevision','commentary','imageUrl','sourceUrl','nextAttemptAt'])assert.deepEqual(after[field],before[field]);assert.equal(after.metadata.reviewedLocalRelease.destinationPayload.caption,manifest.social.linkedin.caption);});
test('reservation repeats source and public-render checks',async()=>{const db=fakeDatabase();await apply(db);const input={channel:'linkedin',manifestSha256:domain.manifestHash,clearance:clearance('linkedin'),activation:activation()};input.activation.sources.checkedAt=new Date(Date.now()-3*86400000).toISOString();await assert.rejects(store.reserveReviewedDestination('selected',input,'test',db,fetcher,'test-deployment'),/Fresh primary/);input.activation=activation();await assert.rejects(store.reserveReviewedDestination('selected',input,'test',db,async()=>new Response('Old public page',{headers:{'content-type':'text/html'}}),'test-deployment'),/exact complete/);});
test('backup contains all prior revisions, not only the latest one',async()=>{const db=fakeDatabase();db.edit(s=>s.advisory.revisions.push({version:0,payload:{older:'preserve'},contentHash:'older',createdAt:new Date(0)}));const snapshot=await store.reviewedAdvisorySnapshot('selected',db);assert.equal(snapshot.advisory.revisions.length,2);await apply(db);assert.equal(db.state().audits[0].metadata.beforeSnapshot.advisory.revisions.length,2);});
test('CVE-family content-post jobs block dispatch even with different source URLs',async()=>{const db=fakeDatabase();await apply(db);db.$queryRaw=async()=>[{id:'related-article',slug:'different-path',title:'Related CVE',status:'published'}];db.edit(s=>s.jobs.push({...s.jobs[0],id:'related-post',contentType:'content_post',contentId:'related-article',sourceUrl:'https://www.qcsstudio.com/resources/different-path'}));await assert.rejects(reserve(db),/family/);});
test('receipt observation cannot predate its reservation',async()=>{const db=fakeDatabase();await apply(db);const r=await reserve(db);await assert.rejects(store.recordReviewedReceipt('selected',{...r,proof:{kind:'native-publication-observation',channel:'linkedin',observedAt:new Date(Date.parse(r.dispatchAt)-1000).toISOString(),evidenceSha256:'f'.repeat(64),accountId:'test-linkedin',payloadSha256:r.payloadSha256,platformId:'123',url:'https://www.linkedin.com/feed/update/urn:li:activity:123/',reservationToken:r.dispatchToken,observedCaptionSha256:digest(r.caption),mediaMatched:true}},'test',db),/postdate/);});
test('all generic job filters exclude selected scope and preserve ordinary records',async()=>{const db=fakeDatabase(),where=await guard.reviewedJobExclusion(db);assert.equal(matches(db.state().jobs[0],where),false);assert.equal(matches(db.state().jobs[1],where),true);await assert.rejects(guard.assertOrdinaryAdvisoryJob(db,db.state().jobs[0]));});

test('all CVE case variants share inventory and recovery exclusions without rewriting records',async()=>{
 for(const prefix of ['CVE','CVe','CvE','Cve','cVE','cVe','cvE','cve'])for(const cve of familyCves){
  const alias={id:'legacy-alias',slug:'other-source',externalId:'legacy',sourceUrl:'https://vendor.example/other',cves:[prefix+cve.slice(3)]};
  assert.equal(domain.isReviewedAdvisoryFamily(alias),true);
  assert.equal(matches(alias,family.reviewedFamilyAdvisoryWhere),true);
 }
 const db=fakeDatabase(),alias={id:'legacy-alias',slug:'other-source',externalId:'legacy',sourceUrl:'https://vendor.example/other',cves:['cve-2026-111497']};
 db.securityAdvisory.findMany=async({where})=>[{...db.state().advisory,sourceUrl:'https://vendor.example/advisory',cves:familyCves},alias].filter(row=>matches(row,where));
 db.edit(s=>s.jobs.push({...s.jobs[0],id:'legacy-job',contentId:alias.id,status:'publishing',sourceUrl:'https://www.qcsstudio.com/other',commentary:''}));
 const before=db.state(),snapshot=await store.reviewedAdvisorySnapshot('selected',db);
 assert.ok(snapshot.family.advisories.some(row=>row.id===alias.id));
 assert.ok(snapshot.aliases.some(row=>row.id==='legacy-job'));
 const exclusion=await guard.reviewedJobExclusion(db);
 const recoveryCandidates=db.state().jobs.filter(row=>matches(row,{AND:[exclusion],status:'publishing'}));
 assert.deepEqual(recoveryCandidates,[]);
 await assert.rejects(apply(db),/Reconcile/);
 assert.deepEqual(db.state(),before);
});
test('shared guard rejects late content-post and alternate-advisory aliases',async()=>{const db=fakeDatabase();db.$queryRaw=async()=>[{id:'alias',slug:'alias',title:'Related CVE'}];await assert.rejects(guard.assertOrdinaryAdvisoryJob(db,{contentType:'content_post',contentId:'alias'}),/reserved/);db.securityAdvisory.findUnique=async()=>({slug:'different-vendor',externalId:'different',cves:['CVE-2026-105482']});await assert.rejects(guard.assertOrdinaryAdvisoryJob(db,{contentType:'security_advisory',contentId:'other'}),/reserved/);});
test('public verification rejects marker-only articles without reviewed prose',async()=>{const envelope=domain.newEnvelope(guide,'test',{origin:manifest.origin,assets:manifest.assets});await assert.rejects(domain.verifyPublicReviewedRelease(envelope,async()=>new Response(`<article data-reviewed-release="${manifest.releaseId}" data-reviewed-candidate="${manifest.candidateSha256}">${manifest.canonical} ${familyCves.join(' ')}</article>`,{headers:{'content-type':'text/html'}})),/prose/);});
test('freshness is repeated inside the committing reservation transaction',async()=>{const db=fakeDatabase();await apply(db);const proof=activation(),input={channel:'linkedin',manifestSha256:domain.manifestHash,clearance:clearance('linkedin'),activation:proof};const slowFetch=async url=>{const r=await fetcher(url);if(url.endsWith('.mp4'))proof.checkedAt=new Date(Date.now()-6*60000).toISOString();return r;};await assert.rejects(store.reserveReviewedDestination('selected',input,'test',db,slowFetch,'test-deployment'),/stale/);});
test('scoped workflow contains no generation, generic processing or platform deletion calls',()=>{for(const file of ['src/lib/reviewed-advisory-store.ts','src/app/api/admin/security-advisories/[id]/reviewed-release/route.ts']){const source=fs.readFileSync(file,'utf8');assert.doesNotMatch(source,/processLinkedInQueue|processMetaQueue|createMetaCaption|publishLinkedInPost|deleteLinkedInPost|enrichSecurityAdvisory/);}});
