import { getPrismaClient } from "../src/lib/prisma";

const contentId = process.argv.find((value) => value.startsWith("--content-id="))?.split("=")[1] || "";

async function main() {
  if (!contentId) throw new Error("Pass --content-id=<id>.");
  const prisma = getPrismaClient();
  const assets = await prisma.editorialImage.findMany({
    where: { contentId },
    orderBy: { updatedAt: "desc" },
    select: {
      agentTrace: true,
      altText: true,
      attempts: true,
      contentRevision: true,
      lastError: true,
      model: true,
      prompt: true,
      provider: true,
      qaScore: true,
      status: true,
      updatedAt: true
    }
  });
  console.log(JSON.stringify(assets, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
