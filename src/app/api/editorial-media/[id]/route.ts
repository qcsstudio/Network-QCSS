import { getPrismaClient } from "@/lib/prisma";
import { publishedRevision } from "@/lib/editorial-delivery";
import { readStaticEditorialImage } from "@/lib/editorial-static-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return new Response(null, { status: 404 });
  const url = new URL(request.url);
  const variant = url.searchParams.get("variant");
  if (variant !== "hero" && variant !== "social") return new Response(null, { status: 400 });
  try {
    const prisma = getPrismaClient();
    // Reject stale or unpublished media before transferring any image bytes.
    const asset = await prisma.editorialImage.findUnique({ where: { id }, select: {
      contentType: true, contentId: true, contentRevision: true, status: true, generatedAt: true
    } });
    if (!asset || asset.status !== "ready" || !asset.generatedAt || url.searchParams.get("v") !== asset.generatedAt.toISOString()) return new Response(null, { status: 404 });
    const source = await publishedRevision(asset.contentType, asset.contentId);
    if (!source || source.revision !== asset.contentRevision) return new Response(null, { status: 404 });
    const staticImage = await readStaticEditorialImage({ id, ...asset }, variant);
    if (staticImage) {
      // Recheck metadata after the external fetch so a replacement/withdrawal
      // cannot be bypassed by an older immutable file at the private origin.
      const current = await prisma.editorialImage.findFirst({
        where: { id, status: "ready", generatedAt: asset.generatedAt, contentRevision: asset.contentRevision,
          contentType: asset.contentType, contentId: asset.contentId },
        select: { mimeType: true }
      });
      const published = await publishedRevision(asset.contentType, asset.contentId);
      if (!current || current.mimeType !== staticImage.mimeType || published?.revision !== asset.contentRevision)
        return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
      return new Response(new Uint8Array(staticImage.image), { headers: {
        "Content-Type": staticImage.mimeType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"
      } });
    }
    const media = await prisma.editorialImage.findFirst({
      where: { id, status: "ready", generatedAt: asset.generatedAt, contentRevision: asset.contentRevision,
        contentType: asset.contentType, contentId: asset.contentId },
      select: { mimeType: true, heroImage: variant === "hero", socialImage: variant === "social" }
    });
    if (!media) return new Response(null, { status: 404 });
    const image = variant === "hero" ? media.heroImage : media.socialImage;
    if (!image) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(image), { headers: { "Content-Type": media.mimeType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  }
}
