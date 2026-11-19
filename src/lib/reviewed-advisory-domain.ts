import {createHash} from 'node:crypto';
import approved from '../content/reviewed-advisory-release.json' with {type:'json'};
import {isAutomatedFamily} from './automated-advisory-domain.ts';
import {hasAutomatedAdvisoryOwnership} from './automated-advisory-configuration.ts';

export const reviewedAdvisoryMode='server-controlled-native-handoff-v1';
export const reviewedAdvisoryScope={slug:approved.slug,externalId:approved.externalId};
export type ReviewedChannel='linkedin'|'facebook'|'instagram';
export type Guide={
 title:string;description:string;answer:string;readerOutcome:string;technicalScope:string;byline:string;
 takeaways:string[];definitions:{term:string;definition:string}[];
 sections:{heading:string;body:string;bullets?:string[];sourceUrls?:string[]}[];
 checklist:string[];questions:{question:string;answer:string;sourceUrls?:string[]}[];
 sources:{label:string;url:string}[];limitations:string[];
 vulnerabilities:{id:string;title:string;context:string;contextUrl:string;recommendation:string;vendorExplanation:string;originalDisclosureUrl:string;ciscoAdvisoryUrl:string}[];
 readOnlyChecks:{command:string;meaning:string;scope:string;sourceId:string}[];
 graphics:{id:string;alt:string}[];
};
export type ReviewedAsset={key:string;path:string;sha256:string;bytes:number;mimeType:string};
export type ReviewedEnvelope={mode:typeof reviewedAdvisoryMode;releaseId:string;candidateSha256:string;reviewSha256:string;manifestSha256:string;guide:Guide;origin:string;assets:ReviewedAsset[];importedAt:string;actor:string};
export function fail(message:string):never{throw new Error(message);}
export function object(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
export function digest(value:string|Uint8Array){return createHash('sha256').update(value).digest('hex');}
export function stableHash(value:unknown):string{
 const sort=(v:unknown):unknown=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,sort(x)])):v;
 return digest(JSON.stringify(sort(value)));
}
export const manifestHash=stableHash(approved);
export function isReviewedAdvisoryIdentity(value:{slug?:string;externalId?:string}){return value.slug===approved.slug||value.externalId?.toUpperCase()===approved.externalId;}
export function isReviewedAdvisoryFamily(value:{slug?:string;externalId?:string;cves?:unknown;sourceUrl?:string}){return isReviewedAdvisoryIdentity(value)||Boolean(value.sourceUrl?.toLowerCase().includes('cisco-sa-oct2026-node-js'))||Array.isArray(value.cves)&&value.cves.some(cve=>['CVE-2026-111497','CVE-2026-105482','CVE-2026-105483','CVE-2026-106069'].includes(String(cve).toUpperCase()));}
export function assertOutsideReviewedScope(value:{slug?:string;externalId?:string;cves?:unknown;sourceUrl?:string}){if(isReviewedAdvisoryFamily(value)||isAutomatedFamily(value)||hasAutomatedAdvisoryOwnership(value))fail('This advisory family is reserved for its exact reviewed release controls. No generic edit, generation or queue action was run.');}
export function reviewedEnvelope(payload:unknown):ReviewedEnvelope|null{
 const p=object(payload),value=object(p.reviewedGuide);
 if(value.mode!==reviewedAdvisoryMode)return null;
 if(value.releaseId!==approved.releaseId||value.candidateSha256!==approved.candidateSha256||value.reviewSha256!==approved.reviewSha256||value.manifestSha256!==manifestHash||stableHash(value.guide)!==approved.guideSha256||stableHash(value.assets)!==stableHash(approved.assets)||value.origin!==mediaOrigin())fail('The reviewed guide release binding changed.');
 return value as unknown as ReviewedEnvelope;
}
function boundedText(value:unknown,max:number,name:string){if(typeof value!=='string'||!value.trim()||value.length>max)fail(`Invalid ${name}.`);return value;}
function array(value:unknown,max:number,name:string){if(!Array.isArray(value)||value.length>max)fail(`Invalid ${name}.`);return value;}
export function parseApprovedGuide(candidateText:string,reviewText:string){
 if(Buffer.byteLength(candidateText)>250000||Buffer.byteLength(reviewText)>250000)fail('The reviewed bundle exceeds its bounded size.');
 if(digest(candidateText)!==approved.candidateSha256||digest(reviewText)!==approved.reviewSha256)fail('This is not the exact independently reviewed candidate and receipt.');
 const candidate=object(JSON.parse(candidateText)),review=object(JSON.parse(reviewText));
 if(review.verdict!=='PASS'||object(review.candidate).rawSHA256!==approved.candidateSha256||object(review.reviewer).candidateAuthorshipOrRepairPerformed!==false)fail('The independent review does not approve these exact bytes.');
 const post=object(candidate.post);
 for(const field of ['title','description','answer','readerOutcome','technicalScope','byline'])boundedText(post[field],3000,field);
 for(const section of array(post.sections,20,'sections')){const s=object(section);boundedText(s.heading,200,'section heading');boundedText(s.body,12000,'section body');}
 for(const field of ['takeaways','definitions','checklist','questions','sources','limitations','readOnlyChecks','graphics'])array(post[field],40,field);
 if(array(post.vulnerabilities,4,'vulnerabilities').length!==4)fail('The reviewed four-CVE explanation is incomplete.');
 return post as unknown as Guide;
}
export function mediaOrigin(){
 if(!approved.origin)fail('The reviewed static media release has not been staged.');
 const u=new URL(approved.origin);
 if(u.origin!=='https://www.qcsstudio.com'||u.pathname!=='/'||u.search||u.hash||u.username||u.password||u.port)fail('Use only the existing QCS website static-media origin.');
 return u.origin;
}
export function assetUrl(asset:ReviewedAsset,origin=mediaOrigin()){
 if(approved.assetPathPrefix!==`/reviewed-advisories/${approved.releaseId}/assets`||!/^[a-f0-9]{64}$/.test(asset.sha256)||asset.path!==`${approved.assetPathPrefix}/${asset.sha256}.${asset.mimeType==='image/png'?'png':asset.mimeType==='image/svg+xml'?'svg':asset.mimeType==='image/jpeg'?'jpg':asset.mimeType==='video/mp4'?'mp4':'invalid'}`||asset.bytes<1||asset.bytes>25*1024*1024)fail('Invalid content-addressed media binding.');
 return new URL(asset.path,origin).href;
}
export function guideAsset(envelope:ReviewedEnvelope,key:string){const asset=envelope.assets.find(a=>a.key===key);if(!asset)fail('Reviewed diagram variant is missing.');return assetUrl(asset,envelope.origin);}
export function releaseConfiguration(){return {releaseId:approved.releaseId,slug:approved.slug,canonical:approved.canonical,manifestSha256:manifestHash,candidateSha256:approved.candidateSha256,originConfigured:Boolean(approved.origin),socialConfigured:Object.keys(approved.social).length===3,transport:approved.transport};}
export async function verifyReviewedMedia(fetcher:typeof fetch=fetch){
 const origin=mediaOrigin();
 for(const asset of approved.assets){
  const url=assetUrl(asset,origin),response=await fetcher(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(response.status!==200||response.headers.get('content-type')?.split(';')[0]!==asset.mimeType||!response.body)fail('Reviewed media is unavailable or has the wrong format.');
  const chunks:Uint8Array[]=[];let size=0;
  const reader=response.body.getReader();
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>asset.bytes){await reader.cancel();fail('Media exceeds its declared byte limit.');}chunks.push(part.value);}}finally{reader.releaseLock();}
  const bytes=Buffer.concat(chunks);if(bytes.length!==asset.bytes||digest(bytes)!==asset.sha256)fail('Reviewed media bytes changed.');
 }
 return {origin,assets:approved.assets,manifestSha256:manifestHash};
}
export function newEnvelope(guide:Guide,actor:string,media:{origin:string;assets:ReviewedAsset[]}):ReviewedEnvelope{return {mode:reviewedAdvisoryMode,releaseId:approved.releaseId,candidateSha256:approved.candidateSha256,reviewSha256:approved.reviewSha256,manifestSha256:manifestHash,guide,origin:media.origin,assets:media.assets,importedAt:new Date().toISOString(),actor};}
export function requireDeploymentActivation(value:unknown,expectedDeploymentId:string|undefined){
 const v=object(value),now=Date.now();
 if(!expectedDeploymentId||v.deploymentId!==expectedDeploymentId||typeof v.checkedAt!=='string'||typeof v.cutoverAt!=='string'||typeof v.evidenceSha256!=='string'||!/^[a-f0-9]{64}$/.test(v.evidenceSha256))fail('Genuine current-deployment and writer-drain evidence is required.');
 const checked=Date.parse(v.checkedAt),cutover=Date.parse(v.cutoverAt);
 if(!Number.isFinite(checked)||!Number.isFinite(cutover)||checked>now||now-checked>5*60000||cutover>checked||now-cutover<6*60000)fail('Writer-drain evidence is stale, future-dated or too early.');
 return {deploymentId:expectedDeploymentId,checkedAt:v.checkedAt,cutoverAt:v.cutoverAt,evidenceSha256:v.evidenceSha256};
}
export function requireSourceVerification(value:unknown){
 const v=object(value),checked=typeof v.checkedAt==='string'?Date.parse(v.checkedAt):NaN;
 if(!Number.isFinite(checked)||checked>Date.now()||Date.now()-checked>24*3600000||v.ciscoRevision!=='1.14'||v.materialChangeFound!==false||typeof v.evidenceSha256!=='string'||!/^[a-f0-9]{64}$/.test(v.evidenceSha256))fail('Fresh primary-source evidence for the approved Cisco revision is required. A material change needs a new independent review.');
 return v;
}
export async function verifyPublicReviewedRelease(envelope:ReviewedEnvelope,fetcher:typeof fetch=fetch){
 const response=await fetcher(approved.canonical,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
 if(response.status!==200||!response.headers.get('content-type')?.startsWith('text/html')||!response.body)fail('The exact public advisory could not be verified.');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
 try{while(true){const p=await reader.read();if(p.done)break;bytes+=p.value.length;if(bytes>2000000){await reader.cancel();fail('Unexpectedly large public response.');}chunks.push(p.value);}}finally{reader.releaseLock();}
 const html=Buffer.concat(chunks).toString('utf8');
 if(!html.includes(`data-reviewed-release="${envelope.releaseId}"`)||!html.includes(`data-reviewed-candidate="${envelope.candidateSha256}"`)||!html.includes(approved.canonical)||!envelope.guide.vulnerabilities.every(v=>html.includes(v.id))||!envelope.assets.filter(a=>a.key.endsWith('-desktop.svg')).every(a=>html.includes(assetUrl(a,envelope.origin))))fail('The current public page is not the exact complete reviewed guide.');
 const {parse}=await import('parse5');
 type HtmlNode={nodeName:string;tagName?:string;value?:string;attrs?:{name:string;value:string}[];childNodes?:HtmlNode[]};
 const root=parse(html) as HtmlNode;
 const attr=(node:HtmlNode,name:string)=>node.attrs?.find(a=>a.name===name)?.value;
 function find(node:HtmlNode):HtmlNode|undefined{if(node.tagName==='article'&&attr(node,'data-reviewed-candidate')===envelope.candidateSha256)return node;for(const child of node.childNodes||[]){const match=find(child);if(match)return match;}}
 const article=find(root);if(!article)fail('The reviewed article element is missing.');
 function text(node:HtmlNode):string{if(['script','style','template'].includes(node.tagName||'')||node.attrs?.some(a=>a.name==='hidden'||a.name==='inert'||a.name==='aria-hidden'&&a.value==='true')||/display\s*:\s*none|visibility\s*:\s*hidden/i.test(attr(node,'style')||''))return '';return node.nodeName==='#text'?node.value||'':(node.childNodes||[]).map(text).join(' ');}
 const normalize=(value:string)=>value.replace(/\s+/g,' ').trim(),articleText=normalize(text(article));
 if(!expectedReviewedText(envelope.guide).every(value=>articleText.includes(normalize(value))))fail('Reviewed guide prose is absent from the public article.');
 return {checkedAt:new Date().toISOString(),htmlSha256:digest(html),canonical:approved.canonical,allReviewedArticleTextPresent:true};
}
export function expectedReviewedText(g:Guide){return [g.title,g.description,g.answer,g.technicalScope,g.byline,...g.takeaways,...g.definitions.flatMap(d=>[d.term,d.definition]),...g.sections.flatMap(s=>[s.heading,s.body,...s.bullets||[]]),...g.vulnerabilities.flatMap(v=>[v.id,v.title,v.context,v.recommendation,v.vendorExplanation]),...g.readOnlyChecks.flatMap(c=>[c.command,c.meaning,c.scope]),...g.checklist,...g.questions.flatMap(q=>[q.question,q.answer]),...g.sources.map(s=>s.label),...g.limitations,...g.graphics.map(a=>a.alt)];}
