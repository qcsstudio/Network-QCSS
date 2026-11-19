import {createHash,randomUUID} from 'node:crypto';
import type {Prisma,PrismaClient} from '@prisma/client';
import {getAutomatedReleases,getAutomatedReleaseCatalog,validateRelease,matchesAutomatedFamily,automatedCandidateHash,automatedStableHash,automatedAssetUrl,type ApprovedAdvisoryRelease,type AutomatedAdmissionRechecks} from './automated-advisory-domain.ts';
import {automatedLinkedInConnection,publishAutomatedLinkedIn,ReviewedLinkedInError} from './automated-advisory-linkedin.ts';
import {automatedAdvisoriesEnabled} from './automated-advisory-configuration.ts';
import {assertLinkedInProtocol} from './linkedin-commentary.ts';
export {automatedAdvisoriesEnabled} from './automated-advisory-configuration.ts';

const channels=['linkedin','facebook','instagram'] as const;
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const digest=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
const fail=(message:string):never=>{throw new Error(message);};
const canonical=(r:ApprovedAdvisoryRelease)=>`https://www.qcsstudio.com/security-advisories/${r.slug}`;
const escape=(v:string)=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const internalPriority={critical:100,high:80,medium:50,low:20,informational:10,unknown:50};
function safeTransportReferences(value:Record<string,unknown>|DispatchProgress){
  return Object.fromEntries(['containerId','videoId','imageAssetId','externalId'].flatMap(key=>{
    const id=(value as Record<string,unknown>)[key];
    return typeof id==='string'&&(/^[1-9]\d{0,39}$/.test(id)||/^urn:li:(?:image|share|ugcPost|activity):[A-Za-z0-9_-]{1,256}$/.test(id))?[[key,id]]:[];
  }));
}
type Verification=Awaited<ReturnType<typeof verifyAutomatedReleaseBytes>>;
type DispatchProgress={stage:'prepared'|'dispatching'|'accepted';publishAttempted:boolean;containerId?:string;videoId?:string;imageAssetId?:string;externalId?:string};
export type AutomatedDispatchHooks={beforePublish:()=>Promise<void>;checkpoint:(progress:DispatchProgress)=>Promise<void>};
export type AutomatedWorkerTestHooks={verifyBytes?:(r:ApprovedAdvisoryRelease,fetcher:typeof fetch)=>Promise<Verification>;verifyPublic?:(r:ApprovedAdvisoryRelease,fetcher:typeof fetch)=>Promise<{checkedAt:string;htmlSha256:string;canonical:string}>;publish?:(r:ApprovedAdvisoryRelease,channel:typeof channels[number],hooks:AutomatedDispatchHooks)=>Promise<{externalId:string;permalink:string;receipt?:unknown}>};

