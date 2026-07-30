import { upgradePublishedContentPost } from "../src/lib/content-posts";
import { getPrismaClient } from "../src/lib/prisma";

type Source = { label: string; url: string };

const sourceCorrections: Record<string, Source[]> = {
  "fortinet-s-new-fortigate-platform-converges-firewall-sase-technologies-c": [
    {
      label: "Fortinet FortiOS 8.0 secure networking announcement",
      url: "https://www.fortinet.com/corporate/about-us/newsroom/press-releases/2026/fortinet-introduces-fortios-8-expand-secure-networking-with-secure-ai-controls-fabric-based-ai-agents-flexible-sase-and-simplified-sdwan"
    }
  ],
  "strong-password-generator-admin-vpn-wifi-hygiene": [
    {
      label: "NIST SP 800-63B authentication guidance",
      url: "https://pages.nist.gov/800-63-4/sp800-63b.html"
    },
    {
      label: "NIST guidance for creating a good password",
      url: "https://www.nist.gov/cybersecurity-and-privacy/how-do-i-create-good-password"
    }
  ],
  "sase-zero-trust-readiness-network-security": [
    {
      label: "NIST Zero Trust Architecture",
      url: "https://www.nist.gov/publications/zero-trust-architecture-0"
    },
    {
      label: "CISA Zero Trust implementation resources",
      url: "https://www.cisa.gov/topics/cybersecurity-best-practices/executive-order-improving-nations-cybersecurity"
    },
    {
      label: "Cloudflare SASE architecture overview",
      url: "https://www.cloudflare.com/learning/access-management/what-is-sase/"
    }
  ],
  "cloud-network-exposure-checklist-aws-azure-gcp": [
    {
      label: "Microsoft Azure network security best practices",
      url: "https://learn.microsoft.com/en-us/azure/security/fundamentals/network-best-practices"
    },
    {
      label: "AWS Well-Architected network protection guidance",
      url: "https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/protecting-networks.html"
    },
    {
      label: "Google Cloud enterprise foundations blueprint",
      url: "https://docs.cloud.google.com/architecture/blueprints/security-foundations"
    }
  ]
};

function argument(name: string) {
  return process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

async function correctSources() {
  const prisma = getPrismaClient();
  for (const [slug, sources] of Object.entries(sourceCorrections)) {
    const record = await prisma.contentPost.findUnique({ where: { slug } });
    if (!record || record.status !== "published") continue;
    const content = record.content as Record<string, unknown>;
    await prisma.contentPost.update({
      where: { id: record.id },
      data: {
        content: { ...content, sources },
        sourceUrl: sources[0].url
      }
    });
    console.log(JSON.stringify({ phase: "sources-corrected", slug, sources: sources.length }));
  }
}

async function main() {
  const prisma = getPrismaClient();
  const selectedSlug = argument("--slug");
  await correctSources();
  if (process.argv.includes("--sources-only")) {
    await prisma.$disconnect();
    return;
  }

  const posts = await prisma.contentPost.findMany({
    where: {
      status: "published",
      ...(selectedSlug ? { slug: selectedSlug } : {})
    },
    orderBy: { publishedAt: "desc" },
    select: { id: true, slug: true }
  });
  for (const post of posts) {
    try {
      const upgraded = await upgradePublishedContentPost(post.id, "editorial-library-upgrade-v2");
      console.log(
        JSON.stringify({
          phase: "content-upgraded",
          slug: post.slug,
          qualityScore: upgraded?.qualityScore || null,
          contentVersion: upgraded?.content.contentVersion || null
        })
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          phase: "content-upgrade-failed",
          slug: post.slug,
          error: error instanceof Error ? error.message : "Unknown error"
        })
      );
      process.exitCode = 2;
    }
  }
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
