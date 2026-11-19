import { getPrismaClient } from "./prisma.ts";
import { readPublicSnapshot } from "./public-read-cache.ts";
import {isReviewedAdvisoryIdentity,reviewedEnvelope} from './reviewed-advisory-domain.ts';
import { automatedCandidateHash, automatedReleaseBySlug } from './automated-advisory-domain.ts';

export async function publicAdvisoryBySlug(slug: string) {
  const rows = getPrismaClient().securityAdvisory;
  const visible = { slug, status: { in: ["published", "withdrawn"] }, deletedAt: null };
  const { data } = await readPublicSnapshot(`advisory:${slug}`, () => rows.findFirst({ where: visible,
    select: { id: true, updatedAt: true, status: true, contentHash: true, editorialTrace: true,
      source: { select: { name: true, officialHost: true, lastSuccessAt: true } },
      revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true, createdAt: true } } }
  }), async current => current ? rows.findFirst({ where: { ...visible, id: current.id, updatedAt: current.updatedAt },
    select: {
      id: true, slug: true, title: true, vendor: true, summary: true, technicalExplanation: true,
      businessImpact: true, evidenceChecklist: true, severity: true, cvssScore: true, priorityScore: true,
      cves: true, products: true, affectedVersions: true, fixedVersions: true, remediation: true,
      workaround: true, exploitationStatus: true, sourceUrl: true, status: true, firstSeenAt: true,
      vendorPublishedAt: true, vendorUpdatedAt: true, lastVerifiedAt: true, createdAt: true, updatedAt: true,
      contentHash: true, editorialTrace: true,
      source: { select: { name: true, officialHost: true, lastSuccessAt: true } },
      revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true, createdAt: true, payload:isReviewedAdvisoryIdentity({slug}) } }
    }
  }) : null);
  if (!data) return null;
  const trace = data.editorialTrace;
  const marked = trace && typeof trace === 'object' && !Array.isArray(trace)
    && Object.hasOwn(trace, 'automatedAdvisory');
  let automaticRelease: NonNullable<ReturnType<typeof automatedReleaseBySlug>> | null = null;
  if (marked) {
    const marker = trace.automatedAdvisory;
    const release = automatedReleaseBySlug(slug);
    // A marked record must never fall back to an unbound public article.
    if (data.status !== 'published' || data.slug !== slug || !release || release.slug !== slug
      || !marker || typeof marker !== 'object' || Array.isArray(marker)) return null;
    const candidateSha256 = automatedCandidateHash(release);
    if (marker.releaseId !== release.releaseId || marker.candidateSha256 !== candidateSha256
      || data.contentHash !== candidateSha256) return null;
    automaticRelease = release;
  }
  return {...data, automaticRelease, reviewedRelease:data.status==='published'&&isReviewedAdvisoryIdentity({slug})?reviewedEnvelope(data.revisions[0]?.payload):null};
}
