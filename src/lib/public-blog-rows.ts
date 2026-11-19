import { getPrismaClient } from "./prisma.ts";
import { readPublicSnapshot } from "./public-read-cache.ts";

export async function publicBlogRows(slug?: string) {
  const posts = getPrismaClient().contentPost;
  return readPublicSnapshot(`blogs:${slug || "all"}`, () => posts.findMany({
    where: slug ? { slug } : {}, orderBy: { id: "asc" },
    select: { id: true, slug: true, status: true, updatedAt: true }
  }), async current => {
    const published = current.filter(row => row.status === "published");
    if (!published.length) return [];
    return posts.findMany({
      where: { status: "published", OR: published.map(row => ({ id: row.id, updatedAt: row.updatedAt })) },
      select: { id: true, slug: true, content: true }, orderBy: { publishedAt: "desc" }
    });
  });
}
