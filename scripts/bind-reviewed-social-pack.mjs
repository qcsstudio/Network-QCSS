import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {stableHash} from '../src/lib/reviewed-advisory-domain.ts';
const root=path.resolve('..','social-pack'),receiptPath=path.resolve(process.argv[2]||''),receiptBytes=fs.readFileSync(receiptPath),receipt=JSON.parse(receiptBytes);
assert.equal(receipt.verdict,'PASS','Never stage a social pack without a genuine exact independent PASS.');assert.equal(receipt.reviewer.socialPackAuthorshipOrRepairPerformed,false);assert.equal(receipt.reviewer.independentReview,true);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const required=['linkedin-poster.jpg','cisco-advisory-reel.mp4','linkedin-caption.txt','facebook-caption.txt','instagram-caption.txt','storyboard.json','render-check.json','decoded-frame-check.json',...Array.from({length:7},(_,i)=>`decoded-scene-${i+1}.png`)];
for(const file of required){const binding=receipt.reviewedFiles.find(f=>f.path===file);assert.ok(binding,`Missing exact review binding: ${file}`);const bytes=fs.readFileSync(path.join(root,file));assert.equal(sha(bytes),binding.sha256);assert.equal(bytes.length,binding.bytes);}
const file='src/content/reviewed-advisory-release.json',manifest=JSON.parse(fs.readFileSync(file,'utf8'));
assert.equal(manifest.origin,'https://www.qcsstudio.com');
const assets=[...manifest.assets.filter(a=>!a.key.startsWith('social/'))];
for(const [name,mimeType] of [['linkedin-poster.jpg','image/jpeg'],['cisco-advisory-reel.mp4','video/mp4']]){const bytes=fs.readFileSync(path.join(root,name)),hash=sha(bytes),ext=path.extname(name),relative=`${manifest.assetPathPrefix}/${hash}${ext}`,target=path.resolve('public',relative.slice(1));assert.ok(target.startsWith(path.resolve('public','reviewed-advisories')+path.sep));if(fs.existsSync(target))assert.equal(sha(fs.readFileSync(target)),hash);else fs.writeFileSync(target,bytes,{flag:'wx'});assets.push({key:`social/${name}`,path:relative,sha256:hash,bytes:bytes.length,mimeType});}
const accounts={linkedin:'https://www.linkedin.com/in/rksankhyan/',facebook:'428759466975905',instagram:'@qcsstudio'},social={};
for(const channel of ['linkedin','facebook','instagram']){const raw=fs.readFileSync(path.join(root,`${channel}-caption.txt`),'utf8');assert.ok(raw.endsWith('\n')&&!raw.endsWith('\n\n'));const caption=raw.slice(0,-1),asset=assets.find(a=>a.key===`social/${channel==='linkedin'?'linkedin-poster.jpg':'cisco-advisory-reel.mp4'}`),accountId=accounts[channel],mediaUrl=new URL(asset.path,manifest.origin).href;assert.ok(caption.includes(manifest.canonical));social[channel]={caption,captionFileSha256:sha(Buffer.from(raw)),accountId,assetKey:asset.key,payloadSha256:stableHash({channel,caption,accountId,assetSha256:asset.sha256,mediaUrl})};}
fs.writeFileSync(file,JSON.stringify({...manifest,assets,social,socialReviewSha256:sha(receiptBytes)},null,2)+'\n');console.log(JSON.stringify({assets:assets.length,socialChannels:Object.keys(social),socialReviewSha256:sha(receiptBytes),publicationAttempted:false}));
