import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {admitAutomatedAdvisory} from '../scripts/admit-automated-advisory.mjs';
import {syntheticRelease,syntheticSourceBody,bindSyntheticRelease} from './helpers/automated-release-fixture.mjs';
import {automatedSha256,automatedCandidateHash} from '../src/lib/automated-advisory-domain.ts';

// All reviews/QA/native observations are explicitly synthetic consistency fixtures.
// They are not genuine approval and are never admitted to the real release catalog.
function fixture(t,{mutateNative,now,workspaceInPublic=false}={}){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'qcs-advisory-compiler-test-'));
 const links=[];
 t.after(()=>{for(const link of links.reverse())if(fs.existsSync(link)||fs.lstatSync(link,{throwIfNoEntry:false}))fs.unlinkSync(link);const resolved=fs.realpathSync(base);assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('qcs-advisory-compiler-test-'));fs.rmSync(resolved,{recursive:true,force:true});});
 const releaseRoot=path.join(base,'release'),workspace=workspaceInPublic?path.join(releaseRoot,'public/workspace'):path.join(base,'workspace'),assets=path.join(base,'assets');
 for(const dir of [path.join(workspace,'evidence'),path.join(releaseRoot,'src/content'),path.join(releaseRoot,'public'),assets])fs.mkdirSync(dir,{recursive:true});
 const catalog=path.join(releaseRoot,'src/content/automated-advisory-releases.json');fs.writeFileSync(catalog,JSON.stringify({schemaVersion:1,activation:'held',releases:[]}));
 let n=0;const save=value=>{const bytes=Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value)),ref={path:`evidence/synthetic-${n++}.json`,sha256:automatedSha256(bytes)};fs.writeFileSync(path.join(workspace,ref.path),bytes);return ref;};
 const release=syntheticRelease(now?{now}:{});
 release.independentReview.authorAgentId='00000000-0000-0000-0000-000000000001';
 release.independentReview.reviewerAgentId='00000000-0000-0000-0000-000000000002';
 for(const asset of release.assets){
  const bytes=asset.key==='diagram'?Buffer.from('89504e470d0a1a0a534e544845544943','hex'):asset.key==='linkedin'?Buffer.from('ffd8ff53594e544845544943','hex'):Buffer.from([0,0,0,20,...Buffer.from('ftypSYNTHETIC')]);
  asset.sha256=automatedSha256(bytes);asset.bytes=bytes.length;asset.path=asset.path.replace(/[a-f0-9]{64}\./,asset.sha256+'.');fs.writeFileSync(path.join(assets,path.basename(asset.path)),bytes);
 }
 const native={};
 for(const channel of ['linkedin','facebook','instagram']){
  const claims={...release.nativeReconciliation[channel]};delete claims.evidenceSha256;
  const checked=Date.parse(claims.checkedAt);
  const proof={kind:'native-advisory-family-history',channel,releaseId:release.releaseId,...claims,cadence:{
   scope:'account-wide-published-and-scheduled',channel,accountId:claims.accountId,checkedAt:claims.checkedAt,
   windowStart:new Date(checked-195*60000).toISOString(),windowEnd:new Date(checked+195*60000).toISOString(),
   publishedComplete:true,scheduledComplete:true,clear:true,items:[]
  }};
  mutateNative?.(proof,channel);
  native[channel]=save(proof);
  release.nativeReconciliation[channel].evidenceSha256=native[channel].sha256;
 }
 bindSyntheticRelease(release);
 const source=save(syntheticSourceBody),renders=Array.from({length:5},(_,i)=>save(`SYNTHETIC capture ${i}; not real visual QA`));
 const qa=save({kind:'actual-component-and-media-qa',candidateSha256:automatedCandidateHash(release),desktopPassed:true,mobilePassed:true,reducedMotionPassed:true,labelsAndSafeAreasPassed:true,beginningMiddleEndDecoded:true,audioRightsVerified:true,captionAndLinkPreviewPassed:true,assetHashes:release.assets.map(a=>({key:a.key,sha256:a.sha256})),renderedEvidence:renders});
 const {independentReview,...candidate}=release;
 const candidateFile=path.join(base,'candidate.json');fs.writeFileSync(candidateFile,JSON.stringify(candidate));
 const review={schemaVersion:1,kind:'qcs-independent-advisory-review',verdict:'PASS',candidateRawSha256:automatedSha256(fs.readFileSync(candidateFile)),candidateAuthorshipOrRepairPerformed:false,authorAgentId:independentReview.authorAgentId,reviewerAgentId:independentReview.reviewerAgentId,releaseReview:independentReview,evidenceHashes:[qa.sha256,source.sha256,...Object.values(native).map(r=>r.sha256)]};
 const reviewFile=path.join(base,'review.json');fs.writeFileSync(reviewFile,JSON.stringify(review));
 const evidence={schemaVersion:1,releaseId:release.releaseId,qa,sources:[{url:release.sources[0].url,body:source}],nativeReconciliation:native};
 const evidenceManifest=path.join(base,'evidence.json');fs.writeFileSync(evidenceManifest,JSON.stringify(evidence));
 const args={candidateFile,reviewFile,trustedReviewSha256:automatedSha256(fs.readFileSync(reviewFile)),assetDirectory:assets,evidenceManifest,workspace,releaseRoot};
 return {base,args,catalog,candidate,review,evidence,qa,renders,assets,release,links};
}
test('Synthetic admission is local-only, append-only and preserves exact prior bytes in a backup',t=>{
 const f=fixture(t),before=fs.readFileSync(f.catalog),result=admitAutomatedAdvisory(f.args);
 assert.equal(result.publicationPerformed,false);assert.equal(result.productionWrites,0);assert.deepEqual(fs.readFileSync(result.backup),before);
 const catalog=JSON.parse(fs.readFileSync(f.catalog));assert.equal(catalog.activation,'held');assert.equal(catalog.releases.length,1);
 assert.equal(admitAutomatedAdvisory(f.args).alreadyAdmitted,true);
});
test('Candidate cannot self-author the independent review',t=>{
 const f=fixture(t);f.candidate.independentReview=f.review.releaseReview;fs.writeFileSync(f.args.candidateFile,JSON.stringify(f.candidate));
 assert.throws(()=>admitAutomatedAdvisory(f.args));assert.equal(JSON.parse(fs.readFileSync(f.catalog)).releases.length,0);
});
test('An untrusted receipt hash cannot be used even when the receipt says PASS',t=>{
 const f=fixture(t);f.args.trustedReviewSha256='0'.repeat(64);assert.throws(()=>admitAutomatedAdvisory(f.args));
});
test('Candidate repairs cannot reuse the exact raw-byte review',t=>{
 const f=fixture(t);fs.appendFileSync(f.args.candidateFile,' ');assert.throws(()=>admitAutomatedAdvisory(f.args));
});
test('Changed source, native or QA bytes prevent admission',t=>{
 const f=fixture(t);fs.appendFileSync(path.join(f.args.workspace,f.evidence.sources[0].body.path),'changed');assert.throws(()=>admitAutomatedAdvisory(f.args));
});
test('Missing actual render evidence prevents admission',t=>{
 const f=fixture(t);fs.renameSync(path.join(f.args.workspace,f.renders[0].path),path.join(f.base,'moved-render'));assert.throws(()=>admitAutomatedAdvisory(f.args));
});
test('Changed reviewed media bytes cannot enter static storage',t=>{
 const f=fixture(t);fs.appendFileSync(path.join(f.assets,path.basename(f.release.assets[2].path)),'tampered');assert.throws(()=>admitAutomatedAdvisory(f.args));assert.equal(JSON.parse(fs.readFileSync(f.catalog)).releases.length,0);
});
test('A duplicate family cannot be reintroduced with a new release identity',t=>{
 const f=fixture(t);admitAutomatedAdvisory(f.args);const catalog=JSON.parse(fs.readFileSync(f.catalog));catalog.releases[0].releaseId='changed-old-release';fs.writeFileSync(f.catalog,JSON.stringify(catalog));assert.throws(()=>admitAutomatedAdvisory(f.args));
});

