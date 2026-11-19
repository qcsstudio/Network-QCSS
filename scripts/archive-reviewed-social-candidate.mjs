import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve('..','social-pack'),reviewFile='independent-review-20261119.json',review=JSON.parse(fs.readFileSync(path.join(root,reviewFile),'utf8')),target=path.join(root,'revision-1-changes-required');
fs.mkdirSync(target,{recursive:true});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
for(const item of review.reviewedFiles){const file=path.resolve(root,item.path);assert.ok(file.startsWith(root+path.sep));const bytes=fs.readFileSync(file);assert.equal(sha(bytes),item.sha256);const destination=path.join(target,item.path);if(fs.existsSync(destination))assert.equal(sha(fs.readFileSync(destination)),item.sha256);else fs.writeFileSync(destination,bytes,{flag:'wx'});}
const receipt=fs.readFileSync(path.join(root,reviewFile));if(!fs.existsSync(path.join(target,reviewFile)))fs.writeFileSync(path.join(target,reviewFile),receipt,{flag:'wx'});
console.log(JSON.stringify({archivedFiles:review.reviewedFiles.length,priorVerdict:review.verdict,target}));
