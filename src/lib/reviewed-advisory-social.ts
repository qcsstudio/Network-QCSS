import approved from '../content/reviewed-advisory-release.json' with {type:'json'};
import {assetUrl,fail,object,stableHash,type ReviewedAsset,type ReviewedChannel} from './reviewed-advisory-domain.ts';

export function reviewedSocialPayload(channel:ReviewedChannel){
 const payload=object((approved.social as Record<string,unknown>)[channel]);
 if(!/^[a-f0-9]{64}$/.test(approved.socialReviewSha256)||!Object.keys(payload).length)fail('Exact social copy/media review is not yet staged.');
 if(typeof payload.caption!=='string'||payload.caption.length>(channel==='linkedin'?3000:2200)||!payload.caption.includes(approved.canonical))fail('Reviewed caption is incomplete or too long.');
 if(new Set(payload.caption.match(/#[A-Za-z][A-Za-z0-9_]*/g)||[]).size<5)fail('Reviewed caption needs five distinct relevant hashtags.');
 if(typeof payload.accountId!=='string'||!payload.accountId||typeof payload.assetKey!=='string')fail('Reviewed account/media identity is missing.');
 const asset=approved.assets.find(a=>a.key===payload.assetKey) as ReviewedAsset|undefined;
 if(!asset||(channel!=='linkedin'&&asset.mimeType!=='video/mp4')||(channel==='linkedin'&&asset.mimeType!=='image/jpeg'))fail('The correct reviewed image/reel is unavailable.');
 const mediaUrl=assetUrl(asset),sha256=stableHash({channel,caption:payload.caption,accountId:payload.accountId,assetSha256:asset.sha256,mediaUrl});
 if(payload.payloadSha256!==sha256)fail('Reviewed destination payload changed.');
 return {caption:payload.caption,accountId:payload.accountId,mediaUrl,sha256,asset};
}
export function receiptUrl(channel:ReviewedChannel,value:string){
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.port)fail('Use a genuine HTTPS platform permalink.');
 const host=u.hostname.replace(/^www\./,'');
 if(channel==='linkedin'&&(host!=='linkedin.com'||!/^\/feed\/update\/urn:li:(?:activity|share|ugcPost):\d+\/?$/.test(u.pathname)))fail('A specific LinkedIn post permalink is required.');
 if(channel==='facebook'&&(host!=='facebook.com'||!/^\/(?:qcsstudio\/posts\/[^/]+|\d+_\d+|reel\/\d+)\/?$/i.test(u.pathname)))fail('A specific QCS Facebook post/reel permalink is required.');
 if(channel==='instagram'&&(host!=='instagram.com'||!/^\/(?:p|reel)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)))fail('A specific Instagram post/reel permalink is required.');
 return u.href;
}
export function assertReceiptIdentity(channel:ReviewedChannel,url:string,platformId:string){
 const path=new URL(receiptUrl(channel,url)).pathname.replace(/\/$/,'');
 if(channel==='linkedin'&&platformId!==path.split(':').at(-1))fail('LinkedIn ID does not match the observed permalink.');
 if(channel==='facebook'&&platformId.split('_').at(-1)!==path.split('/').at(-1)?.split('_').at(-1))fail('Facebook ID does not match the observed permalink.');
 if(channel==='instagram'){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';let decoded=0n;
  for(const character of path.split('/').at(-1)||''){const n=alphabet.indexOf(character);if(n<0)fail('Invalid Instagram shortcode.');decoded=decoded*64n+BigInt(n);}
  if(platformId!==decoded.toString())fail('Instagram media ID does not match the observed shortcode.');
 }
}
