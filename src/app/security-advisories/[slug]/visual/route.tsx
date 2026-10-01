import { getContextualEditorialImage } from "@/lib/editorial-image-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const generated = await getContextualEditorialImage("security_advisory", slug, "hero");
  if (generated) {
    return new Response(generated.image, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": generated.mimeType
      }
    });
  }
  return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}
