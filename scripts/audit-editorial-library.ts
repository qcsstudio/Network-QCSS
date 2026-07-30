import { getPrismaClient } from "../src/lib/prisma";

async function main() {
  const prisma = getPrismaClient();
  const [posts, advisories, imageRecords, images, social, socialRecords] = await Promise.all([
    prisma.contentPost.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        slug: true,
        qualityScore: true,
        researchTrace: true,
        updatedAt: true,
        revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true } }
      }
    }),
    prisma.securityAdvisory.findMany({
      where: { status: "published" },
      select: {
        id: true,
        slug: true,
        qualityScore: true,
        editorialTrace: true,
        updatedAt: true,
        revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true } }
      }
    }),
    prisma.editorialImage.findMany({
      select: { contentType: true, contentId: true, contentRevision: true, status: true, provider: true }
    }),
    prisma.editorialImage.groupBy({ by: ["status", "provider"], _count: { _all: true } }),
    prisma.socialPublication.groupBy({ by: ["status", "contentType"], _count: { _all: true } }),
    prisma.socialPublication.findMany({
      where: { channel: "linkedin" },
      select: { contentId: true, contentRevision: true, contentType: true, status: true }
    })
  ]);

  const expected = [
    ...posts.map((post) => ({
      label: post.slug,
      contentType: "content_post",
      contentId: post.id,
      contentRevision: String(post.revisions[0]?.version || post.updatedAt.toISOString())
    })),
    ...advisories.map((advisory) => ({
      label: advisory.slug,
      contentType: "security_advisory",
      contentId: advisory.id,
      contentRevision: String(advisory.revisions[0]?.version || advisory.updatedAt.toISOString())
    }))
  ];
  const currentImages = expected.map((item) => ({
    ...item,
    image: imageRecords.find(
      (image) =>
        image.contentType === item.contentType &&
        image.contentId === item.contentId &&
        image.contentRevision === item.contentRevision
    )
  }));
  const expectedRevisions = new Map(expected.map((item) => [`${item.contentType}:${item.contentId}`, item.contentRevision]));
  const staleSocialRecords = socialRecords.filter((publication) => {
    const revision = expectedRevisions.get(`${publication.contentType}:${publication.contentId}`);
    return Boolean(revision && revision !== publication.contentRevision);
  });

  console.log(
    JSON.stringify(
      {
        publishedPosts: posts.length,
        posts: posts.map((post) => ({
          slug: post.slug,
          qualityScore: post.qualityScore,
          hasAgentTrace: Boolean(post.researchTrace)
        })),
        publishedAdvisories: advisories.length,
        advisoriesNeedingEditorialTrace: advisories.filter((advisory) => !advisory.editorialTrace).length,
        advisoriesWithQualityScore: advisories.filter((advisory) => typeof advisory.qualityScore === "number").length,
        currentImageCoverage: {
          expected: currentImages.length,
          ready: currentImages.filter((item) => item.image?.status === "ready").length,
          failed: currentImages.filter((item) => item.image?.status === "failed").length,
          missing: currentImages.filter((item) => !item.image).map((item) => item.label)
        },
        staleImageRecords: imageRecords.filter(
          (image) =>
            !expected.some(
              (item) =>
                item.contentType === image.contentType &&
                item.contentId === image.contentId &&
                item.contentRevision === image.contentRevision
            )
        ).length,
        images,
        social,
        socialRevisionCoverage: {
          current: socialRecords.length - staleSocialRecords.length,
          stale: staleSocialRecords.length,
          staleActionable: staleSocialRecords.filter((publication) => publication.status !== "published").length
        }
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
