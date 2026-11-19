import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {publishAutomatedLinkedIn,ReviewedLinkedInError} from '../src/lib/automated-advisory-linkedin.ts';
import {decodeLinkedInLittleText} from '../src/lib/linkedin-little-text.ts';
const caption=['Vendor advisory: review the affected service.','','What Changed','The vendor published revised security guidance.','','Why It Matters','Exposure depends on the installed version and enabled service.','','Action And Verification','1. Identify installed versions.','2. Compare the official affected conditions.','3. Back up before a controlled fix.','4. Verify the service after the change.','Verification: Record the installed version and the expected service response.','','QCS technical brief: https://www.qcsstudio.com/security-advisories/fixture','','#NetworkSecurity #SecurityAdvisory #Vulnerability #PatchManagement #QCS'].join('\n');
const imageBytes=new Uint8Array([1,2,3]),imageHash=createHash('sha256').update(imageBytes).digest('hex');
const input={accountId:'fixture-member',caption,imageUrl:`https://www.qcsstudio.com/automated-advisories/fixture/${imageHash}.jpg`,alt:'Synthetic diagram'};
const connection={accountId:'fixture-member',accessToken:'synthetic-token',expiresAt:new Date(Date.now()+3600000),scope:'openid profile w_member_social',status:'connected'};
const noopHooks=Object.freeze({beforePublish:async()=>{},checkpoint:async()=>{}});
const imageAssetId='urn:li:image:fixture',externalId='urn:li:share:123456';
const publish=(f,hooks=noopHooks,request=input,member=connection,version=undefined)=>publishAutomatedLinkedIn(request,member,f.fetcher,version,hooks);
const finalPosts=f=>f.calls.filter(call=>call.url==='https://api.linkedin.com/rest/posts');
function fixture(mode='ok',onRequest=async()=>{}){
 const calls=[];
 const fetcher=async(url,options={})=>{
  calls.push({url,options});assert.notEqual(options.method,'DELETE');
  await onRequest(url,options);
  if(url.includes('initializeUpload')){
   if(mode==='initialize-error')throw new Error('synthetic-token provider-private-message');
   return Response.json({value:{uploadUrl:mode==='missing-upload'?undefined:mode==='malformed-upload'?'not a URL':mode==='hostile-upload'?'https://evil.example/upload':'https://www.linkedin.com/dms-uploads/fixture',image:mode==='invalid-asset'?'provider-private-message':imageAssetId}});
  }
  if(url===input.imageUrl)return new Response(mode==='changed-image'?new Uint8Array([9,9]):imageBytes,{headers:{'content-type':'image/jpeg'}});
  if(url.includes('/dms-uploads/')){
   if(mode==='upload-error')throw new ReviewedLinkedInError('blocked','synthetic-token provider-private-message');
   return new Response('',{status:200});
  }
  if(url==='https://api.linkedin.com/rest/posts'){
   if(mode==='timeout')throw new Error('synthetic-token provider-private-message');
   if(mode==='rejected')return Response.json({message:'synthetic-token provider-private-message'},{status:429});
   return new Response('',{status:201,headers:mode==='missing-id'?{}:{'x-restli-id':externalId}});
  }
  throw new Error('Unexpected endpoint');
 };
 return {fetcher,calls};
}

