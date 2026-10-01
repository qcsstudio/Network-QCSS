import { getContextualEditorialImage } from "@/lib/editorial-image-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const image = await getContextualEditorialImage("security_advisory", slug, "social");
  return image
    ? new Response(image.image, { headers: { "Content-Type": image.mimeType, "Cache-Control": "no-store" } })
    : new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}
