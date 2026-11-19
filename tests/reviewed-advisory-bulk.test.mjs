import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
import {reviewedAdvisoryExclusion,reviewedAdvisorySelection,reviewedJobExclusion} from '../src/lib/reviewed-advisory-guard.ts';
import {reviewedFamilyPosts} from '../src/lib/reviewed-advisory-family.ts';
import {isReviewedAdvisoryFamily} from '../src/lib/reviewed-advisory-domain.ts';
import {isAutomatedFamily,getAutomatedReleases} from '../src/lib/automated-advisory-domain.ts';
import {hasAutomatedAdvisoryOwnership} from '../src/lib/automated-advisory-configuration.ts';

// Run exact exported function bodies with isolated readers; never import provider dispatchers.
function isolatedFunction(file,name,bindings){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 const node=source.statements.find(item=>ts.isFunctionDeclaration(item)&&item.name?.text===name);
 assert.ok(node,`Missing actual exported function ${name}`);
 const text=node.getText(source).replace(/^export\s+/,'');
 const code=ts.transpileModule(`${text}\n;${name}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 return vm.runInNewContext(code,{...bindings,Date,Set,Map,Number,Math},{timeout:1000});
}
function matches(row,where={}){
 return Object.entries(where).every(([key,value])=>{
  if(key==='AND')return value.every(part=>matches(row,part));
  if(key==='OR')return value.some(part=>matches(row,part));
  if(key==='NOT')return !(Array.isArray(value)?value.some(part=>matches(row,part)):matches(row,value));
  if(value&&typeof value==='object'&&Array.isArray(value.path)){
   const field=value.path.reduce((part,key)=>part&&typeof part==='object'?part[key]:undefined,row[key]);
   return typeof field==='string'&&typeof value.string_contains==='string'&&field.includes(value.string_contains);
  }
  if(value&&typeof value==='object')return Object.entries(value).every(([op,arg])=>op==='not'?row[key]!==arg:op==='in'?arg.includes(row[key]):op==='gte'?row[key]>=arg:op==='lte'?row[key]<=arg:op==='lt'?row[key]<arg:op==='contains'?value.mode==='insensitive'?String(row[key]||'').toLowerCase().includes(arg.toLowerCase()):String(row[key]||'').includes(arg):op==='mode');
  return row[key]===value;
 });
}
test('image backfill skips a protected ContentPost and reaches an ordinary item at limit one',async()=>{
 const posts=[{id:'protected',slug:'alias',content:{title:'Related CVE'}},{id:'ordinary',slug:'ordinary',content:{title:'Ordinary article'}}].map(p=>({...p,revisions:[{version:1}]}));
 const before=structuredClone(posts),generated=[];
 const db={contentPost:{findMany:async()=>posts},securityAdvisory:{findMany:async()=>[]},$queryRaw:async()=>[{id:'protected'}],editorialImage:{findUnique:async()=>null}};
 const run=isolatedFunction('src/lib/editorial-image-generation.ts','generateMissingEditorialImages',{
  getPrismaClient:()=>db,reviewedAdvisoryExclusion,reviewedAdvisorySelection,reviewedFamilyPosts,blogPosts:[{slug:'alias',title:'Static shadow'}],crypto,codexImageProvider:'test-provider',
  imageInputForArticle:(contentId,revision,content)=>({contentType:'content_post',contentId,contentRevision:revision,title:content.title}),
  buildEditorialImagePrompt:input=>input.title,
  ensureEditorialImage:async input=>{assert.notEqual(input.contentId,'protected');generated.push(input.contentId);return {status:'ready'};}
 });
 const result=await run(1);
 assert.deepEqual(generated,['ordinary']);
 assert.equal(result[0].contentId,'ordinary');
 assert.deepEqual(posts,before);
});
for(const mode of ['refresh','rebuild'])test(`${mode} excludes protected jobs before the batch limit and advances ordinary work`,async()=>{
 const date=new Date(),protectedJob={id:'protected',contentType:'security_advisory',contentId:'family',channel:'linkedin',status:'published',externalId:'123',publishedAt:date,createdAt:date,commentary:'',metadata:{}},ordinaryJob={...protectedJob,id:'ordinary',contentId:'ordinary',externalId:'456'};
 const rows=[...Array.from({length:30},(_,index)=>({...protectedJob,id:`protected-${index}`})),ordinaryJob],before=structuredClone(rows),selected=[],processed=[];
 const db={securityAdvisory:{findMany:async()=>[{id:'family'}]},$queryRaw:async()=>[],socialPublication:{findMany:async({where,take})=>{const result=rows.filter(row=>matches(row,where)).slice(0,take);selected.push(...result.map(row=>row.id));return result;}}};
 const name=mode==='refresh'?'refreshRecentOutdatedLinkedInPublications':'rebuildLinkedInPublicationsSince';
 const run=isolatedFunction('src/lib/social-publications.ts',name,{
  getPrismaClient:()=>db,reviewedJobExclusion,metadataObject:value=>value,linkedInCommentaryPolicyVersion:2,
  refreshLinkedInPublication:async id=>{processed.push(id);return {commentary:'Ordinary updated copy'};},
  rebuildLinkedInPublication:async id=>{processed.push(id);return {id,status:'updated'};}
 });
 await (mode==='refresh'?run(1,72):run(new Date(date.getTime()-1000),true));
 assert.deepEqual(selected,['ordinary']);
 assert.deepEqual(processed,['ordinary']);
 assert.deepEqual(rows,before);
});

for(const marker of [{createdBy:'reviewed-advisory-worker'},{editorialTrace:{automatedAdvisory:{releaseId:'historical-reviewed-release'}}}])test('Flag-off and empty catalog preserve reviewed native reservations during actual legacy reconciliation',async()=>{
 assert.equal(getAutomatedReleases().length,0);
 const advisory={id:'owned-prospective',slug:'historical-prospective-family',externalId:'historical',cves:[],sourceUrl:'https://example.invalid/old',revisions:[{version:2}],...marker};
 const jobs=[{id:'delivered',contentId:advisory.id,contentRevision:'1',status:'published',externalId:'urn:li:share:123'},
  {id:'native-reservation',contentId:advisory.id,contentRevision:'1',status:'held',metadata:{nativeLinkedIn:{owner:'native'}}}];
 const before=structuredClone(jobs);let deletes=0,generations=0,queueCalls=0;
 const db={securityAdvisory:{findMany:async()=>[advisory]},socialPublication:{findMany:async()=>jobs,deleteMany:async()=>{deletes++;throw new Error('Must not delete an existing reservation');}}};
 const reconcile=isolatedFunction('src/lib/social-publications.ts','reconcileAdvisoryLinkedInQueue',{
  getPrismaClient:()=>db,isReviewedAdvisoryFamily,isAutomatedFamily,hasAutomatedAdvisoryOwnership,
  storySpineForAdvisory:()=>{generations++;throw new Error('Must not generate');},
  queueLinkedInForAdvisory:async()=>{queueCalls++;throw new Error('Must not queue');}
 });
 const result=await reconcile();assert.equal(result,0);assert.equal(deletes,0);assert.equal(generations,0);assert.equal(queueCalls,0);assert.deepEqual(jobs,before);
});

for(const owner of ['createdBy','trace-only','metadata-only','empty-string-marker'])for(const channel of ['linkedin','facebook','instagram'])test(`${channel} stale recovery preserves ${owner} ownership with an empty catalog`,async()=>{
 assert.equal(getAutomatedReleases().length,0);
 const record={id:'historical-owner',slug:'historical-unlisted',externalId:'historical',sourceUrl:'https://example.invalid/old',cves:[],
  ...(owner==='createdBy'?{createdBy:'reviewed-advisory-worker'}:owner==='trace-only'?{editorialTrace:{automatedAdvisory:{releaseId:'historical-reviewed'}}}:{})};
 const future=new Date(Date.now()+86400000),jobs=[{id:'historical-native-job',contentType:'security_advisory',contentId:record.id,channel,status:'publishing',lastAttemptAt:new Date(Date.now()-3600000),nextAttemptAt:future,updatedAt:new Date(),metadata:owner==='metadata-only'||owner==='empty-string-marker'?{automatedAdvisory:{releaseId:owner==='empty-string-marker'?'':'historical-reviewed'}}:{}}];
 const records=[record],before=structuredClone(jobs);let changed=0,generation=0;
 const db={securityAdvisory:{findMany:async({where})=>records.filter(row=>matches(row,where)),findUnique:async()=>record},$queryRaw:async()=>[],socialPublication:{
  updateMany:async({where,data})=>{const selected=jobs.filter(row=>matches(row,where));for(const row of selected)Object.assign(row,data);changed+=selected.length;return {count:selected.length};},
  findMany:async({where})=>jobs.filter(row=>matches(row,where)),findFirst:async({where})=>jobs.find(row=>matches(row,where))||null
 }};
 const name=channel==='linkedin'?'processLinkedInQueue':'processMetaQueue',file=channel==='linkedin'?'src/lib/social-publications.ts':'src/lib/meta-publications.ts';
 const run=isolatedFunction(file,name,{getPrismaClient:()=>db,reviewedJobExclusion,metaConfiguration:()=>({configured:true,enabled:false}),
  assertOrdinaryAdvisoryJob:async()=>{generation++;throw new Error('Owned rows must be excluded before preparation');}});
 await (channel==='linkedin'?run(1):run(false));assert.equal(changed,0);assert.equal(generation,0);assert.deepEqual(jobs,before);
});

test('Nullable ordinary metadata remains eligible while positive ownership IDs are excluded',async()=>{
 const records=[{id:'ordinary-null',slug:'ordinary-null',externalId:'ordinary',cves:[],sourceUrl:'https://example.invalid/ordinary',createdBy:null,editorialTrace:null},
  {id:'ordinary-empty',slug:'ordinary-empty',externalId:'ordinary-two',cves:[],sourceUrl:'https://example.invalid/other',createdBy:null,editorialTrace:{}},
  {id:'protected-trace',slug:'old-owned',externalId:'old-owned',cves:[],sourceUrl:'https://example.invalid/owned',createdBy:null,editorialTrace:{automatedAdvisory:{releaseId:'old-reviewed'}}}];
 const jobs=[{id:'ordinary-job-null',contentType:'security_advisory',contentId:'ordinary-null',sourceUrl:'https://example.invalid/ordinary',commentary:'Unrelated ordinary post',metadata:null},
  {id:'ordinary-job-empty',contentType:'security_advisory',contentId:'ordinary-empty',sourceUrl:'https://example.invalid/other',commentary:'Unrelated ordinary post',metadata:{}},
  {id:'protected-job',contentType:'security_advisory',contentId:'ordinary-null',sourceUrl:'https://example.invalid/owned',commentary:'Owned metadata',metadata:{automatedAdvisory:{releaseId:'old-reviewed'}}}];
 const db={securityAdvisory:{findMany:async({where})=>records.filter(row=>matches(row,where))},socialPublication:{findMany:async({where})=>jobs.filter(row=>matches(row,where))},$queryRaw:async()=>[]};
 const selection=await reviewedAdvisorySelection(db),exclusion=await reviewedJobExclusion(db);
 assert.deepEqual(records.filter(row=>matches(row,selection)).map(row=>row.id),['ordinary-null','ordinary-empty']);
 assert.deepEqual(jobs.filter(row=>matches(row,exclusion)).map(row=>row.id),['ordinary-job-null','ordinary-job-empty']);
 assert.equal(JSON.stringify(selection).includes('path'),false);assert.equal(JSON.stringify(exclusion).includes('path'),false);
});
