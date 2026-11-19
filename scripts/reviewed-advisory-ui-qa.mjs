import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{build}=require('esbuild'),{chromium}=require('playwright');
const candidateRoot=process.env.QCS_REVIEWED_FIXTURE_ROOT;assert.ok(candidateRoot);
const qa=path.resolve('test-results','reviewed-advisory-ui');fs.mkdirSync(qa,{recursive:true});
const entry=path.join(qa,'entry.tsx');
fs.writeFileSync(entry,`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {ReviewedAdvisoryArticle} from ${JSON.stringify(path.resolve('src/components/reviewed-advisory-article.tsx').replaceAll('\\','/'))};export function render(release:any){return renderToStaticMarkup(<ReviewedAdvisoryArticle release={release} publishedAt="2026-11-18T08:39:22.500Z" modifiedAt="2026-11-18T08:39:22.531Z" canonical="https://www.qcsstudio.com/security-advisories/cisco-cisco-sa-oct2026-node-js-jj3sq19u"/>);}`);
await build({entryPoints:[entry],outfile:path.join(qa,'renderer.cjs'),bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',tsconfig:path.resolve('tsconfig.json'),nodePaths:[path.resolve('node_modules')],loader:{'.module.css':'local-css'},logLevel:'silent'});
const {render}=require(path.join(qa,'renderer.cjs'));
const manifest=JSON.parse(fs.readFileSync('src/content/reviewed-advisory-release.json','utf8'));
const candidate=JSON.parse(fs.readFileSync(path.join(candidateRoot,'qcs-resource-draft.json'),'utf8'));
const releaseAt=origin=>({releaseId:manifest.releaseId,candidateSha256:manifest.candidateSha256,guide:candidate.post,origin,assets:manifest.assets});
const server=http.createServer((request,response)=>{
 const pathname=new URL(request.url,'http://localhost').pathname;
 if(pathname.startsWith(manifest.assetPathPrefix+'/')){const name=path.basename(pathname),file=path.resolve('..','media','assets',name);if(!manifest.assets.some(a=>a.path===pathname)){response.writeHead(404);response.end();return;}response.setHeader('Content-Type',name.endsWith('.svg')?'image/svg+xml':'image/png');response.end(fs.readFileSync(file));return;}
 if(pathname==='/renderer.css'){response.setHeader('Content-Type','text/css');response.end(fs.readFileSync(path.join(qa,'renderer.css')));return;}
 const origin=`http://127.0.0.1:${server.address().port}`,release=releaseAt(origin);
 response.setHeader('Content-Type','text/html; charset=utf-8');response.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/renderer.css"><style>body{margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}a{color:#a12457}</style></head><body>${render(release)}</body></html>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu']});
const results=[];
try{
 const {verifyPublicReviewedRelease}=await import(pathToFileURL(path.resolve('src/lib/reviewed-advisory-domain.ts')));
 await verifyPublicReviewedRelease(releaseAt(`http://127.0.0.1:${server.address().port}`),async url=>{assert.equal(url,manifest.canonical);return fetch(`http://127.0.0.1:${server.address().port}/`);});
 for(const [width,height,reducedMotion] of [[1440,1000,'no-preference'],[390,844,'no-preference'],[320,780,'reduce']]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
  assert.equal(await page.locator('figure img').count(),5);assert.equal(await page.locator('h1').count(),1);
  assert.equal(await page.locator('a[href="/#contact"]').count(),1);
  for(const image of await page.locator('figure img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(img=>img.decode());}
  await page.locator('#sources').scrollIntoViewIfNeeded();await page.waitForTimeout(350);
  const images=await page.locator('figure img').evaluateAll(imgs=>imgs.map(i=>({complete:i.complete,width:i.naturalWidth,height:i.naturalHeight,src:i.currentSrc})));
  assert.ok(images.every(i=>i.complete&&(i.src.endsWith('.svg')?i.width>=320&&i.height>=500:i.width>=1080&&i.height>=1415)),JSON.stringify(images));if(reducedMotion==='reduce')assert.ok(images.every(i=>i.src.endsWith('.png')));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
  const text=await page.locator('main').innerText();for(const v of candidate.post.vulnerabilities)assert.ok(text.includes(v.vendorExplanation));for(const s of candidate.post.sections)assert.ok(text.includes(s.body));assert.doesNotMatch(text,/Codex|independent.*review|paid API|AI.generated/i);
  await page.screenshot({path:path.join(qa,`article-${width}-${reducedMotion}-sources.png`)});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(qa,`article-${width}-${reducedMotion}-top.png`)});await page.locator('#vulnerabilities').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(qa,`article-${width}-${reducedMotion}-diagram.png`)});
  results.push({width,height,reducedMotion,images:images.length,noOverflow:true,errors});await page.close();
 }
 fs.writeFileSync(path.join(qa,'actual-component-ui-checks.json'),JSON.stringify({checkedAt:new Date().toISOString(),scope:'Actual article component rendered locally; not live production, not global header/footer or network-device runtime',localFullHtmlTextVerifier:true,results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
