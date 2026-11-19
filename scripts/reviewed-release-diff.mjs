import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const baseline=path.resolve(process.argv[2]),current=process.cwd(),out=path.resolve('..','reviews');fs.mkdirSync(out,{recursive:true});
const ignored=new Set(['node_modules','.next','.vercel','.git','test-results']);
const files=directory=>{const all=[];function walk(root,prefix=''){for(const entry of fs.readdirSync(root,{withFileTypes:true})){if(ignored.has(entry.name))continue;const relative=prefix+entry.name;if(entry.isDirectory())walk(path.join(root,entry.name),relative+'/');else if(entry.isFile()&&!relative.endsWith('.tsbuildinfo'))all.push(relative);}}walk(directory);return all;};
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const old=files(baseline),next=files(current),changes=[];
for(const file of next){const absolute=path.join(current,file),before=path.join(baseline,file),beforeSha256=fs.existsSync(before)?sha(before):null,afterSha256=sha(absolute);if(beforeSha256!==afterSha256)changes.push({file,action:beforeSha256?'modified':'added',beforeSha256,afterSha256,bytes:fs.statSync(absolute).size});}
const removed=old.filter(file=>!next.includes(file));
const report={checkedAt:new Date().toISOString(),baseline,current,changes,removed};const name=path.join(out,`source-diff-${Date.now()}.json`);fs.writeFileSync(name,JSON.stringify(report,null,2));console.log(JSON.stringify({file:name,changes:changes.length,removed,paths:changes.map(c=>c.file)}));
