import { getPrismaClient } from "@/lib/prisma";
import { publishedRevision } from "@/lib/editorial-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return new Response(null, { status: 404 });
  const url = new URL(request.url);
  const variant = url.searchParams.get("variant");
  if (variant !== "hero" && variant !== "social") return new Response(null, { status: 400 });
  try {
    const asset = await getPrismaClient().editorialImage.findUnique({ where: { id } });
    if (!asset || asset.status !== "ready" || !asset.generatedAt || url.searchParams.get("v") !== asset.generatedAt.toISOString()) return new Response(null, { status: 404 });
    const source = await publishedRevision(asset.contentType, asset.contentId);
    if (!source || source.revision !== asset.contentRevision) return new Response(null, { status: 404 });
    const image = variant === "hero" ? asset.heroImage : asset.socialImage;
    if (!image) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(image), { headers: { "Content-Type": asset.mimeType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  }
}