export function automatedFamilyWhere(r:ApprovedAdvisoryRelease):Prisma.SecurityAdvisoryWhereInput{
  const prefixes=['CVE','CVe','CvE','Cve','cVE','cVe','cvE','cve'];
  return {OR:[{slug:{equals:r.slug,mode:'insensitive'}},{externalId:{equals:r.externalId,mode:'insensitive'}},...r.sources.map(s=>{const u=new URL(s.url);return {sourceUrl:{startsWith:u.origin+u.pathname.replace(/\/$/,''),mode:'insensitive' as const}};}),...r.cves.flatMap(cve=>prefixes.map(prefix=>({cves:{array_contains:[prefix+cve.slice(3)]}})))]};
}
export async function automatedFamilyAdvisoryIds(client:Pick<PrismaClient,'securityAdvisory'>|Pick<Prisma.TransactionClient,'securityAdvisory'>,releases=getAutomatedReleases()){
  if(!releases.length)return [] as {id:string}[];
  // A literal host filter can hide URL-normalized authorities. Enumerate only
  // bounded metadata, completely; a capacity/ordering problem holds admission.
  const matched:{id:string}[]=[],seen=new Set<string>();let cursor:string|undefined;
  for(let page=0;page<80;page++){
    const records=await client.securityAdvisory.findMany({...(cursor?{where:{id:{gt:cursor}}}:{}),orderBy:{id:'asc'},take:256,select:{id:true,slug:true,externalId:true,cves:true,sourceUrl:true}});
    for(const row of records){if(seen.has(row.id))fail('Family metadata enumeration did not progress. Hold instead of assuming absence.');seen.add(row.id);if(releases.some(r=>matchesAutomatedFamily(row,r)))matched.push({id:row.id});}
    if(records.length<256)return matched;
    cursor=records.at(-1)!.id;
  }
  return fail('Complete family metadata exceeds the safe enumeration bound. Hold instead of truncating it.');
}
export async function automatedFamilyPosts(client:Pick<PrismaClient,'$queryRaw'>,releases=getAutomatedReleases()){
  if(!releases.length)return [] as {id:string}[];
  // A path-only overmatch is deliberately a hold: JSON/URL authority spellings
  // must never hide an existing source-only article from this ID-only query.
  const sourcePatterns=releases.flatMap(r=>r.sources.map(source=>{const u=new URL(source.url),value=decodeURIComponent(u.pathname).replace(/\/$/,'').toLowerCase();return [...value].map(char=>`(?:${escape(char)}|${[...Buffer.from(char)].map(b=>'%'+b.toString(16).padStart(2,'0')).join('')})`).join('');}));
  const pattern=[...releases.flatMap(r=>[r.externalId,canonical(r),...r.cves]).map(escape),...sourcePatterns].join('|');
  if(pattern.length>64000)fail('Family alias search exceeds its safe bound; do not truncate it.');
  return client.$queryRaw<{id:string}[]>`SELECT "id" FROM "ContentPost" WHERE "content"::text ~* ${pattern} OR "title" ~* ${pattern} ORDER BY "id"`;
}
async function boundedBytes(url:string,max:number,fetcher:typeof fetch){
  const r=await fetcher(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!r.ok||r.status!==200||!r.body||Number(r.headers.get('content-length')||0)>max)fail('Reviewed source/media retrieval failed.');
  const reader=r.body!.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>max){await reader.cancel();fail('Reviewed source/media exceeded its declared bound.');}chunks.push(p.value);}}finally{reader.releaseLock();}
  return {bytes:Buffer.concat(chunks),mime:r.headers.get('content-type')?.split(';')[0]};
}
export async function verifyAutomatedReleaseBytes(r:ApprovedAdvisoryRelease,fetcher:typeof fetch=fetch){
  validateRelease(r);
  if(assertLinkedInProtocol(r.social.linkedin.caption)!==r.social.linkedin.caption)fail('The exact reviewed LinkedIn caption must meet the publication protocol without rewriting.');
  const checkedSources=[];
  for(const source of r.sources){const current=await boundedBytes(source.url,4*1024*1024,fetcher);if(digest(current.bytes)!==source.bodySha256)fail('A primary vendor source changed. Hold for renewed research and independent review.');checkedSources.push({...source,checkedAt:new Date().toISOString()});}
  for(const asset of r.assets){const current=await boundedBytes(automatedAssetUrl(asset),asset.bytes,fetcher);if(current.bytes.length!==asset.bytes||current.mime!==asset.mimeType||digest(current.bytes)!==asset.sha256)fail('Reviewed graphic or reel bytes changed.');}
  const linkedin=await automatedLinkedInConnection();
  if(linkedin.status!=='connected'||linkedin.expiresAt.getTime()<=Date.now()+5*60000||!linkedin.scope.split(/[ ,]+/).includes('w_member_social'))fail('The reviewed LinkedIn connection is unavailable or expiring.');
  const {createAutomatedMetaTransport}=await import('./automated-advisory-transports.ts');
  const meta=await createAutomatedMetaTransport(process.env,fetcher).verifyAccounts();
  const runtime:AutomatedAdmissionRechecks={sources:checkedSources,review:{checkedAt:new Date().toISOString(),candidateSha256:automatedCandidateHash(r),reviewSha256:automatedStableHash(r.independentReview)},accounts:{linkedin:{accountId:linkedin.accountId,kind:'member'},facebook:{accountId:meta.pageId},instagram:{accountId:meta.instagramId}}};
  validateRelease(r,{requireFresh:true,runtime});
  return {verifiedAt:new Date().toISOString(),candidateSha256:automatedCandidateHash(r),sourceHashes:r.sources.map(s=>s.bodySha256),assetHashes:r.assets.map(a=>a.sha256),runtime};
}
async function inventory(client:PrismaClient|Prisma.TransactionClient,r:ApprovedAdvisoryRelease){
  const ids=await automatedFamilyAdvisoryIds(client,[r]);
  const advisories=ids.length?await client.securityAdvisory.findMany({where:{id:{in:ids.map(a=>a.id)}},select:{id:true,slug:true,status:true,contentHash:true,editorialTrace:true,firstSeenAt:true},orderBy:{id:'asc'}}):[];
  const posts=await automatedFamilyPosts(client,[r]);
  const jobs=await client.socialPublication.findMany({where:{OR:[{contentType:'security_advisory',contentId:{in:advisories.map(a=>a.id)}},{contentType:'content_post',contentId:{in:posts.map(p=>p.id)}},{sourceUrl:{startsWith:canonical(r),mode:'insensitive'}},...r.cves.map(cve=>({commentary:{contains:cve,mode:'insensitive' as const}}))]},orderBy:{id:'asc'}});
  return {advisories,posts,jobs};
}
async function assertCadence(client:PrismaClient|Prisma.TransactionClient,r:ApprovedAdvisoryRelease){
  const now=Date.now(),lower=new Date(now-180*60000),upper=new Date(now+180*60000);
  const nearby=await client.socialPublication.findMany({where:{channel:{in:[...channels]},OR:[{publishedAt:{gte:lower,lte:upper}},{status:{in:['queued','ready','retry','publishing','needs_review','held']},nextAttemptAt:{gte:lower,lte:upper}}]},select:{id:true,sourceUrl:true}});
  if(nearby.some(j=>j.sourceUrl!==canonical(r)))fail('Another social item occupies this publication window. Existing cadence is preserved.');
}
async function assertDailyAdmissionLimit(client:PrismaClient|Prisma.TransactionClient){
  const admitted=await client.securityAdvisory.findMany({where:{createdBy:'reviewed-advisory-worker',firstSeenAt:{gte:new Date(Date.now()-24*3600000)}},select:{id:true},take:2});
  if(admitted.length>=2)fail('Two prospective families were already admitted in this rolling day. Keep the remaining backlog for a later run.');
}
function owned(a:{editorialTrace:unknown;contentHash:string;status:string},r:ApprovedAdvisoryRelease){return a.status==='published'&&object(object(a.editorialTrace).automatedAdvisory).releaseId===r.releaseId&&a.contentHash===automatedCandidateHash(r);}
function assertOwnedFamilyJobs(jobs:Awaited<ReturnType<typeof inventory>>['jobs'],advisoryId:string,r:ApprovedAdvisoryRelease){
  if(jobs.length!==3||!channels.every(channel=>jobs.filter(j=>j.channel===channel).length===1))fail('Only the three exact owned destination jobs may occupy this family.');
  for(const j of jobs){
    const channel=j.channel as typeof channels[number],meta=object(j.metadata),release=object(meta.automatedAdvisory);
    if(j.contentType!=='security_advisory'||j.contentId!==advisoryId||j.contentRevision!=='1'||release.releaseId!==r.releaseId||release.candidateSha256!==automatedCandidateHash(r)||j.sourceUrl!==canonical(r)||j.commentary!==r.social[channel].caption||j.imageUrl!==automatedAssetUrl(r.assets.find(a=>a.key===r.social[channel].assetKey)!))fail('A foreign or changed job owns this family.');
    if(Object.keys(meta).some(k=>!['automatedAdvisory','permalink'].includes(k))||!Number.isFinite(j.nextAttemptAt?.getTime())||j.nextAttemptAt.getTime()>Date.now())fail('A native/future reservation or unknown ownership marker must be preserved.');
    if(Object.keys(release).some(k=>!['releaseId','candidateSha256','stage','dispatchStartedAt','dispatchToken','publicProof','transportProgress','receipt','visibility','transportDetails','uncommittedReceipt'].includes(k)))fail('An unknown native or destination ownership marker must be reconciled.');
    if(!['held','publishing','needs_review','published'].includes(j.status))fail('Unexpected destination ownership state.');
    if(j.status==='held'&&(release.stage!=='awaiting_public_verification'||release.dispatchStartedAt||j.externalId||j.publishedAt))fail('A held destination is not a clear unsubmitted owned job.');
    if(j.status==='published'&&(!j.externalId||!j.publishedAt||release.stage!=='api_accepted'))fail('A purported delivery has no exact owned receipt.');
  }
}

