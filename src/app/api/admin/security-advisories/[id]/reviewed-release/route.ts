import {NextResponse} from 'next/server';
import {revalidatePath} from 'next/cache';
import {getAdminSession,isAdminRequest} from '@/lib/admin-auth';
import {jsonError,noStoreHeaders} from '@/lib/api';
import {rateLimit} from '@/lib/rate-limit';
import {applyReviewedAdvisory,markReviewedUncertain,recordReviewedReceipt,reserveReviewedDestination,reviewedAdvisorySnapshot} from '@/lib/reviewed-advisory-store';
import {object} from '@/lib/reviewed-advisory-domain';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){
 if(!isAdminRequest(request))return jsonError('Unauthorized',401);
 try{return NextResponse.json({ok:true,snapshot:await reviewedAdvisorySnapshot((await params).id)},{headers:noStoreHeaders});}
 catch(error){return jsonError(error instanceof Error?error.message:'Unable to read selected release.',409);}
}
export async function POST(request:Request,{params}:Context){
 const session=await getAdminSession();
 if(!session||!isAdminRequest(request))return jsonError('Signed-in admin session required.',401);
 const origin=new URL(request.url).origin;
 if(request.headers.get('origin')!==origin)return jsonError('Same-origin request required.',403);
 if(origin!=='https://www.qcsstudio.com'&&process.env.NODE_ENV==='production')return jsonError('Production changes require the verified public production host.',403);
 const limited=rateLimit(request,{keyPrefix:'reviewed-advisory-release',max:30,windowMs:60000});if(limited)return limited;
 const declared=Number(request.headers.get('content-length')||0);if(declared>600000)return jsonError('Reviewed release request is too large.',413);
 try{
  const reader=request.body?.getReader();if(!reader)return jsonError('JSON body required.',400);
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>600000){await reader.cancel();return jsonError('Reviewed release request is too large.',413);}chunks.push(part.value);}
  if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))return jsonError('JSON body required.',415);
  const body=object(JSON.parse(Buffer.concat(chunks).toString('utf8'))),{id}=await params;
  let result:unknown;
  if(body.action==='apply'){
   result=await applyReviewedAdvisory(id,body,session.email);const snapshot=await reviewedAdvisorySnapshot(id);
   for(const route of ['/security-advisories',`/security-advisories/${snapshot.configuration.slug}`,'/sitemap.xml'])revalidatePath(route);
  }else if(body.action==='reserve')result=await reserveReviewedDestination(id,body,session.email);
  else if(body.action==='receipt')result=await recordReviewedReceipt(id,body,session.email);
  else if(body.action==='uncertain')result=await markReviewedUncertain(id,body,session.email);
  else return jsonError('Choose an explicit single-item action.',400);
  return NextResponse.json({ok:true,result},{headers:noStoreHeaders});
 }catch(error){return jsonError(error instanceof Error?error.message:'Selected release failed safely.',409);}
}
