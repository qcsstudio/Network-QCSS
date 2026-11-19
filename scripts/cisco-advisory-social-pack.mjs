import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright'),sharp=require('sharp');
const out=path.resolve('..','social-pack');fs.mkdirSync(out,{recursive:true});
const candidateRoot=process.env.QCS_REVIEWED_FIXTURE_ROOT;assert.ok(candidateRoot);
const canonical='https://www.qcsstudio.com/security-advisories/cisco-cisco-sa-oct2026-node-js-jj3sq19u';
const source='https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/cisco-sa-oct2026-node-js-Jj3SQ19u';
const scenes=[
 {title:['Cisco advisory','Node.js + Brotli'],subtitle:'Four vulnerabilities. Start with your product and deployment mode.',nodes:['Memory safety','DNS resolution','TLS identity'],note:'Product impact is not the same as a CVE list.'},
 {title:['CVE-2026-111497','Brotli memory safety'],subtitle:'Malformed compressed input can corrupt memory and may allow code execution.',nodes:['Compressed input','Brotli decoder','Application memory'],note:'The risk depends on the affected decoding path.'},
 {title:['CVE-2026-105482','DNS name truncation'],subtitle:'An embedded NUL character can make the resolved name differ from the checked name.',nodes:['Name checked','DNS lookup','Destination chosen'],note:'Validation and resolution must agree.'},
 {title:['Two TLS identity','checking flaws'],subtitle:'CVE-2026-105483 and CVE-2026-106069 involve unusual IP address forms.',nodes:['Endpoint input','Certificate check','Trust decision'],note:'Affected conditions differ. Read both explanations.'},
 {title:['Check Cisco product','status first'],subtitle:'Nexus 3000/9000 standalone NX-OS Guest Shell is listed as impacted.',nodes:['Model and release','Standalone or ACI?','Guest Shell status'],note:'Other Cisco products have their own investigation status.'},
 {title:['Check. Plan. Verify.'],subtitle:'Use product-specific Cisco guidance. Do not manually replace an appliance\'s bundled Node.js.',nodes:['Confirm applicability','Check supported fix','Validate and recover'],note:'A future target date is not proof a download is available.'},
 {title:['Read the QCS guide'],subtitle:'Plain-language CVE explanations, diagrams, read-only checks and original vendor links.',nodes:['qcsstudio.com','Security Advisory Desk','Cisco Node.js guide'],note:'Assess your environment before approving a change.'}
];
const explanation=`Cisco's Node.js and Brotli advisory covers four vulnerabilities, not one identical risk across every device.\n\nCVE-2026-111497: malformed Brotli-compressed input can corrupt decoder memory and may lead to code execution.\nCVE-2026-105482: DNS name truncation can make an application resolve a different name from the one it checked.\nCVE-2026-105483 and CVE-2026-106069: unusual IP address forms can undermine TLS identity checking under their documented conditions.\n\nStart with the exact model, software release and operating mode. Cisco lists Nexus 3000/9000 standalone NX-OS Guest Shell as impacted; ACI mode and other products have separate status. Under investigation is neither confirmed impact nor an all-clear.\n\nUse Cisco's supported product-specific remediation. Verify availability and compatibility of the Guest Shell 4.9 or NX-OS path for your device; future target dates are not proof that software is downloadable. Do not manually replace bundled Node.js inside an appliance. Back up, define rollback and retain before/after evidence.\n\nThe animation illustrates software behaviour, not a recorded exploit or device test.`;
const tags='#Cisco #NetworkSecurity #CyberSecurity #VulnerabilityManagement #NetworkEngineering #QCSStudio';
const captions={
 linkedin:`${explanation.replace('The animation illustrates','The diagram illustrates')}\n\nRead the detailed QCS assessment:\n${canonical}\n\nOriginal Cisco advisory:\n${source}\n\n${tags}`,
 facebook:`${explanation}\n\nDetailed QCS guide:\n${canonical}\n\nOriginal Cisco advisory:\n${source}\n\n${tags}`,
 instagram:`${explanation}\n\nVisit qcsstudio.com and open Security Advisories to find the Cisco Node.js and Brotli guide. Caption URLs are references, not clickable Instagram links:\n${canonical}\n\nOriginal Cisco advisory:\n${source}\n\n${tags}`
};
for(const [channel,caption] of Object.entries(captions)){assert.ok(caption.length<=(channel==='linkedin'?3000:2200));fs.writeFileSync(path.join(out,`${channel}-caption.txt`),caption+'\n');}
fs.writeFileSync(path.join(out,'storyboard.json'),JSON.stringify({sceneSeconds:7,scenes,captions,source,canonical,audio:'none',production:'Local canvas motion graphics; no recorded device or exploit runtime'},null,2));
if(process.argv.includes('--captions-only')){console.log(JSON.stringify({captionsUpdated:true,videoAndPosterUnchanged:true}));process.exit(0);}
await sharp(path.join(candidateRoot,'graphics/overview-desktop.png')).jpeg({quality:94,chromaSubsampling:'4:4:4'}).toFile(path.join(out,'linkedin-poster.jpg'));
const server=http.createServer((request,response)=>{
 const p=new URL(request.url,'http://localhost').pathname;
 if(p==='/logo.png'){response.setHeader('Content-Type','image/png');response.end(fs.readFileSync('public/brand/quantumcrafters-logo.png'));return;}
 if(p==='/muxer.js'){response.setHeader('Content-Type','application/javascript');response.end(fs.readFileSync(path.resolve('..','video-tools','node_modules/mp4-muxer/build/mp4-muxer.js')));return;}
 if(p==='/reel.mp4'){response.setHeader('Content-Type','video/mp4');response.end(fs.readFileSync(path.join(out,'cisco-advisory-reel.mp4')));return;}
 response.setHeader('Content-Type','text/html');response.end('<!doctype html><html><body style="margin:0"><canvas id="canvas" width="1080" height="1920"></canvas></body></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1080,height:1920}});await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.addScriptTag({url:`http://127.0.0.1:${server.address().port}/muxer.js`});
 const rendered=await page.evaluate(async({scenes})=>{
  const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d');const logo=new Image();logo.src='/logo.png';await logo.decode();
  const ink='#24323f',accent='#ac2057',teal='#167b86',line='#cdd9e2';
  function lines(text,maxWidth,font){ctx.font=font;const result=[];for(const paragraph of text.split('\n')){let current='';for(const word of paragraph.split(' ')){const next=current?current+' '+word:word;if(ctx.measureText(next).width>maxWidth&&current){result.push(current);current=word;}else current=next;}if(current)result.push(current);}return result;}
  function text(value,x,y,width,font,color,lineHeight){ctx.fillStyle=color;ctx.font=font;const result=lines(value,width,font);for(const [i,l] of result.entries())ctx.fillText(l,x,y+i*lineHeight);return result.length*lineHeight;}
  function draw(t){const index=Math.min(6,Math.floor(t/7)),s=scenes[index],phase=(t%7)/7;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1080,1920);ctx.drawImage(logo,76,176,330,330*logo.naturalHeight/logo.naturalWidth);text('QCS / SECURITY ADVISORY',76,318,800,'bold 28px Arial',accent,36);
   let y=420;for(const title of s.title){y+=text(title,76,y,820,'bold 64px Arial',ink,76);}text(s.subtitle,76,y+32,810,'39px Arial',ink,52);
   for(let i=0;i<3;i++){const top=790+i*180;ctx.fillStyle=i===index%3?'#eef7f8':'#f4f6f9';ctx.fillRect(116,top,754,124);ctx.strokeStyle=i===index%3?teal:line;ctx.lineWidth=3;ctx.strokeRect(116,top,754,124);ctx.fillStyle=accent;ctx.font='bold 32px Arial';ctx.fillText(String(i+1).padStart(2,'0'),145,top+57);const label=lines(s.nodes[i],610,'bold 42px Arial');ctx.font='bold 42px Arial';ctx.fillStyle=ink;for(const [j,l] of label.entries())ctx.fillText(l,218,top+63+(j-(label.length-1)/2)*48);
    if(i<2&&[1,2,3,5].includes(index)){ctx.strokeStyle=teal;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(493,top+133);ctx.lineTo(493,top+170);ctx.stroke();ctx.beginPath();ctx.moveTo(478,top+158);ctx.lineTo(493,top+173);ctx.lineTo(508,top+158);ctx.stroke();const py=top+133+((phase*3+i/2)%1)*30;ctx.fillStyle=accent;ctx.fillRect(485,py,16,16);}
   }
   text(s.note,76,1338,810,'32px Arial',teal,42);ctx.fillStyle=line;ctx.fillRect(76,1500,810,5);ctx.fillStyle=accent;ctx.fillRect(76,1500,810*Math.min(1,t/49),5);text(`${index+1} / 7`,76,1550,200,'28px Arial',ink,34);text('qcsstudio.com',590,1550,300,'bold 30px Arial',accent,36);
  }
  const config={codec:'avc1.42002a',width:1080,height:1920,bitrate:4500000,framerate:30,hardwareAcceleration:'prefer-software',avc:{format:'avc'}};
  if(!(await VideoEncoder.isConfigSupported(config)).supported)throw new Error('Native H.264 encoding is unavailable; no substitute is uploaded.');
  const muxer=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:'avc',width:1080,height:1920,frameRate:30},fastStart:'in-memory'});let encodedFrames=0,encodingError;
  const encoder=new VideoEncoder({output:(chunk,meta)=>{muxer.addVideoChunk(chunk,meta);encodedFrames++;},error:error=>{encodingError=error;}});encoder.configure(config);
  for(let index=0;index<1470;index++){draw(index/30);const frame=new VideoFrame(canvas,{timestamp:Math.round(index*1000000/30),duration:Math.round(1000000/30)});encoder.encode(frame,{keyFrame:index%60===0});frame.close();while(encoder.encodeQueueSize>8)await new Promise(resolve=>setTimeout(resolve,10));if(encodingError)throw encodingError;}
  await encoder.flush();encoder.close();if(encodingError)throw encodingError;muxer.finalize();
  const bytes=new Uint8Array(muxer.target.buffer);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {base64:btoa(binary),mime:'video/mp4;codecs=avc1.42002a',bytes:bytes.length,frameRate:30,encodedFrames};
 },{scenes});
 const bytes=Buffer.from(rendered.base64,'base64');assert.ok(bytes.length>100000&&bytes.length<25*1024*1024);assert.ok(bytes.includes(Buffer.from('avc1')));assert.equal(rendered.encodedFrames,1470);const target=path.join(out,'cisco-advisory-reel.mp4');if(fs.existsSync(target))fs.renameSync(target,path.join(out,`unverified-prior-reel-${Date.now()}.mp4`));fs.writeFileSync(target,bytes);
 await page.setContent(`<style>html,body{margin:0}</style><video style="width:1080px;height:1920px;display:block" src="http://127.0.0.1:${server.address().port}/reel.mp4" muted preload="auto"></video>`);
 await page.locator('video').evaluate(v=>new Promise((resolve,reject)=>{if(v.readyState>=1)resolve();else{v.onloadedmetadata=resolve;v.onerror=reject;}}));
 const metadata=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight}));assert.equal(metadata.width,1080);assert.equal(metadata.height,1920);assert.ok(metadata.duration>=48&&metadata.duration<51,JSON.stringify(metadata));
 for(const [name,time] of [['beginning',0.3],['middle',24.5],['end',48.5]]){await page.locator('video').evaluate((v,time)=>new Promise(resolve=>{v.onseeked=resolve;v.currentTime=time;}),time);await page.screenshot({path:path.join(out,`reel-${name}.png`)});}
 const files=['linkedin-poster.jpg','cisco-advisory-reel.mp4','storyboard.json',...Object.keys(captions).map(c=>`${c}-caption.txt`)];
 fs.writeFileSync(path.join(out,'render-check.json'),JSON.stringify({checkedAt:new Date().toISOString(),metadata,requestedEncoderMime:rendered.mime,encodedFrames:rendered.encodedFrames,timelineFrameRate:rendered.frameRate,audio:'none',files:files.map(file=>{const b=fs.readFileSync(path.join(out,file));return {file,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};}),nativePreviewVerification:'pending',independentReview:'pending'},null,2));console.log(JSON.stringify({out,metadata,requestedEncoderMime:rendered.mime,bytes:bytes.length,nativePreviewVerification:'pending',independentReview:'pending'}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