function errorIs(state,stage,known={}){
 return error=>{
  assert.ok(error instanceof ReviewedLinkedInError);
  assert.equal(error.state,state);
  assert.equal(error.stage,stage);
  assert.equal(error.publishAttempted,state==='needs_review');
  for(const [key,value] of Object.entries(known))assert.deepEqual(error[key],value);
  const serialized=`${error.stack} ${JSON.stringify(error)}`;
  for(const forbidden of [connection.accessToken,'provider-private-message','private-proof'])assert.ok(!serialized.includes(forbidden));
  return true;
 };
}
test('Publish exact reviewed text and return real API identity without deletion',async()=>{
 const f=fixture(),result=await publish(f);
 assert.equal(result.externalId,'urn:li:share:123456');
 assert.equal(result.receipt.nativeVisibilityVerified,false);
 assert.equal(result.receipt.imageAssetId,imageAssetId);
 assert.equal(result.permalink,`https://www.linkedin.com/feed/update/${externalId}/`);
 assert.equal(f.calls.filter(c=>c.url.endsWith('/rest/posts')).length,1);
 assert.equal(f.calls.some(c=>c.url.includes('openai')),false);
 const body=JSON.parse(finalPosts(f)[0].options.body);
 assert.equal(decodeLinkedInLittleText(body.commentary),caption);
 assert.equal(body.content.media.id,imageAssetId);
 assert.equal(body.author,'urn:li:person:fixture-member');
 assert.equal(f.calls[0].options.headers['Linkedin-Version'],'202607');
 assert.ok(f.calls.every(call=>call.options.redirect==='error'));
});
for(const mode of ['timeout','missing-id'])test(`Ambiguous ${mode} is needs_review, never retry/delete`,async()=>{
 const f=fixture(mode);await assert.rejects(publish(f),errorIs('needs_review','publish',{imageAssetId,externalId:undefined,progress:{stage:'dispatching',publishAttempted:true,imageAssetId}}));
 assert.equal(f.calls.filter(c=>c.url.endsWith('/rest/posts')).length,1);
});
test('Wrong member or expired access never attempts an upload',async()=>{
 const f=fixture();await assert.rejects(publish(f,noopHooks,input,{...connection,accountId:'other'}),errorIs('blocked','validation'));
 await assert.rejects(publish(f,noopHooks,input,{...connection,expiresAt:new Date()}),errorIs('blocked','validation'));assert.equal(f.calls.length,0);
});
test('Hostile upload location cannot receive a request',async()=>{
 const f=fixture('hostile-upload');await assert.rejects(publish(f),errorIs('blocked','preparation',{imageAssetId,progress:{stage:'prepared',publishAttempted:false,imageAssetId}}));assert.equal(f.calls.length,1);
});
test('Changed image bytes cannot be uploaded or posted',async()=>{
 const f=fixture('changed-image');await assert.rejects(publish(f),errorIs('blocked','upload',{imageAssetId}));
 assert.equal(f.calls.some(c=>c.options.method==='PUT'||c.url.endsWith('/rest/posts')),false);
});
test('Caption normalization is not a publication-time rewrite',async()=>{
 const f=fixture();await assert.rejects(publish(f,noopHooks,{...input,caption:caption.replaceAll('\n','\r\n')}),errorIs('blocked','validation'));assert.equal(f.calls.length,0);
});

test('Both final-boundary hooks are mandatory at validation before any network',async()=>{
 for(const hooks of [undefined,null,{}, {beforePublish:async()=>{}},{checkpoint:async()=>{}},{beforePublish:true,checkpoint:async()=>{}},{beforePublish:async()=>{},checkpoint:true}]){
  const f=fixture();
  await assert.rejects(publishAutomatedLinkedIn(input,connection,f.fetcher,undefined,hooks),errorIs('blocked','validation',{imageAssetId:undefined,externalId:undefined,progress:undefined}));
  assert.equal(f.calls.length,0);
 }
});

test('Prepared, dispatching and accepted writes bracket authorization and final transmission in order',async()=>{
 const events=[],progressValues=[];
 const f=fixture('ok',async(url,options)=>{events.push(url.includes('initializeUpload')?'initialize':options.method==='PUT'?'upload':url.endsWith('/rest/posts')?'final':'source');});
 const hooks={
  beforePublish:async()=>{await Promise.resolve();events.push('authorize');},
  checkpoint:async progress=>{await Promise.resolve();assert.ok(Object.isFrozen(progress));progressValues.push(progress);events.push(progress.stage);}
 };
 const received=await publish(f,hooks);
 events.push('returned');
 assert.equal(received.externalId,externalId);
 assert.deepEqual(events,['initialize','prepared','source','upload','authorize','dispatching','authorize','final','accepted','returned']);
 assert.deepEqual(progressValues,[
  {stage:'prepared',publishAttempted:false,imageAssetId},
  {stage:'dispatching',publishAttempted:true,imageAssetId},
  {stage:'accepted',publishAttempted:true,imageAssetId,externalId}
 ]);
 for(const progress of progressValues){
  assert.ok(Object.keys(progress).every(key=>['stage','publishAttempted','imageAssetId','externalId'].includes(key)));
  for(const forbidden of [connection.accessToken,caption,input.imageUrl,'uploadUrl','Authorization','provider-private-message'])assert.ok(!JSON.stringify(progress).includes(forbidden));
 }
});

