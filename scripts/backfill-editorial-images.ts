import { blogPosts } from "../src/lib/blog";
import { generateMissingEditorialImages, getEditorialImageSummary } from "../src/lib/editorial-image-generation";
import { getPrismaClient } from "../src/lib/prisma";

const retryFailed = process.argv.includes("--retry-failed");
const batchArgument = process.argv.find((value) => value.startsWith("--batch="));
const batchSize = Math.max(1, Math.min(Number(batchArgument?.split("=")[1] || 1), 5));
const maxArgument = process.argv.find((value) => value.startsWith("--max="));
const maxItems = Math.max(1, Number(maxArgument?.split("=")[1] || 100));

async function processQueue(label: string) {
  let processed = 0;
  const attemptedContentIds = new Set<string>();
  while (processed < maxItems) {
    const outcomes = await generateMissingEditorialImages(
      Math.min(batchSize, maxItems - processed),
      false,
      [...attemptedContentIds]
    );
    if (!outcomes.length) break;
    outcomes.forEach((outcome) => attemptedContentIds.add(outcome.contentId));
    processed += outcomes.length;
    console.log(JSON.stringify({ label, processed, outcomes }));
  }
  return processed;
}

async function supersedeStaleImages() {
  const prisma = getPrismaClient();
  const [posts, advisories] = await Promise.all([
    prisma.contentPost.findMany({
      where: { status: "published" },
      select: { id: true, updatedAt: true, revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true } } }
    }),
    prisma.securityAdvisory.findMany({
      where: { status: "published" },
      select: { id: true, updatedAt: true, revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true } } }
    })
  ]);
  let superseded = 0;
  for (const record of [...posts.map((item) => ({ ...item, contentType: "content_post" })), ...advisories.map((item) => ({ ...item, contentType: "security_advisory" }))]) {
    const contentRevision = String(record.revisions[0]?.version || record.updatedAt.toISOString());
    const result = await prisma.editorialImage.updateMany({
      where: {
        contentType: record.contentType,
        contentId: record.id,
        contentRevision: { not: contentRevision },
        status: { not: "superseded" }
      },
      data: { status: "superseded" }
    });
    superseded += result.count;
  }
  console.log(JSON.stringify({ phase: "superseded-stale-images", count: superseded }));
}

async function main() {
  const prisma = getPrismaClient();
  const [databasePosts, advisories] = await Promise.all([
    prisma.contentPost.count({ where: { status: "published" } }),
    prisma.securityAdvisory.count({ where: { status: "published" } })
  ]);
  console.log(
    JSON.stringify({ phase: "inventory", databasePosts, staticPosts: blogPosts.length, advisories, batchSize, maxItems })
  );

  await processQueue("initial");

  if (retryFailed) {
    const reset = await prisma.editorialImage.updateMany({
      where: { status: "failed" },
      data: { status: "pending" }
    });
    console.log(JSON.stringify({ phase: "retry-reset", count: reset.count }));
    if (reset.count) await processQueue("retry");
  }

  await supersedeStaleImages();

  const summary = await getEditorialImageSummary();
  console.log(JSON.stringify({ phase: "complete", counts: summary.counts, latest: summary.latest }, null, 2));
  if (Number(summary.counts.failed || 0) > 0) process.exitCode = 2;
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
