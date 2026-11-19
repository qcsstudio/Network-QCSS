import type {Prisma,PrismaClient} from '@prisma/client';
import {reviewedAdvisoryScope} from './reviewed-advisory-domain.ts';

export const reviewedFamilyCves=['CVE-2026-111497','CVE-2026-105482','CVE-2026-105483','CVE-2026-106069'];
// JSON containment is case-sensitive; cover every ASCII spelling accepted by the per-item guard.
const cvePrefixes=['CVE','CVe','CvE','Cve','cVE','cVe','cvE','cve'];
export const reviewedFamilyAdvisoryWhere:Prisma.SecurityAdvisoryWhereInput={OR:[{slug:reviewedAdvisoryScope.slug},{externalId:{equals:reviewedAdvisoryScope.externalId,mode:'insensitive'}},{sourceUrl:{contains:'cisco-sa-oct2026-node-js',mode:'insensitive'}},...reviewedFamilyCves.flatMap(cve=>cvePrefixes.map(prefix=>({cves:{array_contains:[prefix+cve.slice(3)]}})))]};
export async function reviewedFamilyPosts(client:Pick<PrismaClient,'$queryRaw'>,id?:string){
 const pattern='cisco-sa-oct2026-node-js|CVE-2026-(111497|105482|105483|106069)';
 if(id)return client.$queryRaw<{id:string;slug:string;title:string;status:string}[]>`SELECT "id", "slug", "title", "status" FROM "ContentPost" WHERE "id"=${id} AND ("content"::text ~* ${pattern} OR "title" ~* ${pattern}) ORDER BY "id"`;
 return client.$queryRaw<{id:string;slug:string;title:string;status:string}[]>`SELECT "id", "slug", "title", "status" FROM "ContentPost" WHERE "content"::text ~* ${pattern} OR "title" ~* ${pattern} ORDER BY "id"`;
}
