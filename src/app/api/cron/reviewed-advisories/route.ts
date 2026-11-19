import {NextResponse} from 'next/server';
import {isAdminRequest} from '@/lib/admin-auth';
import {isAutomatedAdvisoryRequest} from '@/lib/automated-advisory-auth';
import {automatedAdvisoriesEnabled,runAutomatedAdvisories} from '@/lib/automated-advisory-worker';
import {getAutomatedReleases} from '@/lib/automated-advisory-domain';
import {getPrismaClient} from '@/lib/prisma';
import {jsonError,noStoreHeaders} from '@/lib/api';
import {revalidatePath} from 'next/cache';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(request:Request){
  if(!isAdminRequest(request))return jsonError('Unauthorized',401);
  let accountObservation:unknown=null;
  if(new URL(request.url).searchParams.get('verify')==='1'){
    try{
      const {createAutomatedMetaTransport}=await import('@/lib/automated-advisory-transports');
      accountObservation={checkedAt:new Date().toISOString(),meta:await createAutomatedMetaTransport(process.env,fetch).verifyAccounts(),linkedin:await getPrismaClient().integrationConnection.findUnique({where:{provider:'linkedin'},select:{accountId:true,accountName:true,status:true,scope:true,expiresAt:true}}),publicationPerformed:false,note:'Ownership/expiry checks only; not a publishing-permission or delivery test.'};
    }catch{accountObservation={status:'unverified',publicationPerformed:false};}
  }
  // Viewing status never verifies permissions, reserves or submits a post.
  return NextResponse.json({ok:true,enabled:automatedAdvisoriesEnabled(),scope:'prospective-reviewed-security-advisories',transport:'isolated-server-api',paidGenerationAllowed:false,accountObservation,approvedReleases:getAutomatedReleases().map(r=>({releaseId:r.releaseId,slug:r.slug,notBefore:r.notBefore}))},{headers:noStoreHeaders});
}
export async function POST(request:Request){
  // Neither a browser session, the old global worker nor a generic cron secret can publish here.
  if(!await isAutomatedAdvisoryRequest(request))return jsonError('Unauthorized',401);
  if(!['','0'].includes(request.headers.get('content-length')||''))return jsonError('No caller-supplied publication content is accepted.',400);
  const url=new URL(request.url),stage=url.searchParams.get('stage')||'website';
  if(!['website','linkedin','facebook','instagram'].includes(stage))return jsonError('Select one exact publication stage.',400);
  try{
    const result=await runAutomatedAdvisories({dryRun:url.searchParams.get('dryRun')==='1',stage:stage as 'website'|'linkedin'|'facebook'|'instagram',client:getPrismaClient()});
    if(result.status==='website_ready'){revalidatePath('/security-advisories');revalidatePath('/sitemap.xml');}
    return NextResponse.json({ok:true,...result},{headers:noStoreHeaders});
  }catch{return jsonError('Reviewed advisory admission is held. No generation or global queue was invoked.',503);}
}