export async function importAutomatedAdvisory(r:ApprovedAdvisoryRelease,client:PrismaClient,fetcher:typeof fetch=fetch,hooks:AutomatedWorkerTestHooks={}){
  const verification=await (hooks.verifyBytes||verifyAutomatedReleaseBytes)(r,fetcher);
  return client.$transaction(async tx=>{
    validateRelease(r,{requireFresh:true,runtime:verification.runtime});
    const found=await inventory(tx,r),exact=found.advisories.find(a=>owned(a,r));
    if(exact){if(found.advisories.length!==1||found.posts.length)fail('Related content changed after the initial import.');assertOwnedFamilyJobs(found.jobs,exact.id,r);return {advisoryId:exact.id,alreadyImported:true};}
    if(found.advisories.length||found.posts.length||found.jobs.length)fail('This family already has content or publication ownership. No record was changed.');
    await assertCadence(tx,r);
    await assertDailyAdmissionLimit(tx);
    const source=await tx.advisorySource.upsert({where:{slug:'reviewed-prospective-releases'},update:{},create:{slug:'reviewed-prospective-releases',name:'Original vendor security advisories',vendor:'Multiple vendors',format:'reviewed-static-release',url:'https://www.qcsstudio.com/security-advisories',officialHost:'www.qcsstudio.com',enabled:false}});
    const hash=automatedCandidateHash(r),a=await tx.securityAdvisory.create({data:{sourceId:source.id,externalId:r.externalId,slug:r.slug,title:r.title,vendor:r.vendor,summary:r.summary,technicalExplanation:r.mechanism,businessImpact:r.affectedConditions,evidenceChecklist:json([r.verification,r.recovery]),severity:r.severity,cvssScore:r.cvssScore,priorityScore:internalPriority[r.severity],cves:json(r.cves),products:json(r.products),affectedVersions:json(r.affectedVersions),fixedVersions:json(r.fixedVersions),remediation:r.remediation,workaround:r.workaround,exploitationStatus:r.exploitationStatus,sourceUrl:r.sources[0].url,contentHash:hash,status:'published',editorialOverride:true,editorialTrace:json({automatedAdvisory:{releaseId:r.releaseId,candidateSha256:hash,independentReview:r.independentReview,verification}}),vendorPublishedAt:new Date(r.vendorPublishedAt),vendorUpdatedAt:new Date(r.vendorUpdatedAt),firstSeenAt:new Date(),createdBy:'reviewed-advisory-worker'}});
    await tx.securityAdvisoryRevision.create({data:{advisoryId:a.id,version:1,contentHash:hash,changes:json(['prospective_reviewed_publication']),payload:json({automatedAdvisory:{releaseId:r.releaseId,candidateSha256:hash}})}});
    // Receipt-free jobs stay isolated from every legacy caption/image/refresh worker.
    for(const channel of channels)await tx.socialPublication.create({data:{channel,contentType:'security_advisory',contentId:a.id,contentRevision:'1',status:'held',sourceUrl:canonical(r),commentary:r.social[channel].caption,imageUrl:automatedAssetUrl(r.assets.find(a=>a.key===r.social[channel].assetKey)!),metadata:json({automatedAdvisory:{releaseId:r.releaseId,candidateSha256:hash,stage:'awaiting_public_verification'}})}});
    await tx.auditLog.create({data:{action:'advisory.automated_reviewed_import',actor:'reviewed-advisory-worker',target:a.id,metadata:json({releaseId:r.releaseId,candidateSha256:hash,verification,priorInventory:{advisories:0,posts:0,jobs:0}})}});
    return {advisoryId:a.id,alreadyImported:false};
  },{isolationLevel:'Serializable'});
}