test('Unfinished durable writes block the next request and the final result',async()=>{
 const gates=Object.fromEntries(['prepared','dispatching','accepted'].map(stage=>{
  let reached,release;
  const reachedPromise=new Promise(resolve=>{reached=resolve;}),writePromise=new Promise(resolve=>{release=resolve;});
  return [stage,{reached,release,reachedPromise,writePromise}];
 }));
 const f=fixture();let authorizations=0,returned=false;
 const hooks={beforePublish:async()=>{authorizations++;},checkpoint:async progress=>{gates[progress.stage].reached();await gates[progress.stage].writePromise;}};
 const outcome=publish(f,hooks).then(value=>{returned=true;return value;});
 void outcome.catch(()=>{});
 try{
  for(const [stage,expectedCalls,expectedAuthorizations] of [['prepared',1,0],['dispatching',3,1],['accepted',4,2]]){
   await gates[stage].reachedPromise;
   await new Promise(resolve=>setImmediate(resolve));
   assert.equal(f.calls.length,expectedCalls);assert.equal(authorizations,expectedAuthorizations);assert.equal(returned,false);
   gates[stage].release();
  }
 }finally{for(const gate of Object.values(gates))gate.release();}
 await outcome;assert.equal(returned,true);
});

test('Failed prepared checkpoint preserves the initialized image ID and prevents source fetch/upload/final POST',async()=>{
 const f=fixture();
 const hooks={beforePublish:async()=>assert.fail('No authorization expected'),checkpoint:async()=>{throw new Error('synthetic-token provider-private-message');}};
 await assert.rejects(publish(f,hooks),errorIs('blocked','preparation',{imageAssetId,progress:{stage:'prepared',publishAttempted:false,imageAssetId}}));
 assert.equal(f.calls.length,1);assert.equal(finalPosts(f).length,0);
});

test('Authorization failure on either side of the dispatch write prevents the final POST',async()=>{
 for(const failOn of [1,2]){
  const f=fixture();let authorizations=0,proofExpired=false;const stages=[];
  const hooks={
   beforePublish:async()=>{authorizations++;if(authorizations===failOn){if(failOn===2)assert.equal(proofExpired,true);throw new ReviewedLinkedInError('needs_review','synthetic-token private-proof provider-private-message');}},
   checkpoint:async progress=>{stages.push(progress.stage);if(progress.stage==='dispatching')proofExpired=true;}
  };
  await assert.rejects(publish(f,hooks),errorIs('blocked','publish',{imageAssetId,progress:{stage:failOn===1?'prepared':'dispatching',publishAttempted:failOn===2,imageAssetId}}));
  assert.equal(authorizations,failOn);assert.equal(f.calls.length,3);assert.equal(finalPosts(f).length,0);
  assert.deepEqual(stages,failOn===1?['prepared']:['prepared','dispatching']);
 }
});

test('Connection expiry during upload, durable dispatch write or final authorization cannot produce a final POST',async()=>{
 for(const phase of ['upload','dispatching','authorization']){
  const originalNow=Date.now;let now=originalNow(),authorizations=0;
  Date.now=()=>now;
  try{
   const expire=()=>{now=connection.expiresAt.getTime()-4*60000;};
   const f=fixture('ok',async(url,options)=>{if(phase==='upload'&&options.method==='PUT')expire();});
   const hooks={
    beforePublish:async()=>{authorizations++;if(phase==='authorization'&&authorizations===2)expire();},
    checkpoint:async progress=>{if(phase==='dispatching'&&progress.stage==='dispatching')expire();}
   };
   await assert.rejects(publish(f,hooks),errorIs('blocked','publish',{imageAssetId}));
   assert.equal(f.calls.length,3);assert.equal(finalPosts(f).length,0);
   assert.equal(authorizations,phase==='upload'?0:2);
  }finally{Date.now=originalNow;}
 }
});

