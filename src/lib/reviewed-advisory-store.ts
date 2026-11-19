import {randomUUID} from 'node:crypto';
import type {Prisma,PrismaClient} from '@prisma/client';
import {reviewedFamilyAdvisoryWhere,reviewedFamilyCves,reviewedFamilyPosts} from './reviewed-advisory-family.ts';
import {digest,fail,isReviewedAdvisoryIdentity,manifestHash,newEnvelope,object,parseApprovedGuide,releaseConfiguration,requireDeploymentActivation,requireSourceVerification,reviewedAdvisoryMode,reviewedEnvelope,stableHash,verifyPublicReviewedRelease,verifyReviewedMedia,type ReviewedChannel} from './reviewed-advisory-domain.ts';

async function database(provided?:PrismaClient){return provided||(await import('./prisma.ts')).getPrismaClient();}
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const channels=['linkedin','facebook','instagram'] as const;
const include={revisions:{orderBy:{version:'desc' as const}}};
type Snapshot={advisory:Prisma.SecurityAdvisoryGetPayload<{include:typeof include}>;jobs:Prisma.SocialPublicationGetPayload<Record<string,never>>[];aliases:Prisma.SocialPublicationGetPayload<Record<string,never>>[];family:Awaited<ReturnType<typeof familyInventory>>;baselineSha256:string;configuration:ReturnType<typeof releaseConfiguration>};
export async function reviewedScopeJob(client:Pick<PrismaClient,'securityAdvisory'>,job:{contentType:string;contentId:string}){
 if(job.contentType!=='security_advisory')return false;
 const source=await client.securityAdvisory.findUnique({where:{id:job.contentId},select:{slug:true,externalId:true}});
 return Boolean(source&&isReviewedAdvisoryIdentity(source));
}
async function snapshotOn(client:PrismaClient|Prisma.TransactionClient,id:string){
 const advisory=await client.securityAdvisory.findUnique({where:{id},include});
 if(!advisory||!isReviewedAdvisoryIdentity(advisory))fail('Select the approved Cisco advisory.');
 const config=releaseConfiguration();
 if(advisory.slug!==config.slug||advisory.externalId.toUpperCase()!=='CISCO-SA-OCT2026-NODE-JS-JJ3SQ19U'||advisory.deletedAt||advisory.status!=='published')fail('The original published advisory identity changed.');
 const jobs=await client.socialPublication.findMany({where:{contentType:'security_advisory',contentId:id},orderBy:{id:'asc'}});
 const family=await familyInventory(client,id);
 const aliases=family.jobs.filter(job=>job.contentType!=='security_advisory'||job.contentId!==id);
 const value={advisory,jobs,aliases,family};
 return {...value,baselineSha256:stableHash(value),configuration:config} as Snapshot;
}
async function familyInventory(client:PrismaClient|Prisma.TransactionClient,id:string){
 const advisories=await client.securityAdvisory.findMany({where:reviewedFamilyAdvisoryWhere,select:{id:true,slug:true,externalId:true,status:true,sourceUrl:true,cves:true,firstSeenAt:true},orderBy:{id:'asc'}});
 // Search stored JSON inside PostgreSQL, returning identity metadata only, never article bodies.
 const posts=await reviewedFamilyPosts(client);
 const urls=[releaseConfiguration().canonical,...advisories.map(a=>a.sourceUrl)];
 const jobs=await client.socialPublication.findMany({where:{OR:[{contentType:'security_advisory',contentId:{in:[id,...advisories.map(a=>a.id)]}},{contentType:'content_post',contentId:{in:posts.map(p=>p.id)}},...urls.map(url=>({sourceUrl:{contains:url,mode:'insensitive' as const}})),...reviewedFamilyCves.map(cve=>({commentary:{contains:cve,mode:'insensitive' as const}}))]},orderBy:{id:'asc'}});
 return {advisories,posts,jobs,cves:reviewedFamilyCves,scope:'All matching advisory/CVE identities, stored content JSON, and all-channel jobs across all revisions; no date cutoff'};
}
export async function reviewedAdvisorySnapshot(id:string,provided?:PrismaClient){return snapshotOn(await database(provided),id);}
function uncertain(job:{status:string;externalId:string|null;publishedAt:Date|null;metadata:Prisma.JsonValue|null;nextAttemptAt:Date}){
 const meta=object(job.metadata);
 return job.status==='publishing'||job.status==='needs_review'||Boolean(meta.dispatchStartedAt)||Boolean(object(meta.reviewedLocalRelease).dispatchStartedAt)||Boolean(meta.nativeScheduledAt)||Boolean(meta.nativeOwnership)||Boolean(meta.nativeLinkedIn)||Boolean(meta.nativeScheduleReceipt)||object(meta.plannedDelivery).provider==='linkedin-native-scheduler'||job.nextAttemptAt.getTime()>Date.now();
}
export async function applyReviewedAdvisory(id:string,input:unknown,actor:string,provided?:PrismaClient,fetcher:typeof fetch=fetch,deploymentId=process.env.VERCEL_DEPLOYMENT_ID){
 const value=object(input),candidateText=typeof value.candidateText==='string'?value.candidateText:'',reviewText=typeof value.reviewText==='string'?value.reviewText:'';
 const guide=parseApprovedGuide(candidateText,reviewText),activation=requireDeploymentActivation(value.activation,deploymentId);
 const sources=requireSourceVerification(object(value.activation).sources);
 const media=await verifyReviewedMedia(fetcher),prisma=await database(provided);
 return prisma.$transaction(async tx=>{
  requireDeploymentActivation(value.activation,deploymentId);requireSourceVerification(object(value.activation).sources);
  const current=await snapshotOn(tx,id);
  if(current.baselineSha256!==value.expectedBaselineSha256)fail('The advisory/jobs changed; download a fresh backup and repeat preflight.');
  if(current.aliases.length)fail('Another job uses this canonical URL. Reconcile it before importing.');
  const source=await tx.securityAdvisory.findUniqueOrThrow({where:{id},include});
  const prior=reviewedEnvelope(source.revisions[0]?.payload);
  if(prior?.manifestSha256===manifestHash)return {alreadyApplied:true,revision:source.revisions[0].version,canonical:releaseConfiguration().canonical};
  const jobs=await tx.socialPublication.findMany({where:{contentType:'security_advisory',contentId:id},orderBy:{id:'asc'}});
  if(jobs.some(uncertain))fail('A publishing, uncertain or future-scheduled job must be reconciled before this import.');
  const version=(source.revisions[0]?.version||0)+1,envelope=newEnvelope(guide,actor,media);
  const changed=await tx.securityAdvisory.updateMany({where:{id,updatedAt:source.updatedAt,contentHash:source.contentHash,status:'published',deletedAt:null},data:{title:guide.title,summary:guide.description,contentHash:envelope.candidateSha256,editorialOverride:true,qualityScore:null,updatedBy:actor,editorialTrace:json({...object(source.editorialTrace),reviewedLocalRelease:{mode:reviewedAdvisoryMode,releaseId:envelope.releaseId,manifestSha256:manifestHash,activation}})}});
  if(changed.count!==1)fail('Concurrent advisory change; nothing was imported.');
  await tx.securityAdvisoryRevision.create({data:{advisoryId:id,version,contentHash:envelope.candidateSha256,changes:json(['reviewed_local_release']),payload:json({...object(source.revisions[0]?.payload),reviewedGuide:envelope,editorialSnapshot:{...source,title:guide.title,summary:guide.description,revisions:undefined,editorialTrace:{...object(source.editorialTrace),reviewedLocalRelease:{mode:reviewedAdvisoryMode,releaseId:envelope.releaseId,manifestSha256:manifestHash}}}})}});
  for(const job of jobs){
   if(job.status==='published'||job.externalId||job.publishedAt)continue;
   if(!['queued','retry','ready','held'].includes(job.status))fail('An existing job has an unsupported state; reconcile it first.');
   const claim=await tx.socialPublication.updateMany({where:{id:job.id,updatedAt:job.updatedAt,status:job.status,externalId:null,publishedAt:null},data:{status:'held',lastError:'Reserved for the reviewed single-advisory release; generic generation/delivery disabled.',metadata:json({...object(job.metadata),reviewedLocalRelease:{mode:reviewedAdvisoryMode,releaseId:envelope.releaseId,manifestSha256:manifestHash}})}});
   if(claim.count!==1)fail('Concurrent publication change; import rolled back.');
  }
  await tx.auditLog.create({data:{action:'advisory.reviewed_release_applied',actor,target:id,metadata:json({version,manifestSha256:manifestHash,activation,sources,beforeSnapshot:current,backupSha256:current.baselineSha256})}});
  return {alreadyApplied:false,revision:version,canonical:releaseConfiguration().canonical,manifestSha256:manifestHash};
 },{isolationLevel:'Serializable'});
}

