import type {Prisma, PrismaClient} from '@prisma/client';
import {assertOutsideReviewedScope,isReviewedAdvisoryFamily,reviewedAdvisoryScope} from './reviewed-advisory-domain.ts';
import {reviewedFamilyAdvisoryWhere,reviewedFamilyCves,reviewedFamilyPosts} from './reviewed-advisory-family.ts';
import {getAutomatedReleases,isAutomatedFamily} from './automated-advisory-domain.ts';
import {automatedFamilyAdvisoryIds,automatedFamilyPosts} from './automated-advisory-worker.ts';
import {hasAutomatedAdvisoryOwnership} from './automated-advisory-configuration.ts';

type Reader=Pick<PrismaClient,'securityAdvisory'|'socialPublication'|'$queryRaw'>;
type AdvisoryReader=Pick<PrismaClient,'securityAdvisory'>;
export const reviewedAdvisoryExclusion={NOT:reviewedFamilyAdvisoryWhere};
async function protectedAdvisoryIds(client:AdvisoryReader){
 const records=await client.securityAdvisory.findMany({where:reviewedFamilyAdvisoryWhere,select:{id:true}});
 const markers=await client.securityAdvisory.findMany({where:{OR:[{createdBy:'reviewed-advisory-worker'},{editorialTrace:{path:['automatedAdvisory','releaseId'],string_contains:''}}]},select:{id:true,createdBy:true,editorialTrace:true}});
 const automatic=getAutomatedReleases().length?await automatedFamilyAdvisoryIds(client):[];
 return [...records,...markers.filter(hasAutomatedAdvisoryOwnership),...automatic].map(row=>row.id);
}
export async function reviewedAdvisorySelection(client:AdvisoryReader):Promise<Prisma.SecurityAdvisoryWhereInput>{
 // Apply positive nullable-JSON matches first. NOT of a missing JSON path can
 // evaluate to SQL NULL and inadvertently exclude ordinary records as well.
 return {NOT:{id:{in:await protectedAdvisoryIds(client)}}};
}
export async function reviewedJobExclusion(client:Reader):Promise<Prisma.SocialPublicationWhereInput>{
 const advisoryIds=await protectedAdvisoryIds(client),posts=await reviewedFamilyPosts(client);
 const markedJobs=await client.socialPublication.findMany({where:{metadata:{path:['automatedAdvisory','releaseId'],string_contains:''}},select:{id:true}});
 const releases=getAutomatedReleases(),automatedPosts=releases.length?await automatedFamilyPosts(client):[];
 return {NOT:[{id:{in:markedJobs.map(j=>j.id)}},{contentType:'security_advisory',contentId:{in:advisoryIds}},{contentType:'content_post',contentId:{in:[...posts,...automatedPosts].map(p=>p.id)}},{sourceUrl:{contains:`/security-advisories/${reviewedAdvisoryScope.slug}`}},...reviewedFamilyCves.map(cve=>({commentary:{contains:cve,mode:'insensitive' as const}})),...releases.map(r=>({sourceUrl:{contains:`/security-advisories/${r.slug}`}})),...releases.flatMap(r=>r.cves.map(cve=>({commentary:{contains:cve,mode:'insensitive' as const}})))]};
}
export async function isReviewedScopeJob(client:Reader,job:{contentType:string;contentId:string;sourceUrl?:string|null;metadata?:unknown}){
 if(hasAutomatedAdvisoryOwnership(job))return true;
 if(job.sourceUrl?.includes(`/security-advisories/${reviewedAdvisoryScope.slug}`))return true;
 if(getAutomatedReleases().some(r=>job.sourceUrl?.includes(`/security-advisories/${r.slug}`)))return true;
 if(job.contentType==='content_post')return (await reviewedFamilyPosts(client,job.contentId)).length>0||getAutomatedReleases().length>0&&(await automatedFamilyPosts(client)).some(p=>p.id===job.contentId);
 if(job.contentType!=='security_advisory')return false;
 const record=await client.securityAdvisory.findUnique({where:{id:job.contentId},select:{slug:true,externalId:true,cves:true,sourceUrl:true,createdBy:true,editorialTrace:true}});
 return Boolean(record&&(isReviewedAdvisoryFamily(record)||isAutomatedFamily(record)||hasAutomatedAdvisoryOwnership(record)));
}
export async function assertOrdinaryAdvisoryJob(client:Reader,job:{contentType:string;contentId:string;sourceUrl?:string|null}){
 if(await isReviewedScopeJob(client,job))assertOutsideReviewedScope(reviewedAdvisoryScope);
}