function publicFile(f,asset){return path.resolve(f.args.releaseRoot,'public','.'+asset.path);}
function unchangedFailure(f,pattern,snapshotFile=f.catalog){
 const before=fs.readFileSync(snapshotFile),lockBefore=fs.existsSync(f.catalog+'.lock');
 assert.throws(()=>admitAutomatedAdvisory(f.args),pattern);
 assert.deepEqual(fs.readFileSync(snapshotFile),before);
 assert.equal(fs.existsSync(f.catalog+'.lock'),lockBefore);
}
function linkInFixture(t,f,target,link,type){
 for(const file of [target,link]){const relative=path.relative(fs.realpathSync(f.base),path.resolve(file));assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));}
 try{fs.symlinkSync(target,link,type);f.links.push(link);return true;}
 catch(error){if(['EPERM','EACCES','ENOTSUP','ENOSYS'].includes(error.code)){t.skip(`OS ${type} creation is unavailable (${error.code}); no OS-level alias claim.`);return false;}throw error;}
}
function noCompilerWrites(t,f,pattern,snapshotFile=f.catalog){
 const mutations=[];
 for(const name of ['mkdirSync','writeFileSync','renameSync','rmdirSync','unlinkSync']){
  const original=fs[name];t.mock.method(fs,name,(...args)=>{mutations.push({name,file:args[0]});return original(...args);});
 }
 unchangedFailure(f,pattern,snapshotFile);assert.deepEqual(mutations,[],'Unsafe output must be rejected before any mkdir/write/rename/remove.');
}

