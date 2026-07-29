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
  while (processed < maxItems) {
    const outcomes = await generateMissingEditorialImages(Math.min(batchSize, maxItems - processed), false);
    if (!outcomes.length) break;
    processed += outcomes.length;
    console.log(JSON.stringify({ label, processed, outcomes }));
    if (outcomes.every((outcome) => outcome.status === "deferred")) break;
  }
  return processed;
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

  const summary = await getEditorialImageSummary();
  console.log(JSON.stringify({ phase: "complete", counts: summary.counts, latest: summary.latest }, null, 2));
  if (Number(summary.counts.failed || 0) > 0) process.exitCode = 2;
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
