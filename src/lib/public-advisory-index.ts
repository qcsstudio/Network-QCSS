import { getPrismaClient } from "./prisma.ts";
import { readPublicSnapshot } from "./public-read-cache.ts";

// Public archives need every published URL, but never full revision payloads.
export async function getPublicAdvisoryIndex() {
  if (!process.env.DATABASE_URL) {
    if (process.env.STORE_DRIVER === "postgres") throw new Error("Public content store is unavailable.");
    return [];
  }
  const rows = getPrismaClient().securityAdvisory;
  const { data } = await readPublicSnapshot("advisory-index", () => rows.findMany({
    where: { status: { in: ["published", "withdrawn"] }, deletedAt: null },
    orderBy: { id: "asc" },
    select: { id: true, status: true, updatedAt: true,
      revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true, createdAt: true } } }
  }), () => rows.findMany({
    where: { status: { in: ["published", "withdrawn"] }, deletedAt: null },
    orderBy: [{ priorityScore: "desc" }, { vendorPublishedAt: "desc" }, { id: "asc" }],
    select: {
      id: true, slug: true, title: true, vendor: true, summary: true, severity: true, status: true,
      priorityScore: true, cvssScore: true, cves: true, products: true, exploitationStatus: true,
      vendorPublishedAt: true, vendorUpdatedAt: true, lastVerifiedAt: true, createdAt: true, updatedAt: true,
      revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true, createdAt: true } }
    }
  }));
  return data;
}