export async function verifyAutomatedPublicArticle(r:ApprovedAdvisoryRelease,fetcher:typeof fetch=fetch){
  const response=await boundedBytes(canonical(r),2*1024*1024,fetcher),html=response.bytes.toString('utf8');
  if(!response.mime?.startsWith('text/html'))fail('The public advisory is unavailable.');
  const {parse}=await import('parse5');
  type Node={nodeName:string;tagName?:string;value?:string;attrs?:{name:string;value:string}[];childNodes?:Node[]};
  const attr=(n:Node,k:string)=>n.attrs?.find(a=>a.name===k)?.value;
  function find(n:Node):Node|undefined{if(n.tagName==='article'&&attr(n,'data-automated-release')===r.releaseId&&attr(n,'data-automated-candidate')===automatedCandidateHash(r))return n;for(const c of n.childNodes||[]){const match=find(c);if(match)return match;}}
  function text(n:Node):string{if(['script','style','template'].includes(n.tagName||'')||n.attrs?.some(a=>a.name==='hidden'||a.name==='inert'||a.name==='aria-hidden'&&a.value==='true')||/display\s*:\s*none|visibility\s*:\s*hidden/i.test(attr(n,'style')||''))return '';return n.nodeName==='#text'?n.value||'':(n.childNodes||[]).map(text).join(' ');}
  const article=find(parse(html) as Node);if(!article)fail('The exact reviewed public article is missing.');
  const normalize=(s:string)=>s.replace(/\s+/g,' ').trim(),visible=normalize(text(article!));
  const expected=[r.title,r.summary,r.vendor,r.mechanism,r.affectedConditions,r.remediation,r.verification,r.recovery,r.exploitationStatus,...r.workaround?[r.workaround]:[],...r.products,...r.affectedVersions,...r.fixedVersions,...r.definitions.flatMap(d=>[d.term,d.definition]),...r.sections.flatMap(s=>[s.heading,s.body,...s.bullets||[]]),...r.limitations,...r.cves,...r.sources.map(s=>s.url),...r.assets.filter(a=>a.key==='diagram').map(a=>a.alt)];
  if(!expected.every(t=>visible.includes(normalize(t)))||!r.assets.filter(a=>a.key==='diagram').every(a=>html.includes(automatedAssetUrl(a))))fail('The reviewed public explanation or diagram is incomplete.');
  return {checkedAt:new Date().toISOString(),htmlSha256:digest(response.bytes),canonical:canonical(r)};
}