function fixturePath(f,file){const full=path.resolve(file),relative=path.relative(fs.realpathSync(f.base),full);assert.ok(relative&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative),'Test operation must stay inside its guarded temp fixture.');return full;}
function moveInFixture(f,from,to){fs.renameSync(fixturePath(f,from),fixturePath(f,to));}
function aliasRoute(from,to){return file=>{const relative=path.relative(from,file);return relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative)?path.resolve(to,relative):file;};}
// Model canonical redirects as well as reads and mutations; this is not OS-level evidence.
function modelAlias(t,f,route){
 const rawRead=fs.readFileSync,redirectedMutations=[];
 const mapped=file=>{if(typeof file!=='string')return file;const full=path.resolve(file),target=route(full);return target===full?file:fixturePath(f,target);};
 for(const name of ['lstatSync','statSync','realpathSync','existsSync','readFileSync','openSync','mkdirSync','writeFileSync','renameSync','rmdirSync','unlinkSync']){
  const original=fs[name];t.mock.method(fs,name,(...args)=>{
   const next=[...args];next[0]=mapped(args[0]);if(name==='renameSync')next[1]=mapped(args[1]);
   if(['mkdirSync','writeFileSync','renameSync','rmdirSync','unlinkSync'].includes(name)&&next.some((value,index)=>index<(name==='renameSync'?2:1)&&value!==args[index]))redirectedMutations.push({name,from:args[0],to:next[0]});
   return original(...next);
  });
 }
 return {rawRead,redirectedMutations};
}

for(const key of ['diagram','linkedin','reel'])for(const damage of ['missing','size','hash','directory'])test(`Already-admitted ${key} ${damage} damage is rejected without catalog or receipt changes`,t=>{
 const f=fixture(t),result=admitAutomatedAdvisory(f.args),asset=f.release.assets.find(a=>a.key===key),file=publicFile(f,asset);
 const privateBefore=fs.readdirSync(path.dirname(result.backup)).sort();
 if(damage==='missing')fs.unlinkSync(file);
 if(damage==='size')fs.appendFileSync(file,'SYNTHETIC corruption');
 if(damage==='hash'){const bytes=fs.readFileSync(file);bytes[bytes.length-1]^=1;fs.writeFileSync(file,bytes);}
 if(damage==='directory'){fs.unlinkSync(file);fs.mkdirSync(file);}
 unchangedFailure(f,/missing|regular|size|bytes/i);
 assert.deepEqual(fs.readdirSync(path.dirname(result.backup)).sort(),privateBefore);
});

