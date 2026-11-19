import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {automatedSha256,automatedStableHash,automatedCandidateHash,validateRelease,createAutomatedAdvisoryRegistry} from '../src/lib/automated-advisory-domain.ts';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function read(file,max=500000){const full=fs.realpathSync(file);assert.ok(fs.statSync(full).isFile()&&fs.statSync(full).size<=max,'Expected a bounded regular file.');return fs.readFileSync(full);}
function privateRef(workspace,ref){
 assert.ok(ref&&hash(ref.sha256)&&typeof ref.path==='string'&&/^(evidence|receipts)\//.test(ref.path),'Use a bound private evidence reference.');
 const base=fs.realpathSync(workspace),file=fs.realpathSync(path.resolve(base,ref.path)),relative=path.relative(base,file);
 assert.ok(!relative.startsWith('..')&&!path.isAbsolute(relative)&&/^(evidence|receipts)[\\/]/.test(relative),'Evidence escaped its private workspace.');
 const bytes=read(file,32*1024*1024);assert.equal(automatedSha256(bytes),ref.sha256,'Evidence bytes changed.');return bytes;
}
function contained(base,target){const relative=path.relative(base,target);return relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);}
function entry(file){try{return fs.lstatSync(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
// Walk existing components before mkdir: recursive mkdir must not follow an alias first.
function confined(base,target,type='directory',required=false){
 const full=path.resolve(target);assert.ok(contained(base,full),'Output escaped its canonical root.');
 const parts=path.relative(base,full).split(path.sep).filter(Boolean);
 for(let index=-1,current=base;index<parts.length;index++){
  if(index>=0)current=path.join(current,parts[index]);
  const stat=entry(current);if(!stat){assert.equal(required,false,'Required output is missing.');continue;}
  assert.equal(stat.isSymbolicLink(),false,'Output symlink or junction/reparse point is forbidden.');
  assert.ok(index===parts.length-1&&type==='file'?stat.isFile():stat.isDirectory(),'Output must be a regular file or directory.');
  const canonical=fs.realpathSync(current);
  assert.ok(contained(base,canonical)&&path.relative(current,canonical)==='','Output escaped or aliased its canonical path.');
 }
 return full;
}
function makeDirectory(base,target){
 confined(base,target);
 let current=base;
 for(const part of path.relative(base,target).split(path.sep).filter(Boolean)){
  current=path.join(current,part);confined(base,current);
  if(!entry(current))fs.mkdirSync(current);
  confined(base,current,'directory',true);
 }
}
function assetBytes(asset,bytes){
 assert.equal(bytes.length,asset.bytes,'Static asset size changed.');
 assert.equal(automatedSha256(bytes),asset.sha256,'Static asset bytes changed.');
 if(asset.mimeType==='image/png')assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 if(asset.mimeType==='image/jpeg')assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff');
 if(asset.mimeType==='video/mp4')assert.equal(bytes.subarray(4,8).toString(),'ftyp');
}
function publicAsset(publicRoot,asset,required=false){
 const destination=confined(publicRoot,path.resolve(publicRoot,'.'+asset.path),'file',required);
 if(entry(destination)){
  const fd=fs.openSync(destination,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
  try{
   const stat=fs.fstatSync(fd);assert.ok(stat.isFile()&&stat.size===asset.bytes&&stat.size<=25*1024*1024,'Static asset must be an exact bounded regular file.');
   assetBytes(asset,fs.readFileSync(fd));
  }finally{fs.closeSync(fd);}
  confined(publicRoot,destination,'file',true);
 }
 return destination;
}
function instant(value){
 assert.ok(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value),'Cadence requires a valid UTC timestamp.');
 const time=Date.parse(value);assert.ok(Number.isFinite(time)&&[new Date(time).toISOString(),new Date(time).toISOString().replace('.000Z','Z')].includes(value),'Cadence requires a valid UTC timestamp.');return time;
}
function freshNative(value,now=Date.now()){
 const checked=instant(value);assert.ok(checked<=now&&now-checked<=15*60000,'Native cadence proof is expired or future-dated; recheck and obtain a new independent review.');return checked;
}
function cadenceProof(native,channel,now){
 const cadence=native.cadence;
 assert.ok(cadence&&typeof cadence==='object'&&!Array.isArray(cadence),'Complete native account cadence evidence is required.');
 assert.deepEqual(Object.keys(cadence).sort(),['scope','accountId','channel','checkedAt','windowStart','windowEnd','publishedComplete','scheduledComplete','clear','items'].sort(),'Cadence scope must be explicit and unambiguous.');
 assert.equal(cadence.scope,'account-wide-published-and-scheduled');
 assert.equal(cadence.channel,channel);assert.equal(cadence.accountId,native.accountId);assert.equal(cadence.checkedAt,native.checkedAt);
 assert.equal(cadence.publishedComplete,true);assert.equal(cadence.scheduledComplete,true);assert.equal(cadence.clear,true);
 const checked=freshNative(cadence.checkedAt,now),start=instant(cadence.windowStart),end=instant(cadence.windowEnd);
 assert.equal(start,checked-195*60000,'Cadence window must start at checkedAt minus 195 minutes.');
 assert.equal(end,checked+195*60000,'Cadence window must end at checkedAt plus 195 minutes.');
 assert.ok(Array.isArray(cadence.items)&&cadence.items.length<=10000,'Complete bounded native Published and Scheduled inventory is required.');
 const ids=new Set();
 for(const item of cadence.items){
  assert.ok(item&&typeof item==='object'&&!Array.isArray(item),'Invalid cadence item.');
  assert.deepEqual(Object.keys(item).sort(),['id','status','at'].sort(),'Cadence items require exact native ID, status and effective timestamp.');
  assert.ok(typeof item.id==='string'&&item.id.length>0&&item.id.length<=200&&item.id.trim()===item.id&&!/[\u0000-\u001f\u007f]/.test(item.id)&&!ids.has(item.id),'Cadence needs unique nonempty native item IDs.');ids.add(item.id);
  assert.ok(['Published','Scheduled'].includes(item.status),'Unknown native cadence item status.');
  const at=instant(item.at);assert.ok(at<start||at>end,'Native Published or Scheduled item conflicts with the inclusive cadence window.');
 }
}
export function admitAutomatedAdvisory({candidateFile,reviewFile,trustedReviewSha256,assetDirectory,evidenceManifest,workspace,releaseRoot=root}){
 assert.ok(hash(trustedReviewSha256),'Pass the independent review hash returned through the trusted reviewer tool, never one supplied by a feed or candidate.');
 const candidateBytes=read(candidateFile),reviewBytes=read(reviewFile),candidate=JSON.parse(candidateBytes),review=JSON.parse(reviewBytes);
 assert.equal(automatedSha256(reviewBytes),trustedReviewSha256,'This is not the trusted independent receipt.');
 assert.equal(review.schemaVersion,1);assert.equal(review.kind,'qcs-independent-advisory-review');assert.equal(review.verdict,'PASS');
 assert.equal(review.candidateRawSha256,automatedSha256(candidateBytes),'The reviewer did not approve these exact candidate file bytes.');
 assert.equal(review.candidateAuthorshipOrRepairPerformed,false);
 assert.ok(/^[a-f0-9-]{36}$/.test(review.reviewerAgentId)&&/^[a-f0-9-]{36}$/.test(review.authorAgentId)&&review.reviewerAgentId!==review.authorAgentId,'Independent reviewer and author tool identities are required.');
 assert.ok(!Object.hasOwn(candidate,'independentReview'),'Candidate file must not self-author its review.');
 assert.equal(review.releaseReview.authorAgentId,review.authorAgentId);assert.equal(review.releaseReview.reviewerAgentId,review.reviewerAgentId);
 const release=validateRelease({...candidate,independentReview:review.releaseReview});
 assert.equal(automatedCandidateHash(release),review.releaseReview.candidateSha256);
 const now=Date.now(),reviewed=Date.parse(review.releaseReview.reviewedAt);
 assert.ok(reviewed<=now&&now-reviewed<=24*3600000,'Independent review is expired or future-dated.');
 const evidence=JSON.parse(read(evidenceManifest));
 assert.equal(evidence.schemaVersion,1);assert.equal(evidence.releaseId,release.releaseId);
 const refs=[evidence.qa,...evidence.sources.map(s=>s.body),...Object.values(evidence.nativeReconciliation)];
 assert.ok(Array.isArray(review.evidenceHashes));
 assert.deepEqual([...review.evidenceHashes].sort(),refs.map(r=>r.sha256).sort(),'The independent review must bind all QA, native and primary-source evidence.');
 for(const source of release.sources){const saved=evidence.sources.find(s=>s.url===source.url);assert.ok(saved,'Every relied-upon primary body is required.');assert.equal(automatedSha256(privateRef(workspace,saved.body)),source.bodySha256);}
 assert.equal(evidence.sources.length,release.sources.length);
 const qa=JSON.parse(privateRef(workspace,evidence.qa));
 assert.equal(qa.kind,'actual-component-and-media-qa');assert.equal(qa.candidateSha256,review.releaseReview.candidateSha256);
 for(const flag of ['desktopPassed','mobilePassed','reducedMotionPassed','labelsAndSafeAreasPassed','beginningMiddleEndDecoded','audioRightsVerified','captionAndLinkPreviewPassed'])assert.equal(qa[flag],true,`Actual QA did not pass ${flag}.`);
 assert.deepEqual(qa.assetHashes,release.assets.map(a=>({key:a.key,sha256:a.sha256})));
 assert.ok(Array.isArray(qa.renderedEvidence)&&qa.renderedEvidence.length>=5,'Bind actual desktop/mobile and beginning/middle/end captures.');
 for(const ref of qa.renderedEvidence)privateRef(workspace,ref);
 for(const channel of ['linkedin','facebook','instagram']){
  const native=JSON.parse(privateRef(workspace,evidence.nativeReconciliation[channel]));
  assert.equal(native.kind,'native-advisory-family-history');assert.equal(native.channel,channel);assert.equal(native.releaseId,release.releaseId);
  const expected=release.nativeReconciliation[channel];
  for(const field of ['accountId','checkedAt','historySince','complete','existingDelivery','existingReservation'])assert.equal(native[field],expected[field]);
  assert.equal(evidence.nativeReconciliation[channel].sha256,expected.evidenceSha256);
  cadenceProof(native,channel,now);
 }
 const releaseBase=fs.realpathSync(releaseRoot),workspaceBase=fs.realpathSync(workspace);
 const publicRoot=confined(releaseBase,path.join(releaseBase,'public'),'directory',true);
 const privateRoot=confined(workspaceBase,path.join(workspaceBase,'evidence/advisory-watch/automatic-setup'));
 assert.ok(!contained(publicRoot,privateRoot)&&!contained(privateRoot,publicRoot),'Private outputs must be disjoint from public output.');
 const backup=confined(workspaceBase,path.join(privateRoot,`catalog-before-${Date.now()}-${randomUUID()}.json`),'file');
 const receiptFile=confined(workspaceBase,path.join(privateRoot,`admitted-${Date.now()}-${randomUUID()}.json`),'file');
 // Validate every existing output before even creating the catalog lock.
 for(const asset of release.assets)publicAsset(publicRoot,asset);
 const catalogFile=confined(releaseBase,path.join(releaseBase,'src/content/automated-advisory-releases.json'),'file',true);
 const lock=confined(releaseBase,catalogFile+'.lock');
 const temporary=confined(releaseBase,catalogFile+'.'+randomUUID()+'.tmp','file');
 assert.equal(entry(lock),null,'The catalog compiler lock already exists.');
 assert.equal(entry(temporary),null,'The temporary catalog path must be new.');
 confined(releaseBase,catalogFile,'file',true);confined(releaseBase,lock);fs.mkdirSync(lock);
 try{
  confined(releaseBase,lock,'directory',true);
  const oldBytes=read(confined(releaseBase,catalogFile,'file',true),4*1024*1024),old=JSON.parse(oldBytes),registry=createAutomatedAdvisoryRegistry(old),catalog=registry.getCatalog();
  const prior=catalog.releases.find(r=>r.releaseId===release.releaseId);
  if(prior){assert.equal(automatedStableHash(prior),automatedStableHash(release),'Never replace an existing reviewed release.');for(const asset of release.assets)publicAsset(publicRoot,asset,true);for(const value of Object.values(release.nativeReconciliation))freshNative(value.checkedAt);return {alreadyAdmitted:true,releaseId:release.releaseId,publicationPerformed:false};}
  assert.equal(registry.isAutomatedFamily(release),false,'The existing family requires separate reconciliation, not a new release identity.');
  const next={schemaVersion:1,activation:catalog.activation,releases:[...catalog.releases,release]};createAutomatedAdvisoryRegistry(next);
  const assetsRoot=fs.realpathSync(assetDirectory);
  for(const asset of release.assets){
   const source=fs.realpathSync(path.join(assetsRoot,path.basename(asset.path))),relative=path.relative(assetsRoot,source);
   assert.ok(!relative.startsWith('..')&&!path.isAbsolute(relative),'Asset escaped the reviewed media folder.');
   const bytes=read(source,25*1024*1024);assetBytes(asset,bytes);
   const destination=publicAsset(publicRoot,asset),parent=path.dirname(destination);
   makeDirectory(publicRoot,parent);confined(publicRoot,destination,'file');
   if(!entry(destination))fs.writeFileSync(destination,bytes,{flag:'wx'});
   publicAsset(publicRoot,asset,true);
  }
  makeDirectory(workspaceBase,privateRoot);
  confined(workspaceBase,backup,'file');fs.writeFileSync(backup,oldBytes,{flag:'wx'});
  const nextBytes=Buffer.from(JSON.stringify(next,null,2)+'\n');
  confined(releaseBase,lock,'directory',true);confined(releaseBase,catalogFile,'file',true);confined(releaseBase,temporary,'file');
  fs.writeFileSync(temporary,nextBytes,{flag:'wx'});
  confined(releaseBase,temporary,'file',true);assert.deepEqual(read(confined(releaseBase,catalogFile,'file',true),4*1024*1024),oldBytes,'Catalog changed concurrently.');
  for(const value of Object.values(release.nativeReconciliation))freshNative(value.checkedAt);
  confined(releaseBase,lock,'directory',true);confined(releaseBase,temporary,'file',true);confined(releaseBase,catalogFile,'file',true);
  fs.renameSync(temporary,catalogFile);
  confined(releaseBase,catalogFile,'file',true);
  const receipt={at:new Date().toISOString(),releaseId:release.releaseId,reviewSha256:trustedReviewSha256,candidateSha256:automatedCandidateHash(release),previousCatalogSha256:automatedSha256(oldBytes),catalogSha256:automatedSha256(nextBytes),backup,publicationPerformed:false,productionWrites:0};
  confined(workspaceBase,receiptFile,'file');
  fs.writeFileSync(receiptFile,JSON.stringify(receipt,null,2),{flag:'wx'});return receipt;
 }finally{confined(releaseBase,lock,'directory',true);fs.rmdirSync(lock);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=Object.fromEntries(process.argv.slice(2).map(value=>{const n=value.indexOf('=');assert.ok(value.startsWith('--')&&n>2,'Use explicit --name=value arguments.');return [value.slice(2,n),value.slice(n+1)];}));
 console.log(JSON.stringify(admitAutomatedAdvisory({candidateFile:args.candidate,reviewFile:args.review,trustedReviewSha256:args['trusted-review-sha256'],assetDirectory:args.assets,evidenceManifest:args.evidence,workspace:args.workspace})));
}
