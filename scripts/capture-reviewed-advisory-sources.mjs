import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parse} from 'parse5';
const root=path.resolve('..','evidence','primary-sources');fs.mkdirSync(root,{recursive:true});
const urls=['https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/cisco-sa-oct2026-node-js-Jj3SQ19u','https://nodejs.org/en/blog/vulnerability/october-2026-security-releases'];
const records=[];
const text=node=>['script','style'].includes(node.tagName)?'':node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join(' ');
for(const [index,url] of urls.entries()){
 const observation={url,checkedAt:new Date().toISOString()};
 try{const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});observation.status=response.status;observation.contentType=response.headers.get('content-type');if(!response.ok)throw new Error(`HTTP ${response.status}`);const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>8000000)throw new Error('Unexpectedly large source response.');observation.sha256=crypto.createHash('sha256').update(bytes).digest('hex');observation.bytes=bytes.length;const filename=`${Date.now()}-${index}.html`;fs.writeFileSync(path.join(root,filename),bytes,{flag:'wx'});observation.file=filename;const plain=text(parse(bytes.toString('utf8'))).replace(/\s+/g,' ');observation.allFourCvesPresent=['CVE-2026-111497','CVE-2026-105482','CVE-2026-105483','CVE-2026-106069'].every(c=>plain.includes(c));if(index===0)observation.ciscoRevision114Present=/Version\s+1\.14/.test(plain);}
 catch(error){observation.error=error.message;}
 records.push(observation);
}
const result={checkedAt:new Date().toISOString(),scope:'Read-only primary-source byte capture; automated presence checks are not an independent technical review',records};const file=path.join(root,`capture-${Date.now()}.json`);fs.writeFileSync(file,JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify({file,...result}));if(records.some(r=>r.error||!r.allFourCvesPresent)||!records[0].ciscoRevision114Present)process.exitCode=1;