test('Idempotent success checks standalone public files without requiring the old staging directory',t=>{
 const f=fixture(t);admitAutomatedAdvisory(f.args);
 for(const asset of f.release.assets)fs.unlinkSync(path.join(f.assets,path.basename(asset.path)));
 fs.rmdirSync(f.assets);
 assert.equal(admitAutomatedAdvisory(f.args).alreadyAdmitted,true);
 for(const asset of f.release.assets){const file=publicFile(f,asset);assert.equal(fs.lstatSync(file).isFile(),true);assert.equal(fs.statSync(file).size,asset.bytes);assert.equal(automatedSha256(fs.readFileSync(file)),asset.sha256);}
});

test('Matching preexisting regular public assets remain byte-for-byte unchanged on first admission',t=>{
 const f=fixture(t);
 for(const asset of f.release.assets){const file=publicFile(f,asset);fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(path.join(f.assets,path.basename(asset.path)),file,fs.constants.COPYFILE_EXCL);}
 admitAutomatedAdvisory(f.args);
 for(const asset of f.release.assets)assert.equal(automatedSha256(fs.readFileSync(publicFile(f,asset))),asset.sha256);
});

test('Private outputs canonically inside public are rejected before any compiler mutation',t=>{
 const f=fixture(t,{workspaceInPublic:true});noCompilerWrites(t,f,/disjoint/);
 assert.equal(fs.existsSync(path.join(f.args.workspace,'evidence/advisory-watch')),false);
});

for(const targetKind of ['public','outside','private'])for(const depth of ['advisory-watch','advisory-watch/automatic-setup'])test(`Real directory alias at private ${depth} into ${targetKind} is rejected before mkdir/writes`,t=>{
 const f=fixture(t),target=targetKind==='public'?path.join(f.args.releaseRoot,'public/private-output-trap'):path.join(f.base,targetKind+'-output-trap');
 fs.mkdirSync(target);const link=path.join(f.args.workspace,'evidence',depth);fs.mkdirSync(path.dirname(link),{recursive:true});
 if(!linkInFixture(t,f,target,link,process.platform==='win32'?'junction':'dir'))return;
 noCompilerWrites(t,f,/symlink|junction|canonical/);
 assert.deepEqual(fs.readdirSync(target),[]);
});

for(const admitted of [false,true])for(const dangling of [false,true])test(`Real ${dangling?'dangling':'matching-byte'} final asset symlink is rejected on ${admitted?'idempotent':'new'} admission`,t=>{
 const f=fixture(t),asset=f.release.assets[0],file=publicFile(f,asset);
 if(admitted){admitAutomatedAdvisory(f.args);fs.unlinkSync(file);}else fs.mkdirSync(path.dirname(file),{recursive:true});
 const target=dangling?path.join(f.base,'missing-private-image.png'):path.join(f.assets,path.basename(asset.path));
 if(!linkInFixture(t,f,target,file,'file'))return;
 noCompilerWrites(t,f,/symlink|junction|reparse/);
 assert.equal(fs.lstatSync(file).isSymbolicLink(),true);
});

test('Real public asset-parent junction cannot create files or directories outside public',t=>{
 const f=fixture(t),target=path.join(f.base,'outside-public-assets'),link=path.join(f.args.releaseRoot,'public/automated-advisories');
 fs.mkdirSync(target);
 if(!linkInFixture(t,f,target,link,process.platform==='win32'?'junction':'dir'))return;
 noCompilerWrites(t,f,/symlink|junction|canonical/);assert.deepEqual(fs.readdirSync(target),[]);
});

