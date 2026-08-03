import { ImageResponse } from "next/og";
import { EditorialArtwork } from "@/components/editorial-artwork";
import { getSecurityAdvisory } from "@/lib/advisories";
import { editorialImageDataUrl, getContextualEditorialImage } from "@/lib/editorial-image-generation";
import { qcsEditorialLogo } from "@/lib/editorial-logo";
import { advisoryVisualProfile, fallbackVisualProfile } from "@/lib/editorial-visuals";

export const runtime = "nodejs";
export const alt = "QCS network security advisory";
export const size = { width: 1200, height: 627 };
export const contentType = "image/png";

export default async function AdvisoryOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const advisory = await getSecurityAdvisory(slug);
  const generated = await getContextualEditorialImage("security_advisory", slug, "social");
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
  const title = advisory?.title || "QCS Network Security Advisory";
  const severity = advisory?.severity || "unrated";
  const logo = await qcsEditorialLogo();
  const profile = advisory ? advisoryVisualProfile(advisory) : fallbackVisualProfile(title);

  return new ImageResponse(
    <EditorialArtwork format="social" logoUrl={logo} profile={profile} statusLabel={`${severity} advisory`} title={title} />,
    size
  );
}