type NativeClearance={destination:ReviewedChannel;checkedAt:string;accountId:string;canonical:string;historyEvidenceSha256:string;sourceWindowStart:string;completed:boolean};
function validateNativeClearance(clearance:NativeClearance,channel:ReviewedChannel){
 if(clearance.destination!==channel||clearance.canonical!==releaseConfiguration().canonical||clearance.completed!==true||!/^[a-f0-9]{64}$/.test(clearance.historyEvidenceSha256||'')||!Number.isFinite(Date.parse(clearance.checkedAt))||Date.now()-Date.parse(clearance.checkedAt)>5*60000||Date.parse(clearance.checkedAt)>Date.now()||!Number.isFinite(Date.parse(clearance.sourceWindowStart))||Date.parse(clearance.sourceWindowStart)>Date.now()-72*3600000)fail('Fresh, account-bound complete native duplicate reconciliation evidence is required.');
}
export async function reserveReviewedDestination(id:string,input:unknown,actor:string,provided?:PrismaClient,fetcher:typeof fetch=fetch,deploymentId=process.env.VERCEL_DEPLOYMENT_ID){
 const value=object(input),channel=value.channel as ReviewedChannel;
 if(!channels.includes(channel))fail('Choose one exact destination.');
 const activation=requireDeploymentActivation(value.activation,deploymentId),sources=requireSourceVerification(object(value.activation).sources);
 const clearance=object(value.clearance) as unknown as NativeClearance;
 validateNativeClearance(clearance,channel);
 const {reviewedSocialPayload}=await import('./reviewed-advisory-social.ts');
 const payload=reviewedSocialPayload(channel);
 if(clearance.accountId!==payload.accountId)fail('Native history belongs to the wrong destination account.');
 const prisma=await database(provided),preflight=await snapshotOn(prisma,id);
 if(preflight.aliases.length)fail('Related advisory/CVE-family jobs need explicit reconciliation before any destination handoff.');
 if(!Number.isFinite(Date.parse(clearance.sourceWindowStart))||Date.parse(clearance.sourceWindowStart)>Math.min(preflight.advisory.firstSeenAt.getTime(),preflight.advisory.vendorPublishedAt.getTime()))fail('Native history must cover the advisory lifetime, not just the recent overlap.');
 const exactRelease=reviewedEnvelope(preflight.advisory.revisions[0]?.payload);if(!exactRelease)fail('Apply and verify the reviewed public guide first.');
 const publicVerification=await verifyPublicReviewedRelease(exactRelease,fetcher);
 await verifyReviewedMedia(fetcher);
 return prisma.$transaction(async tx=>{
  requireDeploymentActivation(value.activation,deploymentId);requireSourceVerification(object(value.activation).sources);validateNativeClearance(clearance,channel);
  const source=await tx.securityAdvisory.findUniqueOrThrow({where:{id},include});
  const fresh=await snapshotOn(tx,id);
  if(fresh.baselineSha256!==preflight.baselineSha256)fail('Source or family inventory changed after preflight.');
  const aliases=fresh.aliases.length;
  if(!isReviewedAdvisoryIdentity(source)||source.slug!==releaseConfiguration().slug||source.deletedAt)fail('Only the approved advisory can be reserved.');
  if(aliases)fail('Another source identity uses this canonical; reconcile the family first.');
  const envelope=reviewedEnvelope(source.revisions[0]?.payload);
  if(!envelope||source.status!=='published'||source.contentHash!==envelope.candidateSha256||value.manifestSha256!==manifestHash)fail('Verify the exact enhanced public release first.');
  const all=await tx.socialPublication.findMany({where:{contentType:'security_advisory',contentId:id,channel},orderBy:{createdAt:'asc'}});
  if(all.some(job=>job.status==='published'||job.externalId||job.publishedAt))fail('This destination already has a delivery record; do not publish another copy.');
  if(all.some(uncertain))fail('A prior dispatch or reservation is uncertain; never retry it automatically.');
  if(all.some(job=>!['queued','ready','retry','held'].includes(job.status)))fail('The existing destination state requires separate reconciliation.');
  if(all.length>1)fail('Multiple destination jobs require explicit reconciliation; no replacement was created.');
  requireDeploymentActivation(value.activation,deploymentId);requireSourceVerification(object(value.activation).sources);validateNativeClearance(clearance,channel);
  const dispatchToken=randomUUID(),dispatchAt=new Date();
  const data={status:'publishing',lastAttemptAt:dispatchAt,metadata:json({...object(all[0]?.metadata),reviewedLocalRelease:{mode:reviewedAdvisoryMode,releaseId:envelope.releaseId,reviewedRevision:String(source.revisions[0].version),manifestSha256:manifestHash,dispatchToken,dispatchStartedAt:dispatchAt.toISOString(),payloadSha256:payload.sha256,destinationPayload:{caption:payload.caption,mediaUrl:payload.mediaUrl,sourceUrl:releaseConfiguration().canonical},clearance,activation,sources,publicVerification,transport:'native-ui',actor}})};
  let jobId:string;
  if(all[0]){const job=all[0];const claim=await tx.socialPublication.updateMany({where:{id:job.id,updatedAt:job.updatedAt,status:job.status,externalId:null,publishedAt:null},data});if(claim.count!==1)fail('Destination changed before reservation.');jobId=job.id;}
  else{const created=await tx.socialPublication.create({data:{...data,channel,contentType:'security_advisory',contentId:id,contentRevision:String(source.revisions[0].version),commentary:payload.caption,imageUrl:payload.mediaUrl,sourceUrl:releaseConfiguration().canonical}});jobId=created.id;}
  await tx.auditLog.create({data:{action:'advisory.reviewed_native_reserved',actor,target:id,metadata:json({jobId,channel,dispatchToken,payloadSha256:payload.sha256,clearance})}});
  return {jobId,channel,dispatchToken,dispatchAt:dispatchAt.toISOString(),caption:payload.caption,mediaUrl:payload.mediaUrl,payloadSha256:payload.sha256,status:'publishing'};
 },{isolationLevel:'Serializable'});
}
export async function recordReviewedReceipt(id:string,input:unknown,actor:string,provided?:PrismaClient){
 const value=object(input),channel=value.channel as ReviewedChannel;
 if(!channels.includes(channel))fail('Choose one exact destination.');
 const proof=object(value.proof),now=Date.now();
 if(proof.kind!=='native-publication-observation'||proof.channel!==channel||typeof proof.observedAt!=='string'||!Number.isFinite(Date.parse(proof.observedAt))||Date.parse(proof.observedAt)>now||now-Date.parse(proof.observedAt)>15*60000||typeof proof.evidenceSha256!=='string'||!/^[a-f0-9]{64}$/.test(proof.evidenceSha256))fail('A genuine current native publication observation is required.');
 const {reviewedSocialPayload,receiptUrl,assertReceiptIdentity}=await import('./reviewed-advisory-social.ts');const payload=reviewedSocialPayload(channel);
 if(proof.accountId!==payload.accountId||proof.payloadSha256!==payload.sha256)fail('Receipt belongs to a different account or payload.');
 if(typeof proof.platformId!=='string'||!proof.platformId||typeof proof.url!=='string')fail('Save the real post ID and permalink.');
 const platformId=proof.platformId;
 const url=receiptUrl(channel,proof.url);
 assertReceiptIdentity(channel,url,proof.platformId);
 const prisma=await database(provided);
 return prisma.$transaction(async tx=>{
  const job=await tx.socialPublication.findUnique({where:{id:String(value.jobId||'')}});
  if(!job||job.contentId!==id||job.contentType!=='security_advisory'||job.channel!==channel)fail('Receipt does not match the selected advisory/job.');
  const release=object(object(job.metadata).reviewedLocalRelease);
  if(release.dispatchToken!==value.dispatchToken||release.payloadSha256!==payload.sha256||release.mode!==reviewedAdvisoryMode)fail('Dispatch identity changed.');
  if(typeof release.dispatchStartedAt!=='string'||Date.parse(String(proof.observedAt))<Date.parse(release.dispatchStartedAt)||proof.reservationToken!==release.dispatchToken||proof.observedCaptionSha256!==digest(payload.caption)||proof.mediaMatched!==true)fail('Native evidence must postdate and match this exact reservation, caption and media.');
  if(job.status==='published'){if(job.externalId!==proof.platformId)fail('This job already has another confirmed receipt.');return {status:'published',url:object(job.metadata).permalink,alreadyRecorded:true};}
  if(!['publishing','needs_review'].includes(job.status))fail('No unresolved dispatch exists for this receipt.');
  const changed=await tx.socialPublication.updateMany({where:{id:job.id,updatedAt:job.updatedAt,status:job.status,externalId:null},data:{status:'published',externalId:platformId,publishedAt:new Date(String(proof.observedAt)),lastError:null,metadata:json({...object(job.metadata),permalink:url,reviewedLocalRelease:{...release,proof,verificationMode:'authenticated-operator-native-observation'}})}});
  if(changed.count!==1)fail('Receipt changed concurrently; reconcile before another action.');
  await tx.auditLog.create({data:{action:'advisory.reviewed_native_receipt',actor,target:id,metadata:json({jobId:job.id,channel,proof})}});
  return {status:'published',url,alreadyRecorded:false};
 },{isolationLevel:'Serializable'});
}
export async function markReviewedUncertain(id:string,input:unknown,actor:string,provided?:PrismaClient){
 const value=object(input),prisma=await database(provided),job=await prisma.socialPublication.findUnique({where:{id:String(value.jobId||'')}});
 if(!job||job.contentId!==id||job.contentType!=='security_advisory'||job.status!=='publishing'||object(object(job.metadata).reviewedLocalRelease).dispatchToken!==value.dispatchToken)fail('No matching unresolved reservation.');
 const changed=await prisma.socialPublication.updateMany({where:{id:job.id,updatedAt:job.updatedAt,status:'publishing'},data:{status:'needs_review',lastError:'Native dispatch outcome is uncertain. Inspect platform history; do not retry or delete.'}});
 if(changed.count!==1)fail('Reservation changed concurrently. Read current state before another action.');
 return {status:'needs_review',actor};
}