test('Deterministic junction model rejects an alias at the first existing private parent before mkdir',t=>{
 const f=fixture(t),link=path.join(f.args.workspace,'evidence/advisory-watch'),target=path.join(f.args.releaseRoot,'public/trap');
 fs.mkdirSync(target);const original=fs.lstatSync;
 t.mock.method(fs,'lstatSync',(file,...args)=>path.resolve(file)===link?{isSymbolicLink:()=>true}:original(file,...args));
 noCompilerWrites(t,f,/symlink|junction|reparse/);assert.deepEqual(fs.readdirSync(target),[]);
});

test('Deterministic final-file alias model cannot accept the expected private bytes',t=>{
 const f=fixture(t),asset=f.release.assets[0],file=publicFile(f,asset);fs.mkdirSync(path.dirname(file),{recursive:true});
 const original=fs.lstatSync;t.mock.method(fs,'lstatSync',(value,...args)=>path.resolve(value)===file?{isSymbolicLink:()=>true}:original(value,...args));
 noCompilerWrites(t,f,/symlink|junction|reparse/);
});

test('Canonical escape is rejected even when an alias is not reported as a symbolic link',t=>{
 const f=fixture(t),link=path.join(f.args.workspace,'evidence/advisory-watch'),target=path.join(f.base,'outside-reparse-target');fs.mkdirSync(link);fs.mkdirSync(target);
 const original=fs.realpathSync;t.mock.method(fs,'realpathSync',(file,...args)=>path.resolve(file)===link?target:original(file,...args));
 noCompilerWrites(t,f,/canonical/);assert.deepEqual(fs.readdirSync(target),[]);
});

for(const prefix of ['catalog-before-','admitted-'])test(`A private ${prefix} final-target alias is rejected before any compiler write`,t=>{
 const f=fixture(t),privateRoot=path.join(f.args.workspace,'evidence/advisory-watch/automatic-setup');fs.mkdirSync(privateRoot,{recursive:true});
 const original=fs.lstatSync;t.mock.method(fs,'lstatSync',(file,...args)=>path.dirname(path.resolve(file))===privateRoot&&path.basename(file).startsWith(prefix)?{isSymbolicLink:()=>true}:original(file,...args));
 noCompilerWrites(t,f,/symlink|junction|reparse/);
});

for(const depth of ['src','src/content'])for(const location of ['outside','public'])test(`IND-COMPILER-005 real ${depth} junction into ${location} causes zero writes and preserves both catalogs`,t=>{
 const f=fixture(t),before=fs.readFileSync(f.catalog),from=path.join(f.args.releaseRoot,depth);
 const saved=fixturePath(f,path.join(f.base,'saved-'+depth.replace('/','-'))),target=fixturePath(f,location==='public'?path.join(f.args.releaseRoot,'public/catalog-trap'):path.join(f.base,'outside-catalog-trap'));
 const relative=path.relative(from,f.catalog),targetCatalog=path.join(target,relative),savedCatalog=path.join(saved,relative);
 fs.mkdirSync(path.dirname(targetCatalog),{recursive:true});fs.writeFileSync(targetCatalog,before);moveInFixture(f,from,saved);
 if(!linkInFixture(t,f,target,from,process.platform==='win32'?'junction':'dir'))return;
 noCompilerWrites(t,f,/symlink|junction|canonical/);
 assert.deepEqual(fs.readFileSync(savedCatalog),before);assert.deepEqual(fs.readFileSync(targetCatalog),before);
});

for(const final of ['catalog','lock'])for(const location of ['outside','public'])test(`IND-COMPILER-005 real final ${final} directory junction into ${location} causes zero writes`,t=>{
 const f=fixture(t),before=fs.readFileSync(f.catalog),target=fixturePath(f,location==='public'?path.join(f.args.releaseRoot,'public/final-catalog-trap'):path.join(f.base,'outside-final-catalog-trap'));
 fs.mkdirSync(target);const targetCatalog=path.join(target,'catalog.json');fs.writeFileSync(targetCatalog,before);
 const from=final==='catalog'?f.catalog:f.catalog+'.lock',saved=path.join(f.base,'saved-catalog.json');
 if(final==='catalog')moveInFixture(f,f.catalog,saved);
 if(!linkInFixture(t,f,target,from,process.platform==='win32'?'junction':'dir'))return;
 noCompilerWrites(t,f,/symlink|junction|canonical/,final==='catalog'?saved:f.catalog);
 assert.deepEqual(fs.readFileSync(final==='catalog'?saved:f.catalog),before);assert.deepEqual(fs.readFileSync(targetCatalog),before);
});

