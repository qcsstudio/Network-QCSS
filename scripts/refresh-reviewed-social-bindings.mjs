import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve('..','social-pack'),file=path.join(root,'render-check.json'),prior=JSON.parse(fs.readFileSync(file,'utf8'));
const {mime,...retained}=prior;
const report={...retained,requestedEncoderMime:prior.requestedEncoderMime||mime,bindingRefreshedAt:new Date().toISOString(),files:prior.files.map(item=>{const bytes=fs.readFileSync(path.join(root,item.file));return {...item,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};})};
fs.writeFileSync(file,JSON.stringify(report,null,2));console.log(JSON.stringify({updatedBindings:report.files.length,requestedEncoderMime:report.requestedEncoderMime,actualVideoReencoded:false,review:'pending'}));
