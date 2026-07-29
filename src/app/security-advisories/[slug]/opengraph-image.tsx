import { ImageResponse } from "next/og";
import { EditorialArtwork } from "@/components/editorial-artwork";
import { getSecurityAdvisory } from "@/lib/advisories";
import { qcsEditorialLogo } from "@/lib/editorial-logo";
import { advisoryVisualProfile, fallbackVisualProfile } from "@/lib/editorial-visuals";

export const runtime = "nodejs";
export const alt = "QCS network security advisory";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function AdvisoryOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const advisory = await getSecurityAdvisory(slug);
  const title = advisory?.title || "QCS Network Security Advisory";
  const severity = advisory?.severity || "unrated";
  const logo = await qcsEditorialLogo();
  const profile = advisory ? advisoryVisualProfile(advisory) : fallbackVisualProfile(title);

  return new ImageResponse(
    <EditorialArtwork format="social" logoUrl={logo} profile={profile} statusLabel={`${severity} advisory`} title={title} />,
    size
  );
}