for(const output of ['src','src/content','catalog','lock','temporary'])for(const location of ['outside','public'])test(`IND-COMPILER-005 deterministic ${output} canonical alias into ${location} cannot mutate either catalog`,t=>{
 const f=fixture(t),before=fs.readFileSync(f.catalog),target=fixturePath(f,location==='public'?path.join(f.args.releaseRoot,'public/modeled-catalog-trap'):path.join(f.base,'outside-modeled-catalog-trap'));
 const from=output==='catalog'?f.catalog:output==='lock'?f.catalog+'.lock':output==='temporary'?null:path.join(f.args.releaseRoot,output);
 const targetCatalog=path.join(target,output==='src'?'content/automated-advisory-releases.json':output==='src/content'?'automated-advisory-releases.json':'catalog.json');
 fs.mkdirSync(path.dirname(targetCatalog),{recursive:true});fs.writeFileSync(targetCatalog,before);
 const destination=output==='catalog'?targetCatalog:target;
 const route=output==='temporary'?file=>file.startsWith(f.catalog+'.')&&file.endsWith('.tmp')?targetCatalog:file:aliasRoute(from,destination);
 const model=modelAlias(t,f,route);
 noCompilerWrites(t,f,/canonical|symlink|junction/);
 assert.deepEqual(model.rawRead(f.catalog),before);assert.deepEqual(model.rawRead(targetCatalog),before);assert.deepEqual(model.redirectedMutations,[]);
});

test('IND-COMPILER-005 a normal preexisting catalog lock is preserved without a mkdir attempt',t=>{
 const f=fixture(t);fs.mkdirSync(f.catalog+'.lock');noCompilerWrites(t,f,/lock already exists/);
});

test('IND-COMPILER-005 an alias appearing after lock creation cannot redirect catalog reads or cleanup',t=>{
 const f=fixture(t),before=fs.readFileSync(f.catalog),target=path.join(f.base,'late-lock-parent');fs.mkdirSync(target);
 const targetCatalog=path.join(target,path.basename(f.catalog));fs.writeFileSync(targetCatalog,before);
 let active=false;const route=aliasRoute(path.dirname(f.catalog),target),model=modelAlias(t,f,file=>active?route(file):file);
 const original=fs.mkdirSync;t.mock.method(fs,'mkdirSync',(file,...args)=>{const result=original(file,...args);if(path.resolve(file)===f.catalog+'.lock')active=true;return result;});
 assert.throws(()=>admitAutomatedAdvisory(f.args),/canonical/);
 assert.deepEqual(model.rawRead(f.catalog),before);assert.deepEqual(model.rawRead(targetCatalog),before);assert.deepEqual(model.redirectedMutations,[]);
});

test('IND-COMPILER-005 a late temporary-file alias is rejected at the write boundary',t=>{
 const f=fixture(t),before=fs.readFileSync(f.catalog),target=path.join(f.base,'late-temporary-catalog.json');fs.writeFileSync(target,before);
 let active=false;const model=modelAlias(t,f,file=>active&&file.startsWith(f.catalog+'.')&&file.endsWith('.tmp')?target:file);
 const original=fs.writeFileSync;t.mock.method(fs,'writeFileSync',(file,...args)=>{const result=original(file,...args);if(path.basename(file).startsWith('catalog-before-'))active=true;return result;});
 assert.throws(()=>admitAutomatedAdvisory(f.args),/canonical/);
 assert.deepEqual(model.rawRead(f.catalog),before);assert.deepEqual(model.rawRead(target),before);assert.deepEqual(model.redirectedMutations,[]);
});

