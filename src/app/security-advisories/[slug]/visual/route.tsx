import { ImageResponse } from "next/og";
import { getSecurityAdvisory } from "@/lib/advisories";
import { advisoryVisualPath } from "@/lib/editorial-visuals";

/* next/og requires a native image element while rendering server-side artwork. */
/* eslint-disable @next/next/no-img-element */

export const runtime = "nodejs";
export const revalidate = 3600;

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const advisory = await getSecurityAdvisory(slug);
  const vendor = advisory?.vendor || "QCS Security Advisory Desk";
  const product = advisory ? strings(advisory.products)[0] || "Network security" : "Network security";
  const severity = advisory?.severity || "unrated";
  const origin = new URL(request.url).origin;
  const asset = new URL(advisory ? advisoryVisualPath(advisory) : "/brand/envato/library/security-network-shield.webp", origin).toString();
  const logo = new URL("/brand/quantumcrafters-logo.png", origin).toString();
  const accent = severity === "critical" ? "#b4233d" : severity === "high" ? "#c25320" : severity === "medium" ? "#9a6900" : "#426bcc";

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#081525", color: "#f8fbff", fontFamily: "Arial" }}>
      <div style={{ width: "36%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "70px 61px", borderRight: `13px solid ${accent}` }}>
        <img alt="" src={logo} width={448} height={122} style={{ objectFit: "contain", objectPosition: "left center" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ display: "flex", alignSelf: "flex-start", background: accent, padding: "14px 22px", fontSize: 32, fontWeight: 900, textTransform: "uppercase" }}>{severity}</div>
          <div style={{ display: "flex", color: "#69a7ff", fontSize: 43, fontWeight: 800 }}>{vendor}</div>
          <div style={{ display: "flex", fontSize: 58, lineHeight: 1.1, fontWeight: 800 }}>{product}</div>
        </div>
        <div style={{ display: "flex", color: "#c9d7e6", fontSize: 34 }}>Source verified. Action oriented.</div>
      </div>
      <div style={{ width: "64%", height: "100%", display: "flex", background: "#dfe8f3", backgroundImage: `url(${asset})`, backgroundRepeat: "no-repeat", backgroundSize: "cover", backgroundPosition: "center" }} />
    </div>,
    {
      width: 1920,
      height: 1080,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" }
    }
  );
}