export async function dispatchAutomatedDestination(r:ApprovedAdvisoryRelease,advisoryId:string,channel:typeof channels[number],client:PrismaClient,fetcher:typeof fetch=fetch,hooks:AutomatedWorkerTestHooks={}){
  const publicProof=await (hooks.verifyPublic||verifyAutomatedPublicArticle)(r,fetcher);
  const verification=await (hooks.verifyBytes||verifyAutomatedReleaseBytes)(r,fetcher);
  const token=randomUUID();
  const job=await client.$transaction(async tx=>{
    validateRelease(r,{requireFresh:true,runtime:verification.runtime});
    const found=await inventory(tx,r);
    if(found.advisories.length!==1||found.advisories[0].id!==advisoryId||!owned(found.advisories[0],r)||found.posts.length)fail('Advisory identity or family inventory changed.');
    assertOwnedFamilyJobs(found.jobs,advisoryId,r);
    const jobs=found.jobs.filter(j=>j.channel===channel);
    if(jobs.length!==1)fail('Destination ownership is missing or ambiguous.');
    const j=jobs[0],meta=object(j.metadata),release=object(meta.automatedAdvisory);
    if(j.status==='published'&&j.externalId&&j.publishedAt)return null;
    if(j.externalId||j.publishedAt)fail('A destination identity or delivery time is present but unconfirmed. Reconcile it without reposting.');
    if(j.status!=='held'||release.stage!=='awaiting_public_verification'||release.releaseId!==r.releaseId||release.dispatchStartedAt)fail('This destination needs reconciliation. No automatic retry is allowed.');
    if(release.candidateSha256!==automatedCandidateHash(r)||j.commentary!==r.social[channel].caption||j.sourceUrl!==canonical(r)||j.contentRevision!=='1'||j.imageUrl!==automatedAssetUrl(r.assets.find(a=>a.key===r.social[channel].assetKey)!))fail('The exact destination job payload changed.');
    await assertCadence(tx,r);
    const dispatchAt=new Date().toISOString(),changed=await tx.socialPublication.updateMany({where:{id:j.id,channel,contentType:'security_advisory',contentId:advisoryId,contentRevision:'1',status:'held',updatedAt:j.updatedAt,externalId:null,publishedAt:null},data:{status:'publishing',lastAttemptAt:new Date(),attempts:{increment:1},metadata:json({...meta,automatedAdvisory:{...release,stage:'dispatching',dispatchStartedAt:dispatchAt,dispatchToken:token,publicProof}})}});
    if(changed.count!==1)fail('Destination changed concurrently.');
    return {...j,metadata:{...meta,automatedAdvisory:{...release,dispatchToken:token,dispatchStartedAt:dispatchAt,publicProof}}};
  },{isolationLevel:'Serializable'});
  if(!job)return {channel,status:'already_published'};
  let durableMetadata=object(job.metadata);
  const beforePublish=async()=>{
    await client.$transaction(async tx=>{
      validateRelease(r,{requireFresh:true,runtime:verification.runtime});
      await assertCadence(tx,r);
      const found=await inventory(tx,r);
      if(found.advisories.length!==1||found.advisories[0].id!==advisoryId||!owned(found.advisories[0],r)||found.posts.length)fail('Family ownership changed during media preparation.');
      assertOwnedFamilyJobs(found.jobs,advisoryId,r);
      const current=found.jobs.find(j=>j.id===job.id);
      if(!current||current.status!=='publishing'||current.externalId||current.publishedAt||object(object(current.metadata).automatedAdvisory).dispatchToken!==token)fail('The destination claim changed during media preparation.');
      const fenced=await tx.socialPublication.updateMany({where:{id:job.id,channel,contentType:'security_advisory',contentId:advisoryId,contentRevision:'1',status:'publishing',updatedAt:current!.updatedAt,externalId:null,publishedAt:null,metadata:{path:['automatedAdvisory','dispatchToken'],equals:token}},data:{updatedAt:new Date()}});
      if(fenced.count!==1)fail('Final destination authorization changed concurrently.');
      validateRelease(r,{requireFresh:true,runtime:verification.runtime});
    },{isolationLevel:'Serializable'});
    // Transaction commit time also consumes the remaining proof lifetime.
    validateRelease(r,{requireFresh:true,runtime:verification.runtime});
  };
  const checkpoint=async(progress:DispatchProgress)=>{
    const rows=await client.socialPublication.findMany({where:{id:job.id}}),current=rows.find(j=>j.id===job.id),meta=object(current?.metadata),release=object(meta.automatedAdvisory);
    if(!current||current.channel!==channel||current.contentType!=='security_advisory'||current.contentId!==advisoryId||current.contentRevision!=='1'||current.status!=='publishing'||current.externalId||current.publishedAt||release.dispatchToken!==token||release.candidateSha256!==automatedCandidateHash(r))fail('A durable transport checkpoint cannot claim a changed destination.');
    const safe={stage:progress.stage,publishAttempted:progress.publishAttempted,...safeTransportReferences(progress)};
    const updated={...meta,automatedAdvisory:{...release,transportProgress:safe}};
    const changed=await client.socialPublication.updateMany({where:{id:job.id,channel,contentType:'security_advisory',contentId:advisoryId,contentRevision:'1',status:'publishing',updatedAt:current!.updatedAt,externalId:null,metadata:{path:['automatedAdvisory','dispatchToken'],equals:token}},data:{metadata:json(updated)}});
    if(changed.count!==1)fail('The transport checkpoint could not be stored. No further submission is allowed.');
    durableMetadata=updated;
  };
  const dispatchHooks={beforePublish,checkpoint};
  let received:{externalId:string;permalink:string;receipt?:unknown}|undefined;
  const preserveConflict=async(reason:string,transportDetails:Record<string,unknown>)=>{
    await client.auditLog.create({data:{action:'advisory.automated_dispatch_conflict',actor:'reviewed-advisory-worker',target:job.id,metadata:json({releaseId:r.releaseId,candidateSha256:automatedCandidateHash(r),channel,dispatchToken:token,reason,transportDetails,transportProgress:object(durableMetadata.automatedAdvisory).transportProgress||null,...(received?{uncommittedReceipt:received}:{})})}});
    return false;
  };
  const transition=async(status:'published'|'needs_review',patch:Record<string,unknown>,lastError:string|null,transportDetails:Record<string,unknown>)=>{
    const rows=await client.socialPublication.findMany({where:{id:job.id}}),current=rows.find(j=>j.id===job.id),meta=object(current?.metadata),release=object(meta.automatedAdvisory);
    if(!current||current.channel!==channel||current.contentType!=='security_advisory'||current.contentId!==advisoryId||current.contentRevision!=='1'||current.status!=='publishing'||current.externalId||current.publishedAt||release.dispatchToken!==token||release.candidateSha256!==automatedCandidateHash(r))return preserveConflict('destination_or_claim_changed',transportDetails);
    const clean=Object.keys(meta).every(k=>['automatedAdvisory','permalink'].includes(k))&&Object.keys(release).every(k=>['releaseId','candidateSha256','stage','dispatchStartedAt','dispatchToken','publicProof','transportProgress'].includes(k));
    if(!clean||current.nextAttemptAt.getTime()>Date.now()||current.commentary!==r.social[channel].caption||current.imageUrl!==job.imageUrl||current.sourceUrl!==canonical(r)||current.contentRevision!=='1')return preserveConflict('concurrent_operator_or_ownership_change',transportDetails);
    const changed=await client.socialPublication.updateMany({where:{id:job.id,channel,contentType:'security_advisory',contentId:advisoryId,contentRevision:'1',status:'publishing',updatedAt:current.updatedAt,externalId:null,metadata:{path:['automatedAdvisory','dispatchToken'],equals:token}},data:{status,lastError,...(status==='published'&&received?{externalId:received.externalId,publishedAt:new Date()}:{}),metadata:json({...meta,...(status==='published'&&received?{permalink:received.permalink}:{}),automatedAdvisory:{...release,...patch}})}});
    if(changed.count!==1)return preserveConflict('destination_version_changed',transportDetails);
    return true;
  };
  try{
    // Recheck freshness at the final boundary, after all remote media/source reads.
    validateRelease(r,{requireFresh:true,runtime:verification.runtime});
    const payload=r.social[channel],asset=r.assets.find(a=>a.key===payload.assetKey)!;
    if(hooks.publish)received=await hooks.publish(r,channel,dispatchHooks);
    else if(channel==='linkedin')received=await publishAutomatedLinkedIn({accountId:payload.accountId,caption:payload.caption,imageUrl:automatedAssetUrl(asset),alt:asset.alt},await automatedLinkedInConnection(),fetcher,undefined,dispatchHooks);
    else{
      const {createAutomatedMetaTransport}=await import('./automated-advisory-transports.ts');
      const transport=createAutomatedMetaTransport(process.env,fetcher,dispatchHooks);
      await transport.verifyAccounts();
      received=channel==='facebook'?await transport.publishFacebook({caption:payload.caption,videoUrl:automatedAssetUrl(asset),title:r.title}):await transport.publishInstagram({caption:payload.caption,videoUrl:automatedAssetUrl(asset)});
    }
    const saved=await transition('published',{stage:'api_accepted',receipt:received,visibility:'native_history_verification_pending'},null,safeTransportReferences(received));
    if(!saved)return {channel,status:'needs_review'};
    return {channel,status:'published',externalId:received.externalId,permalink:received.permalink,nativeVisibilityVerified:false};
  }catch(error){
    // Never invoke a platform again after a reservation, including a receipt-write failure.
    const message=error instanceof ReviewedLinkedInError?error.message:'Publication did not complete with a durable verified receipt. Reconcile platform history; no automatic retry.';
    const transportDetails=safeTransportReferences(object(error));
    await transition('needs_review',{stage:'needs_review',transportDetails,...(received?{uncommittedReceipt:received}:{})},message,transportDetails);
    return {channel,status:'needs_review'};
  }
}