test('IND-COMPILER-005 a late final catalog alias is rejected immediately before commit',t=>{
 const f=fixture(t),before=fs.readFileSync(f.catalog),target=path.join(f.args.releaseRoot,'public/late-commit-catalog.json');fs.writeFileSync(target,before);
 let active=false,reads=0;const model=modelAlias(t,f,file=>active&&file===f.catalog?target:file);
 const original=fs.readFileSync;t.mock.method(fs,'readFileSync',(file,...args)=>{const bytes=original(file,...args);if(typeof file==='string'&&path.resolve(file)===f.catalog&&++reads===2)active=true;return bytes;});
 assert.throws(()=>admitAutomatedAdvisory(f.args),/canonical/);
 assert.deepEqual(model.rawRead(f.catalog),before);assert.deepEqual(model.rawRead(target),before);assert.deepEqual(model.redirectedMutations,[]);
});

test('IND-COMPILER-005 a late lock alias cannot redirect finally cleanup',t=>{
 const f=fixture(t),before=fs.readFileSync(f.catalog),target=path.join(f.base,'late-cleanup-lock');fs.mkdirSync(target);
 let active=false;const model=modelAlias(t,f,file=>active&&file===f.catalog+'.lock'?target:file);
 const original=fs.readFileSync;t.mock.method(fs,'readFileSync',(file,...args)=>{if(typeof file==='string'&&path.resolve(file).startsWith(f.assets+path.sep)){active=true;throw new Error('SYNTHETIC packaging interruption');}return original(file,...args);});
 assert.throws(()=>admitAutomatedAdvisory(f.args),/canonical/);
 assert.deepEqual(model.rawRead(f.catalog),before);assert.deepEqual(fs.readdirSync(target),[]);assert.deepEqual(model.redirectedMutations,[]);
});

test('Complete account-wide cadence with Published and Scheduled items strictly outside both boundaries passes',t=>{
 const f=fixture(t,{mutateNative:proof=>{const c=proof.cadence;c.items=[
  {id:'SYNTHETIC-unrelated-published-post',status:'Published',at:new Date(Date.parse(c.windowStart)-1).toISOString()},
  {id:'SYNTHETIC-course-catchup-slot',status:'Scheduled',at:new Date(Date.parse(c.windowEnd)+1).toISOString()}
 ];}});
 assert.equal(admitAutomatedAdvisory(f.args).publicationPerformed,false);
});

