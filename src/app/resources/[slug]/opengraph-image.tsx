import { ImageResponse } from "next/og";
import { EditorialArtwork } from "@/components/editorial-artwork";
import { getPublishedBlogPost } from "@/lib/content-posts";
import { editorialImageDataUrl, getContextualEditorialImage } from "@/lib/editorial-image-generation";
import { qcsEditorialLogo } from "@/lib/editorial-logo";
import { fallbackVisualProfile, resourceVisualProfile } from "@/lib/editorial-visuals";

export const runtime = "nodejs";
export const alt = "QCS network engineering guide";
export const size = { width: 1200, height: 627 };
export const contentType = "image/png";

export default async function ResourceOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  const generated = await getContextualEditorialImage("content_post", slug, "social");
  if (generated) {
    return new ImageResponse(
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* next/og requires a native image element for generated binary artwork. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={generated.altText} height={627} src={editorialImageDataUrl(generated)} style={{ display: "flex", width: "100%", height: "100%", objectFit: "cover" }} width={1200} />
      </div>,
      size
    );
  }
  const title = post?.title || "QCS Network Intelligence";
  const logo = await qcsEditorialLogo();
  const profile = post ? resourceVisualProfile(post) : fallbackVisualProfile(title);

  return new ImageResponse(
    <EditorialArtwork format="social" logoUrl={logo} profile={profile} title={title} />,
    size
  );
}
