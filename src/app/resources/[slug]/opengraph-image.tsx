import { ImageResponse } from "next/og";
import { EditorialArtwork } from "@/components/editorial-artwork";
import { getPublishedBlogPost } from "@/lib/content-posts";
import { qcsEditorialLogo } from "@/lib/editorial-logo";
import { fallbackVisualProfile, resourceVisualProfile } from "@/lib/editorial-visuals";

export const runtime = "nodejs";
export const alt = "QCS network engineering guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ResourceOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  const title = post?.title || "QCS Network Intelligence";
  const logo = await qcsEditorialLogo();
  const profile = post ? resourceVisualProfile(post) : fallbackVisualProfile(title);

  return new ImageResponse(
    <EditorialArtwork format="social" logoUrl={logo} profile={profile} title={title} />,
    size
  );
}
