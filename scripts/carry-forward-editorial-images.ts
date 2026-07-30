import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  editorialImageInputForPublication,
  type EditorialImageInput
} from "../src/lib/editorial-image-generation";
import { buildEditorialImagePrompt } from "../src/lib/editorial-image-prompt";
import { getPrismaClient } from "../src/lib/prisma";

type Publication = Pick<EditorialImageInput, "contentId" | "contentRevision" | "contentType">;

async function publications(): Promise<Publication[]> {
  const prisma = getPrismaClient();
  const [posts, advisories] = await Promise.all([
    prisma.contentPost.findMany({
      where: { status: "published" },
      select: {
        id: true,
        updatedAt: true,
        revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true } }
      }
    }),
    prisma.securityAdvisory.findMany({
      where: { status: "published" },
      select: {
        id: true,
        updatedAt: true,
        revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true } }
      }
    })
  ]);
  return [
    ...posts.map((post) => ({
      contentId: post.id,
      contentRevision: String(post.revisions[0]?.version || post.updatedAt.toISOString()),
      contentType: "content_post" as const
    })),
    ...advisories.map((advisory) => ({
      contentId: advisory.id,
      contentRevision: String(advisory.revisions[0]?.version || advisory.updatedAt.toISOString()),
      contentType: "security_advisory" as const
    }))
  ];
}

async function main() {
  const prisma = getPrismaClient();
  const outcomes: Array<Record<string, unknown>> = [];
  for (const publication of await publications()) {
    const current = await prisma.editorialImage.findUnique({
      where: { contentType_contentId_contentRevision: publication }
    });
    if (current?.status === "ready") continue;
    if (current?.status === "generating" && Date.now() - current.updatedAt.getTime() < 12 * 60_000) {
      outcomes.push({ ...publication, status: "skipped-active-generation" });
      continue;
    }
    const candidate = await prisma.editorialImage.findFirst({
      where: {
        contentType: publication.contentType,
        contentId: publication.contentId,
        contentRevision: { not: publication.contentRevision },
        provider: "openai-direct",
        model: "gpt-image-2",
        qaScore: { gte: 90 },
        generatedAt: { not: null },
        heroImage: { not: null },
        socialImage: { not: null },
        agentTrace: { not: Prisma.JsonNull }
      },
      orderBy: [{ qaScore: "desc" }, { generatedAt: "desc" }]
    });
    if (!candidate?.heroImage || !candidate.socialImage || !candidate.generatedAt) {
      outcomes.push({ ...publication, status: "generation-required" });
      continue;
    }
    const input = await editorialImageInputForPublication(publication);
    const prompt = buildEditorialImagePrompt(input);
    const promptHash = crypto.createHash("sha256").update(prompt).digest("hex");
    await prisma.editorialImage.upsert({
      where: { contentType_contentId_contentRevision: publication },
      create: {
        ...publication,
        agentTrace: candidate.agentTrace || Prisma.DbNull,
        altText: candidate.altText,
        attempts: 0,
        generatedAt: candidate.generatedAt,
        heroImage: candidate.heroImage,
        lastError: null,
        mimeType: candidate.mimeType,
        model: candidate.model,
        prompt,
        promptHash,
        provider: candidate.provider,
        qaScore: candidate.qaScore,
        socialImage: candidate.socialImage,
        status: "ready"
      },
      update: {
        agentTrace: candidate.agentTrace || Prisma.DbNull,
        altText: candidate.altText,
        generatedAt: candidate.generatedAt,
        heroImage: candidate.heroImage,
        lastError: null,
        mimeType: candidate.mimeType,
        model: candidate.model,
        prompt,
        promptHash,
        provider: candidate.provider,
        qaScore: candidate.qaScore,
        socialImage: candidate.socialImage,
        status: "ready"
      }
    });
    outcomes.push({
      ...publication,
      fromRevision: candidate.contentRevision,
      qaScore: candidate.qaScore,
      status: "carried-forward"
    });
  }
  console.log(JSON.stringify({ outcomes }, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
