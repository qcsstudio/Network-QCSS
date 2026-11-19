import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{build}=require('esbuild'),{chromium}=require('playwright');
const out=path.resolve('test-results','reviewed-controls-ui');fs.mkdirSync(out,{recursive:true});
const entry=path.join(out,'entry.tsx');fs.writeFileSync(entry,`import React from 'react';import {createRoot} from 'react-dom/client';import {ReviewedAdvisoryControls} from ${JSON.stringify(path.resolve('src/components/reviewed-advisory-controls.tsx').replaceAll('\\','/'))};createRoot(document.getElementById('root')!).render(<ReviewedAdvisoryControls id="synthetic-ui-fixture" onClose={()=>{}}/>);`);
await build({entryPoints:[entry],outfile:path.join(out,'app.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',tsconfig:path.resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
const requests=[],snapshot={baselineSha256:'synthetic-baseline',advisory:{title:'Synthetic test advisory',firstSeenAt:'2026-11-18T08:39:22Z',revisions:[{version:2}]},jobs:[],aliases:[],configuration:{canonical:'https://example.invalid/fixture',manifestSha256:'synthetic-manifest',originConfigured:true,socialConfigured:true}};
const server=http.createServer(async(req,res)=>{
 if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(path.join(out,'app.js')));return;}
 if(req.url.startsWith('/api/admin/')){
  res.setHeader('Content-Type','application/json');if(req.method==='GET'){res.end(JSON.stringify({ok:true,snapshot}));return;}
  const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks));requests.push(body);let result;
  if(body.action==='reserve'){const channel=body.channel;result={jobId:`fixture-${channel}`,channel,dispatchToken:`synthetic-${channel}-intent`,dispatchAt:new Date().toISOString(),caption:'Synthetic UI fixture only, not a publication.',mediaUrl:'https://example.invalid/fixture.mp4',payloadSha256:'synthetic-payload',status:'publishing'};snapshot.jobs.push({id:result.jobId,channel,status:'publishing',externalId:null,metadata:{reviewedLocalRelease:{mode:'server-controlled-native-handoff-v1',manifestSha256:snapshot.configuration.manifestSha256,dispatchToken:result.dispatchToken,dispatchStartedAt:result.dispatchAt,payloadSha256:result.payloadSha256,destinationPayload:{caption:result.caption,mediaUrl:result.mediaUrl}}}});}
  else if(body.action==='uncertain'){snapshot.jobs.find(j=>j.id===body.jobId).status='needs_review';result={status:'needs_review'};}
  else if(body.action==='receipt'){const job=snapshot.jobs.find(j=>j.id===body.jobId);job.status='published';job.externalId=body.proof.platformId;result={status:'published',url:'https://example.invalid/receipt'};}
  else throw new Error('Unexpected action in isolated UI test; no publication action is implemented.');
  res.end(JSON.stringify({ok:true,result}));return;
 }
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:20px;font:15px Arial}*{box-sizing:border-box}label{display:block;margin:12px 0}input,select{max-width:100%}button{margin:6px;padding:8px}pre{max-width:100%}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const button=name=>page.getByRole('button',{name,exact:true}),upload=(label,value)=>page.getByLabel(label,{exact:true}).setInputFiles({name:'synthetic-ui-evidence.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
 await button('Load current record').click();await page.getByRole('combobox').waitFor();assert.equal(requests.length,0);
 await upload('Current deployment and writer-drain evidence',{testOnly:true});
 for(const channel of ['facebook','instagram']){await page.getByRole('combobox').selectOption(channel);await upload('Fresh native Published/Scheduled reconciliation',{testOnly:true,destination:channel});await button('Reserve selected destination').click();await page.waitForFunction(channel=>document.querySelector('pre')?.textContent?.includes(`fixture-${channel}`),channel);}
 assert.equal(requests.filter(r=>r.action==='reserve').length,2);assert.equal(await page.getByRole('list',{name:'Retained destination reservations'}).locator('li').count(),2);
 await page.getByRole('combobox').selectOption('facebook');assert.ok((await page.locator('pre').innerText()).includes('synthetic-facebook-intent'));assert.equal(await button('Reserve selected destination').isDisabled(),true);
 await page.reload();await button('Load current record').click();await page.getByRole('combobox').selectOption('facebook');assert.ok((await page.locator('pre').innerText()).includes('synthetic-facebook-intent'));assert.equal(requests.filter(r=>r.action==='reserve').length,2);
 await button('Mark uncertain; do not retry').click();await page.getByRole('status').filter({hasText:'needs_review'}).waitFor();assert.equal(requests.at(-1).jobId,'fixture-facebook');assert.equal(await button('Mark uncertain; do not retry').isDisabled(),true);
 await upload('Native receipt and evidence (after posting)',{platformId:'synthetic-native-id',testOnly:true});await button('Record verified receipt').click();await page.getByRole('status').filter({hasText:'published'}).waitFor();await upload('Fresh native Published/Scheduled reconciliation',{testOnly:true});assert.equal(await button('Reserve selected destination').isDisabled(),true);
 await page.getByRole('combobox').selectOption('instagram');assert.ok((await page.locator('pre').innerText()).includes('synthetic-instagram-intent'));assert.equal(requests.filter(r=>r.action==='reserve').length,2);assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(out,'controls-desktop.png')});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:path.join(out,'controls-mobile.png')});
 const report={checkedAt:new Date().toISOString(),scope:'Isolated actual React component with synthetic mocked API only; no real authentication, database, reservations, native receipts or publishing',checks:{bothMetaIntentsBeforeAnyReceipt:true,channelStateRetained:true,recoveredAfterReload:true,uncertainIndependent:true,confirmedDestinationBlocked:true,noAutoReservation:true,noOverflow:true},requests:requests.map(r=>({action:r.action,channel:r.channel,jobId:r.jobId})),errors};fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
