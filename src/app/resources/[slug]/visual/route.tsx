import { ImageResponse } from "next/og";
import { EditorialArtwork } from "@/components/editorial-artwork";
import { getPublishedBlogPost } from "@/lib/content-posts";
import { getContextualEditorialImage } from "@/lib/editorial-image-generation";
import { qcsEditorialLogo } from "@/lib/editorial-logo";
import { fallbackVisualProfile, resourceVisualProfile } from "@/lib/editorial-visuals";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  const generated = await getContextualEditorialImage("content_post", slug, "hero");
  if (generated) {
    return new Response(generated.image, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
        "Content-Type": generated.mimeType
      }
    });
  }
  const title = post?.title || "QCS Network Intelligence";
  const logo = await qcsEditorialLogo();
  const profile = post ? resourceVisualProfile(post) : fallbackVisualProfile(title);

  return new ImageResponse(
    <EditorialArtwork format="hero" logoUrl={logo} profile={profile} title={title} />,
    {
      width: 1440,
      height: 810,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" }
    }
  );
}
