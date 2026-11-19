import {createHash} from 'node:crypto';
import {encodeLinkedInLittleText} from './linkedin-little-text.ts';
import {assertLinkedInProtocol} from './linkedin-commentary.ts';

type Connection={accountId:string;accessToken:string;expiresAt:Date;scope:string;status:string};
export type AutomatedLinkedInProgress=Readonly<{
  stage:'prepared'|'dispatching'|'accepted';
  publishAttempted:boolean;
  imageAssetId?:string;
  externalId?:string;
}>;
export type AutomatedLinkedInHooks={
  beforePublish:()=>Promise<void>|void;
  checkpoint:(progress:AutomatedLinkedInProgress)=>Promise<void>|void;
};
type LinkedInStage='validation'|'preparation'|'upload'|'publish'|'receipt';
type Context={stage:LinkedInStage;publishAttempted:boolean;imageAssetId?:string;externalId?:string;progress?:AutomatedLinkedInProgress};

export class ReviewedLinkedInError extends Error {
  readonly state:'blocked'|'needs_review';
  readonly stage:LinkedInStage;
  readonly publishAttempted:boolean;
  readonly imageAssetId?:string;
  readonly externalId?:string;
  readonly progress?:AutomatedLinkedInProgress;
  readonly httpStatus?:number;
  constructor(state:'blocked'|'needs_review',message:string,context:Context={stage:'validation',publishAttempted:false},httpStatus?:number){
    super(message);
    this.name='ReviewedLinkedInError';
    this.state=context.publishAttempted?'needs_review':state;
    this.stage=context.stage;
    this.publishAttempted=context.publishAttempted;
    this.imageAssetId=context.imageAssetId;
    this.externalId=context.externalId;
    this.progress=context.progress;
    this.httpStatus=typeof httpStatus==='number'&&Number.isSafeInteger(httpStatus)&&httpStatus>=100&&httpStatus<=599?httpStatus:undefined;
  }
}

/**
 * Both hooks are mandatory before any network request. The caller owns the DB
 * claim, proof validation and failure holds; beforePublish must throw on failure.
 * Persist dispatching before transmission and never automatically retry/delete.
 * Version is caller-injected; no ambient environment is read by this transport.
 */
