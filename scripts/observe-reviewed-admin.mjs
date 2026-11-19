import fs from 'node:fs';
import path from 'node:path';
import {connectNative} from '../../../social-browser-20261116/native-meta-cdp.mjs';
const tabs=await(await fetch('http://127.0.0.1:9223/json/list')).json();
const candidates=tabs.filter(t=>t.type==='page'&&new URL(t.url).hostname==='www.qcsstudio.com'&&new URL(t.url).pathname.startsWith('/admin'));
if(candidates.length>1)throw new Error('Choose one QCS Admin tab; no input was sent.');
const target=candidates[0]||await(await fetch('http://127.0.0.1:9223/json/new?https://www.qcsstudio.com/admin',{method:'PUT'})).json();
await new Promise(resolve=>setTimeout(resolve,1500));
const page=await connectNative(`target:${target.id}`,'www.qcsstudio.com');
try{
 await page.call('Page.reload',{ignoreCache:true});await new Promise(resolve=>setTimeout(resolve,2500));
 const observation=await page.evaluate('({observedAt:new Date().toISOString(),origin:location.origin,path:location.pathname,title:document.title,headings:[...document.querySelectorAll("h1,h2")].map(e=>e.innerText).slice(0,12),loginForm:!!document.querySelector("input[type=password]"),buttons:[...document.querySelectorAll("button")].map(e=>e.innerText||e.getAttribute("aria-label")).filter(Boolean).slice(0,20)})');
 const out=path.resolve('..','evidence','native-state');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`admin-${Date.now()}.json`),JSON.stringify(observation,null,2));console.log(JSON.stringify(observation));
}finally{page.close();}
