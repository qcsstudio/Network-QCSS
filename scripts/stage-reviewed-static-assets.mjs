import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const file='src/content/reviewed-advisory-release.json',manifest=JSON.parse(fs.readFileSync(file,'utf8'));
const prefix=`/reviewed-advisories/${manifest.releaseId}/assets`;
for(const asset of manifest.assets){
 const basename=path.basename(asset.path),source=path.resolve('..','media','assets',basename),bytes=fs.readFileSync(source);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256);assert.equal(bytes.length,asset.bytes);
 const relative=`${prefix}/${basename}`,target=path.resolve('public',relative.slice(1));
 assert.ok(target.startsWith(path.resolve('public','reviewed-advisories')+path.sep));fs.mkdirSync(path.dirname(target),{recursive:true});
 if(fs.existsSync(target))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'),asset.sha256);else fs.writeFileSync(target,bytes,{flag:'wx'});
 asset.path=relative;
}
manifest.origin='https://www.qcsstudio.com';manifest.assetPathPrefix=prefix;manifest.storage='existing-qcs-static-deployment';
fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({assets:manifest.assets.length,bytes:manifest.assets.reduce((n,a)=>n+a.bytes,0),storage:manifest.storage,noDatabaseMedia:true}));
