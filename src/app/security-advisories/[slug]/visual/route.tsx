import { ImageResponse } from "next/og";
import { EditorialArtwork } from "@/components/editorial-artwork";
import { getSecurityAdvisory } from "@/lib/advisories";
import { qcsEditorialLogo } from "@/lib/editorial-logo";
import { advisoryVisualProfile, fallbackVisualProfile } from "@/lib/editorial-visuals";

export const runtime = "nodejs";
export const revalidate = 3600;

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const advisory = await getSecurityAdvisory(slug);
  const vendor = advisory?.vendor || "QCS Security Advisory Desk";
  const product = advisory ? strings(advisory.products)[0] || "Network security" : "Network security";
  const severity = advisory?.severity || "unrated";
  const logo = await qcsEditorialLogo();
  const title = advisory?.title || `${vendor}: ${product}`;
  const profile = advisory ? advisoryVisualProfile(advisory) : fallbackVisualProfile(title);

  return new ImageResponse(
    <EditorialArtwork format="hero" logoUrl={logo} profile={profile} statusLabel={`${severity} advisory`} title={title} />,
    {
      width: 1440,
      height: 810,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" }
    }
  );
}