export async function runAutomatedAdvisories({dryRun=false,stage='website',client,fetcher=fetch,env=process.env}:{dryRun?:boolean;stage?:'website'|typeof channels[number];client:PrismaClient;fetcher?:typeof fetch;env?:NodeJS.ProcessEnv}){
  const catalog=getAutomatedReleases();
  if(!automatedAdvisoriesEnabled(env))return {status:'held',reason:'The isolated reviewed-advisory pipeline is not activated.',paidGenerationCalls:0};
  if(getAutomatedReleaseCatalog().activation!=='enabled')return {status:'held',reason:'The independently reviewed release catalog is not activated.',paidGenerationCalls:0};
  if(!catalog.length)return {status:'idle',reason:'No independently approved prospective release is admitted.',paidGenerationCalls:0};
  for(const r of catalog){
    validateRelease(r);
    const found=await inventory(client,r),exact=found.advisories.find(a=>owned(a,r));
    if(exact&&channels.every(channel=>found.jobs.some(j=>j.channel===channel&&j.status==='published'&&j.externalId)))continue;
    if(Date.parse(r.notBefore)>Date.now())continue;
    if(dryRun)return {status:'dry_run',releaseId:r.releaseId,existingAdvisory:Boolean(exact),existingJobs:found.jobs.map(j=>({id:j.id,channel:j.channel,status:j.status})),paidGenerationCalls:0,productionWrites:0};
    const imported=await importAutomatedAdvisory(r,client,fetcher),outcomes=[];
    if(stage==='website')return {status:'website_ready',releaseId:r.releaseId,advisoryId:imported.advisoryId,alreadyImported:imported.alreadyImported,paidGenerationCalls:0};
    for(const channel of channels.filter(c=>c===stage)){
      try{outcomes.push(await dispatchAutomatedDestination(r,imported.advisoryId,channel,client,fetcher));}
      catch{outcomes.push({channel,status:'held',reason:'Reviewed source, identity, duplicate, cadence, evidence or transport check did not pass.'});}
    }
    return {status:'processed_one_family',releaseId:r.releaseId,advisoryId:imported.advisoryId,outcomes,paidGenerationCalls:0};
  }
  return {status:'idle',reason:'Every admitted release is delivered or not yet due.',paidGenerationCalls:0};
}
