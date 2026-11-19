import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const directory=path.resolve('..','social-pack'),video=fs.readFileSync(path.join(directory,'cisco-advisory-reel.mp4'));
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1080,height:1920}});await page.setContent(`<video id="video" src="data:video/mp4;base64,${video.toString('base64')}" preload="auto" muted></video>`);
 await page.locator('video').evaluate(v=>new Promise((resolve,reject)=>{if(v.readyState>=2)resolve();else{v.onloadeddata=resolve;v.onerror=reject;}}));
 const observations=[];
 for(let scene=0;scene<7;scene++){
  const time=scene*7+3.5;
  const frame=await page.locator('video').evaluate(async(v,time)=>{
   const presented=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('No current video frame was presented.')),10000);const frame=(_now,meta)=>{if(meta.mediaTime>=time-0.05){clearTimeout(timer);v.pause();resolve(meta.mediaTime);}else v.requestVideoFrameCallback(frame);};v.requestVideoFrameCallback(frame);v.currentTime=time;void v.play().catch(reject);});
   const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext('2d');ctx.drawImage(v,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let nonWhite=0;
   for(let i=0;i<data.length;i+=4)if(data[i+3]>0&&Math.min(data[i],data[i+1],data[i+2])<235)nonWhite++;
   return {png:c.toDataURL('image/png').split(',')[1],nonWhite,width:c.width,height:c.height,time:v.currentTime,presentedTime:presented};
  },time);
  assert.ok(frame.nonWhite>5000,`Decoded scene ${scene+1} is blank: ${frame.nonWhite}`);assert.ok(Math.abs(frame.presentedTime-time)<0.25);const bytes=Buffer.from(frame.png,'base64'),name=`decoded-scene-${scene+1}.png`;fs.writeFileSync(path.join(directory,name),bytes);observations.push({scene:scene+1,time:frame.time,presentedTime:frame.presentedTime,nonWhitePixels:frame.nonWhite,width:frame.width,height:frame.height,file:name,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 }
 assert.equal(new Set(observations.map(o=>o.sha256)).size,7,'Scene frames must be distinct, not stale seek images.');const report={checkedAt:new Date().toISOString(),videoSha256:crypto.createHash('sha256').update(video).digest('hex'),scope:'Actual presented decoded video frames at all seven scene midpoints; not native platform preview verification',observations};fs.writeFileSync(path.join(directory,'decoded-frame-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