const badCadence=[
 ['missing cadence',proof=>{delete proof.cadence;}],
 ['family-only scope',proof=>{proof.cadence.scope='advisory-family';}],
 ['partial Published inventory',proof=>{proof.cadence.publishedComplete=false;}],
 ['partial Scheduled inventory',proof=>{proof.cadence.scheduledComplete=false;}],
 ['missing Published completeness',proof=>{delete proof.cadence.publishedComplete;}],
 ['unknown completeness',proof=>{proof.cadence.scheduledComplete='unknown';}],
 ['not clear',proof=>{proof.cadence.clear=false;}],
 ['wrong account',proof=>{proof.cadence.accountId='SYNTHETIC-another-account';}],
 ['wrong channel',proof=>{proof.cadence.channel='another-channel';}],
 ['wrong checkedAt',proof=>{proof.cadence.checkedAt=new Date(Date.parse(proof.checkedAt)-1).toISOString();}],
 ['short start window',proof=>{proof.cadence.windowStart=new Date(Date.parse(proof.cadence.windowStart)+1).toISOString();}],
 ['short end window',proof=>{proof.cadence.windowEnd=new Date(Date.parse(proof.cadence.windowEnd)-1).toISOString();}],
 ['missing items',proof=>{delete proof.cadence.items;}],
 ['ambiguous extra scope',proof=>{proof.cadence.familyOnly=true;}],
 ['Published collision',proof=>{proof.cadence.items=[{id:'SYNTHETIC-unrelated-post',status:'Published',at:proof.checkedAt}];}],
 ['course Scheduled collision',proof=>{proof.cadence.items=[{id:'SYNTHETIC-course-catchup',status:'Scheduled',at:proof.checkedAt}];}],
 ['inclusive start boundary',proof=>{proof.cadence.items=[{id:'SYNTHETIC-start',status:'Published',at:proof.cadence.windowStart}];}],
 ['inclusive end boundary',proof=>{proof.cadence.items=[{id:'SYNTHETIC-end',status:'Scheduled',at:proof.cadence.windowEnd}];}],
 ['invalid timestamp',proof=>{proof.cadence.items=[{id:'SYNTHETIC-bad-time',status:'Scheduled',at:'not a date'}];}],
 ['invalid calendar date',proof=>{proof.cadence.items=[{id:'SYNTHETIC-bad-day',status:'Published',at:'2026-02-30T00:00:00Z'}];}],
 ['missing timestamp',proof=>{proof.cadence.items=[{id:'SYNTHETIC-no-time',status:'Scheduled'}];}],
 ['unknown status',proof=>{proof.cadence.items=[{id:'SYNTHETIC-unknown-state',status:'Unknown',at:proof.checkedAt}];}],
 ['missing item ID',proof=>{proof.cadence.items=[{status:'Published',at:proof.cadence.windowStart}];}],
 ['duplicate item IDs',proof=>{const item={id:'SYNTHETIC-duplicate',status:'Published',at:new Date(Date.parse(proof.cadence.windowStart)-1).toISOString()};proof.cadence.items=[item,{...item}];}],
 ['nonarray inventory',proof=>{proof.cadence.items={};}],
 ['oversized inventory',proof=>{proof.cadence.items=Array.from({length:10001},()=>({}));}]
];
for(const channel of ['linkedin','facebook','instagram'])for(const [name,mutate] of badCadence)test(`${channel} ${name} cannot be cleared by otherwise hash-bound synthetic review evidence`,t=>{
 const f=fixture(t,{mutateNative:(proof,current)=>{if(current===channel)mutate(proof);}});
 noCompilerWrites(t,f);
});

test('A proof older than 15 minutes fails even while the independent review is younger than 24 hours',t=>{
 const f=fixture(t,{now:new Date(Date.now()-16*60000)});noCompilerWrites(t,f,/expired|future/);
});

test('Exactly 15-minute-old native cadence proof is accepted at local compilation only',t=>{
 const now=new Date(),f=fixture(t,{now});t.mock.method(Date,'now',()=>now.getTime()+12*60000);
 assert.equal(admitAutomatedAdvisory(f.args).publicationPerformed,false);
});

test('A future native proof is not interpreted as a clear current cadence window',t=>{
 const f=fixture(t,{now:new Date(Date.now()+5*60000)});noCompilerWrites(t,f,/future/);
});

test('Native proof expiring during packaging cannot commit the catalog',t=>{
 const now=new Date(),f=fixture(t,{now}),before=fs.readFileSync(f.catalog);let clock=now.getTime();
 t.mock.method(Date,'now',()=>clock);
 const original=fs.writeFileSync;t.mock.method(fs,'writeFileSync',(file,...args)=>{const result=original(file,...args);if(String(file).startsWith(f.catalog+'.')&&String(file).endsWith('.tmp'))clock=now.getTime()+13*60000;return result;});
 assert.throws(()=>admitAutomatedAdvisory(f.args),/expired/);
 assert.deepEqual(fs.readFileSync(f.catalog),before);assert.equal(fs.existsSync(f.catalog+'.lock'),false);
});

test('Editing cadence bytes cannot reuse the native proof hash or synthetic independent review',t=>{
 const f=fixture(t),file=path.join(f.args.workspace,f.evidence.nativeReconciliation.facebook.path),proof=JSON.parse(fs.readFileSync(file));
 proof.cadence.clear=false;fs.writeFileSync(file,JSON.stringify(proof));noCompilerWrites(t,f,/Evidence bytes changed/);
});