export async function publishAutomatedLinkedIn(input:{accountId:string;caption:string;imageUrl:string;alt:string},connection:Connection,fetcher:typeof fetch=fetch,version='202607',hooks?:AutomatedLinkedInHooks){
  const context:Context={stage:'validation',publishAttempted:false};
  function fail(message:string,httpStatus?:number):never{throw new ReviewedLinkedInError('blocked',message,context,httpStatus);}
  const beforePublish=hooks?.beforePublish,writeCheckpoint=hooks?.checkpoint;
  if(typeof beforePublish!=='function'||typeof writeCheckpoint!=='function')fail('LinkedIn publishing requires authorization and durable checkpoint hooks.');
  const {accountId,caption,imageUrl,alt}=input;
  const token=connection.accessToken;
  function verifyConnection(){
    const expiresAt=connection.expiresAt.getTime();
    if(connection.status!=='connected'||connection.accountId!==accountId||!Number.isFinite(expiresAt)||expiresAt<=Date.now()+5*60000||!connection.scope.split(/[ ,]+/).includes('w_member_social')||!token||connection.accessToken!==token||/[\r\n]/.test(token))fail('The exact LinkedIn member connection needs verification or renewal.');
  }
  async function checkpoint(stage:AutomatedLinkedInProgress['stage']){
    const progress:AutomatedLinkedInProgress=Object.freeze({stage,publishAttempted:stage==='dispatching'||context.publishAttempted,...(context.imageAssetId?{imageAssetId:context.imageAssetId}:{}),...(context.externalId?{externalId:context.externalId}:{})});
    context.progress=progress;
    try{await writeCheckpoint!(progress);}catch{fail('LinkedIn durable checkpoint failed; caller reconciliation is required.');}
  }
  async function authorize(){
    try{await beforePublish!();}catch{fail('LinkedIn publication authorization could not be revalidated.');}
    verifyConnection();
  }
  verifyConnection();
  let commentary:string;
  try{commentary=assertLinkedInProtocol(caption);}catch{fail('The LinkedIn caption does not meet the delivery protocol.');}
  const transportCommentary=encodeLinkedInLittleText(commentary);
  if(commentary!==caption)fail('The reviewed caption must already be normalized; no publication-time rewrite is allowed.');
  let media:URL;
  try{media=new URL(imageUrl);}catch{fail('Only the exact reviewed QCS static image is allowed.');}
  if(media!.origin!=='https://www.qcsstudio.com'||!/^\/automated-advisories\/[a-z0-9-]+\/[a-f0-9]{64}\.jpg$/.test(media!.pathname)||media!.search||media!.hash||media!.username||media!.password)fail('Only the exact reviewed QCS static image is allowed.');
  if(!/^\d{6}$/.test(version))fail('A supported LinkedIn API version is required.');
  if(typeof alt!=='string')fail('The LinkedIn image description is invalid.');
  const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json','Linkedin-Version':version,'X-Restli-Protocol-Version':'2.0.0'};
  const author=`urn:li:person:${accountId}`;
  context.stage='preparation';
  let initialized:Response;
  try{initialized=await fetcher('https://api.linkedin.com/rest/images?action=initializeUpload',{method:'POST',headers,body:JSON.stringify({initializeUploadRequest:{owner:author}}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});}catch{fail('LinkedIn media preparation is unavailable. No post was submitted.');}
  if(!initialized!.ok)fail('LinkedIn rejected image preparation. No post was submitted.',initialized!.status);
  const result=await initialized!.json().catch(()=>null) as {value?:{uploadUrl?:string;image?:string}}|null;
  const upload=result?.value?.uploadUrl,image=result?.value?.image;
  if(typeof image!=='string'||!/^urn:li:image:[A-Za-z0-9_-]{1,256}$/.test(image))fail('LinkedIn did not provide a valid image asset.');
  context.imageAssetId=image;
  await checkpoint('prepared');
  if(typeof upload!=='string')fail('The LinkedIn upload destination is unsupported.');
  let u:URL;
  try{u=new URL(upload!);}catch{fail('The LinkedIn upload destination is unsupported.');}
  if(u!.protocol!=='https:'||u!.hostname!=='www.linkedin.com'||!u!.pathname.startsWith('/dms-uploads/')||u!.username||u!.password||u!.port)fail('The LinkedIn upload destination is unsupported.');
  context.stage='upload';
  let source:Response,uploaded:Response;
  try{source=await fetcher(imageUrl,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});}catch{fail('LinkedIn image preparation failed. No post was submitted.');}
  if(!source.ok||!source.headers.get('content-type')?.startsWith('image/jpeg'))fail('The reviewed LinkedIn image is unavailable.');
  let bytes:ArrayBuffer;
  try{bytes=await source.arrayBuffer();}catch{fail('LinkedIn image preparation failed. No post was submitted.');}
  if(bytes.byteLength>5*1024*1024)fail('The reviewed social image exceeds its upload limit.');
  if(createHash('sha256').update(new Uint8Array(bytes)).digest('hex')!==media!.pathname.split('/').at(-1)!.slice(0,64))fail('The reviewed social image bytes changed before upload.');
  try{uploaded=await fetcher(upload!,{method:'PUT',headers:{'Content-Type':'image/jpeg',Authorization:`Bearer ${token}`},body:bytes,redirect:'error',signal:AbortSignal.timeout(20000)});}catch{fail('LinkedIn image upload failed. No post was submitted.');}
  if(!uploaded!.ok)fail('LinkedIn rejected the image upload. No post was submitted.',uploaded!.status);
  const postBody=JSON.stringify({author,commentary:transportCommentary,visibility:'PUBLIC',distribution:{feedDistribution:'MAIN_FEED',targetEntities:[],thirdPartyDistributionChannels:[]},content:{media:{id:image,altText:alt.slice(0,120)}},lifecycleState:'PUBLISHED',isReshareDisabledByAuthor:false});
  context.stage='publish';
  verifyConnection();
  await authorize();
  await checkpoint('dispatching');
  await authorize();
  let response:Response;
  context.publishAttempted=true;
  try{
    response=await fetcher('https://api.linkedin.com/rest/posts',{method:'POST',headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),body:postBody});
  }catch{fail('LinkedIn may have received this exact post. Do not retry; reconcile its history.');}
  if(!response!.ok)fail('LinkedIn publication was not confirmed. No automatic retry or deletion is allowed.',response!.status);
  const externalId=response!.headers.get('x-restli-id')||response!.headers.get('x-linkedin-id')||'';
  if(!/^urn:li:(?:share|ugcPost|activity):\d+$/.test(externalId))fail('LinkedIn accepted the request without a usable post identity. Reconcile history.');
  context.externalId=externalId;
  context.stage='receipt';
  await checkpoint('accepted');
  return {externalId,permalink:`https://www.linkedin.com/feed/update/${externalId}/`,receipt:{kind:'official-api-publication-response',accountId,captionSha256:createHash('sha256').update(caption).digest('hex'),imageAssetId:image,acceptedAt:new Date().toISOString(),nativeVisibilityVerified:false}};
}

export async function automatedLinkedInConnection(){
  const {getPrismaClient}=await import('./prisma.ts');
  const {decryptIntegrationSecret}=await import('./integration-secrets.ts');
  const c=await getPrismaClient().integrationConnection.findUnique({where:{provider:'linkedin'}});
  if(!c)throw new ReviewedLinkedInError('blocked','LinkedIn has no server connection.');
  return {accountId:c.accountId,accessToken:decryptIntegrationSecret(c.encryptedAccessToken),expiresAt:c.expiresAt,scope:c.scope,status:c.status};
}
