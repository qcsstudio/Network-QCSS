import { getPrismaClient } from "../src/lib/prisma";

function sinceDate() {
  const value = process.argv.find((argument) => argument.startsWith("--since="))?.slice("--since=".length);
  const parsed = new Date(value || "2026-07-30T18:30:00.000Z");
  if (Number.isNaN(parsed.getTime())) throw new Error("Pass --since as an ISO date.");
  return parsed;
}

async function main() {
  const prisma = getPrismaClient();
  const since = sinceDate();
  const publications = await prisma.socialPublication.findMany({
    where: {
      channel: "linkedin",
      OR: [{ publishedAt: { gte: since } }, { createdAt: { gte: since } }]
    },
    orderBy: { createdAt: "asc" }
  });
  const contentIds = publications.filter((entry) => entry.contentType === "content_post").map((entry) => entry.contentId);
  const advisoryIds = publications
    .filter((entry) => entry.contentType === "security_advisory")
    .map((entry) => entry.contentId);
  const [posts, advisories] = await Promise.all([
    prisma.contentPost.findMany({ where: { id: { in: contentIds } }, select: { id: true, slug: true, title: true } }),
    prisma.securityAdvisory.findMany({
      where: { id: { in: advisoryIds } },
      select: {
        id: true,
        severity: true,
        slug: true,
        title: true,
        vendor: true,
        summary: true,
        technicalExplanation: true,
        businessImpact: true,
        evidenceChecklist: true,
        cves: true,
        products: true,
        affectedVersions: true,
        fixedVersions: true,
        remediation: true,
        workaround: true,
        exploitationStatus: true,
        sourceUrl: true
      }
    })
  ]);
  const postsById = new Map(posts.map((entry) => [entry.id, entry]));
  const advisoriesById = new Map(advisories.map((entry) => [entry.id, entry]));
  console.log(
    JSON.stringify(
      {
        since: since.toISOString(),
        count: publications.length,
        publications: publications.map((entry) => {
          const advisory = advisoriesById.get(entry.contentId) || null;
          const source = advisory || postsById.get(entry.contentId);
          return {
            id: entry.id,
            contentType: entry.contentType,
            title: source?.title || entry.contentId,
            slug: source?.slug || "",
            status: entry.status,
            commentary: entry.commentary,
            commentaryLength: entry.commentary.length,
            externalId: entry.externalId || "",
            publishedAt: entry.publishedAt?.toISOString() || "",
            createdAt: entry.createdAt.toISOString(),
            lastError: entry.lastError || "",
            source: advisory
              ? {
                  ...advisory,
                  cves: Array.isArray(advisory.cves) ? advisory.cves.slice(0, 8) : [],
                  evidenceChecklist: Array.isArray(advisory.evidenceChecklist) ? advisory.evidenceChecklist.slice(0, 4) : []
                }
              : source
          };
        })
      },
      null,
      2
    )
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
