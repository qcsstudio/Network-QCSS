import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {transform} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {chromium} from 'playwright';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {syntheticRelease} from '../tests/helpers/automated-release-fixture.mjs';
import {automatedCandidateHash} from '../src/lib/automated-advisory-domain.ts';

const root=process.cwd(),directory=path.join(root,'test-results/automated-advisory-ui');await fs.mkdir(directory,{recursive:true});
const diagram=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="730" viewBox="0 0 1300 730"><rect width="1300" height="730" fill="#f7f9fc"/><text x="80" y="125" font-family="Arial" font-size="76" fill="#a61950">Service boundary</text><rect x="65" y="230" width="470" height="210" rx="8" fill="#fff" stroke="#2c7586" stroke-width="6"/><rect x="765" y="230" width="470" height="210" rx="8" fill="#fff" stroke="#a61950" stroke-width="6"/><text x="300" y="355" text-anchor="middle" font-family="Arial" font-size="76" fill="#172438">Operator</text><text x="1000" y="355" text-anchor="middle" font-family="Arial" font-size="76" fill="#172438">Service</text><path d="M560 335 H735 M705 310 L735 335 L705 360" fill="none" stroke="#2c7586" stroke-width="7"/><text x="650" y="480" text-anchor="middle" font-family="Arial" font-size="76" fill="#172438">Verify</text><text x="80" y="640" font-family="Arial" font-size="58" fill="#52617a">Synthetic UI test diagram</text></svg>')).png().toBuffer();
const image=`data:image/png;base64,${diagram.toString('base64')}`;
const require=createRequire(import.meta.url),styles=new Proxy({},{get:(_target,key)=>String(key)});
async function load(file,mocks={}){
 const source=await fs.readFile(path.join(root,file),'utf8'),compiled=await transform(source,{loader:'tsx',format:'cjs',jsx:'automatic'}),m={exports:{}};
 vm.runInNewContext(compiled.code,{module:m,exports:m.exports,process,URL,Buffer,require:id=>Object.hasOwn(mocks,id)?mocks[id]:require(id)},{filename:file});return m.exports;
}
const structured=await load('src/components/structured-data.tsx');
const {AutomatedAdvisoryArticle}=await load('src/components/automated-advisory-article.tsx',{
 'next/link':({children,...props})=>createElement('a',props,children),
 'next/image':props=>{const p={...props};delete p.unoptimized;delete p.priority;return createElement('img',p);},
 './structured-data':structured,'@/lib/content':{siteConfig:{name:'QuantumCrafters Studio Private Limited',url:'https://www.qcsstudio.com'}},
 '@/lib/automated-advisory-domain':{automatedAssetUrl:()=>image,automatedCandidateHash},
 './reviewed-advisory-article.module.css':{__esModule:true,default:styles}
});
const r=syntheticRelease();r.assets[0].width=1300;r.assets[0].height=730;
const content=renderToStaticMarkup(createElement(AutomatedAdvisoryArticle,{release:r,canonical:`https://www.qcsstudio.com/security-advisories/${r.slug}`,publishedAt:new Date().toISOString(),modifiedAt:new Date().toISOString()}));
const globalCss=await fs.readFile(path.join(root,'src/app/globals.css'),'utf8'),moduleCss=await fs.readFile(path.join(root,'src/components/reviewed-advisory-article.module.css'),'utf8');
const file=path.join(directory,'component-preview.html');
await fs.writeFile(file,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Private component QA</title><style>${globalCss}\n${moduleCss}\n:root{--font-body:Arial;--font-heading:Arial}body{margin:0}a{overflow-wrap:anywhere}</style>${content}</html>`);
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const results=[];
try{
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  await context.route('https://**/*',route=>route.abort());
  const page=await context.newPage();await page.goto(pathToFileURL(file).href,{waitUntil:'load'});
  await page.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
  const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,images:[...document.images].map(i=>({complete:i.complete,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight})),textOverflow:[...document.querySelectorAll('h1,h2,h3,p,li,dt,dd')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.tagName+':'+e.textContent.slice(0,60))}));
  assert.ok(metrics.scrollWidth<=width+1,JSON.stringify(metrics));assert.deepEqual(metrics.textOverflow,[]);assert.ok(metrics.images.every(i=>i.complete&&i.naturalWidth===1300));
  const first=path.join(directory,`component-${width}.png`);await page.screenshot({path:first,fullPage:false});
  await page.locator('figure').screenshot({path:path.join(directory,`diagram-${width}.png`)});
  const stats=await sharp(first).stats();assert.ok(stats.channels.some(c=>c.stdev>15),'Screenshot must contain rendered content.');
  results.push({...metrics,screenshot:first,reducedMotion:'reduce'});await context.close();
 }
}finally{await browser.close();}
const report={checkedAt:new Date().toISOString(),kind:'actual-component-browser-qa',scope:'Synthetic private fixture; actual renderer and CSS. Excludes global header/footer, live data, publication, platform previews and real advisory technical/media approval.',productionWrites:0,platformSubmissions:0,results};
await fs.writeFile(path.join(directory,'browser-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
