import { ImageResponse } from "next/og";
import { AdvisoryImagePending } from "@/components/advisory-image-pending";
import { getContextualEditorialImage } from "@/lib/editorial-image-generation";
import { qcsEditorialLogo } from "@/lib/editorial-logo";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const generated = await getContextualEditorialImage("security_advisory", slug, "hero");
  if (generated) {
    return new Response(generated.image, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
        "Content-Type": generated.mimeType
      }
    });
  }
  const logo = await qcsEditorialLogo();

  return new ImageResponse(
    <AdvisoryImagePending logoUrl={logo} />,
    {
      width: 1440,
      height: 810,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