test('Failed dispatch write stops before the second authorization or final request and preserves progress',async()=>{
 const f=fixture();let authorizations=0;
 const hooks={beforePublish:async()=>{authorizations++;},checkpoint:async progress=>{if(progress.stage==='dispatching')throw new Error('synthetic-token provider-private-message');}};
 await assert.rejects(publish(f,hooks),errorIs('blocked','publish',{imageAssetId,progress:{stage:'dispatching',publishAttempted:true,imageAssetId}}));
 assert.equal(authorizations,1);assert.equal(f.calls.length,3);assert.equal(finalPosts(f).length,0);
});

test('Failed accepted checkpoint retains both real IDs as needs_review without another request',async()=>{
 const f=fixture();
 const hooks={beforePublish:async()=>{},checkpoint:async progress=>{if(progress.stage==='accepted')throw new Error('synthetic-token provider-private-message');}};
 await assert.rejects(publish(f,hooks),errorIs('needs_review','receipt',{imageAssetId,externalId,progress:{stage:'accepted',publishAttempted:true,imageAssetId,externalId}}));
 assert.equal(f.calls.length,4);assert.equal(finalPosts(f).length,1);
});

test('A known initialized ID is checkpointed even when the upload URL is missing or malformed',async()=>{
 for(const mode of ['missing-upload','malformed-upload']){
  const f=fixture(mode),progressValues=[];
  await assert.rejects(publish(f,{beforePublish:async()=>{},checkpoint:async progress=>{progressValues.push(progress);}}),errorIs('blocked','preparation',{imageAssetId}));
  assert.deepEqual(progressValues,[{stage:'prepared',publishAttempted:false,imageAssetId}]);
  assert.equal(f.calls.length,1);
 }
});

test('An invalid provider asset ID is not checkpointed, uploaded or leaked',async()=>{
 const f=fixture('invalid-asset');let writes=0;
 await assert.rejects(publish(f,{beforePublish:async()=>{},checkpoint:async()=>{writes++;}}),errorIs('blocked','preparation',{imageAssetId:undefined}));
 assert.equal(writes,0);assert.equal(f.calls.length,1);
});

test('Preparation/upload exceptions and final API rejection are sanitized with no retry or deletion',async()=>{
 for(const [mode,state,stage,expectedCalls] of [['initialize-error','blocked','preparation',1],['upload-error','blocked','upload',3],['rejected','needs_review','publish',4]]){
  const f=fixture(mode);
  await assert.rejects(publish(f),errorIs(state,stage,{imageAssetId:mode==='initialize-error'?undefined:imageAssetId,...(mode==='rejected'?{httpStatus:429}:{})}));
  assert.equal(f.calls.length,expectedCalls);assert.equal(finalPosts(f).length,mode==='rejected'?1:0);
  assert.ok(f.calls.every(call=>call.options.method!=='DELETE'));
 }
});

test('Invalid URL/caption inputs produce safe validation errors before any request',async()=>{
 for(const request of [{...input,imageUrl:'synthetic-token not a URL'},{...input,caption:'synthetic-token provider-private-message'}]){
  const f=fixture();await assert.rejects(publish(f,noopHooks,request),errorIs('blocked','validation'));assert.equal(f.calls.length,0);
 }
});

test('Transport remains independent of ambient env, generation and deleting LinkedIn wrappers',async()=>{
 const source=await readFile(new URL('../src/lib/automated-advisory-linkedin.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/process\.env|publishLinkedInPost|method:\s*['"]DELETE['"]|api\.openai|imagegen|automated-advisory-transports|automated-advisory-worker/);
});
