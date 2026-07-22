import { ImageResponse } from "next/og";
import { getSecurityAdvisory } from "@/lib/advisories";
import { siteConfig } from "@/lib/content";
import { advisoryVisualPath } from "@/lib/editorial-visuals";

export const runtime = "nodejs";

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const advisory = await getSecurityAdvisory(slug);
  const vendor = advisory?.vendor || "QCS Security Advisory Desk";
  const product = advisory ? strings(advisory.products)[0] || "Network security" : "Network security";
  const severity = advisory?.severity || "unrated";
  const asset = new URL(advisory ? advisoryVisualPath(advisory) : "/brand/envato/library/security-network-shield.webp", siteConfig.url).toString();
  const logo = new URL("/brand/quantumcrafters-logo.png", siteConfig.url).toString();
  const accent = severity === "critical" ? "#b4233d" : severity === "high" ? "#c25320" : severity === "medium" ? "#9a6900" : "#426bcc";

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#081525", color: "#f8fbff", fontFamily: "Arial" }}>
      <div style={{ width: "36%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "44px 38px", borderRight: `8px solid ${accent}` }}>
        <div style={{ width: 280, height: 76, display: "flex", backgroundImage: `url(${logo})`, backgroundRepeat: "no-repeat", backgroundSize: "contain", backgroundPosition: "left center" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignSelf: "flex-start", background: accent, padding: "9px 14px", fontSize: 20, fontWeight: 900, textTransform: "uppercase" }}>{severity}</div>
          <div style={{ display: "flex", color: "#69a7ff", fontSize: 27, fontWeight: 800 }}>{vendor}</div>
          <div style={{ display: "flex", fontSize: 36, lineHeight: 1.1, fontWeight: 800 }}>{product}</div>
        </div>
        <div style={{ display: "flex", color: "#c9d7e6", fontSize: 21 }}>Source verified. Action oriented.</div>
      </div>
      <div style={{ width: "64%", height: "100%", display: "flex", background: "#dfe8f3", backgroundImage: `url(${asset})`, backgroundRepeat: "no-repeat", backgroundSize: "cover", backgroundPosition: "center" }} />
    </div>,
    { width: 1200, height: 675 }
  );
}
