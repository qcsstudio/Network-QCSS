import { ImageResponse } from "next/og";
import { getSecurityAdvisory } from "@/lib/advisories";
import { siteConfig } from "@/lib/content";
import { advisoryVisualPath } from "@/lib/editorial-visuals";

export const runtime = "nodejs";
export const alt = "QCS network security advisory";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
export default async function AdvisoryOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const advisory = await getSecurityAdvisory(slug);
  const title = advisory?.title || "QCS Network Security Advisory";
  const vendor = advisory?.vendor || "Source-verified intelligence";
  const severity = advisory?.severity || "unrated";
  const cves = advisory ? strings(advisory.cves).slice(0, 3) : [];
  const accent = severity === "critical" ? "#dc264f" : severity === "high" ? "#ef6c2c" : severity === "medium" ? "#d99b18" : "#3c6fd8";
  const asset = new URL(advisory ? advisoryVisualPath(advisory) : "/brand/envato/library/security-network-shield.webp", siteConfig.url).toString();
  const logo = new URL("/brand/quantumcrafters-logo.png", siteConfig.url).toString();

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#081525", color: "#f8fbff", padding: 38, fontFamily: "Arial" }}>
      <div style={{ width: "100%", display: "flex", border: "2px solid #28415f" }}>
        <div style={{ width: "68%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 38 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ width: 285, height: 72, display: "flex", backgroundImage: `url(${logo})`, backgroundRepeat: "no-repeat", backgroundSize: "contain", backgroundPosition: "left center" }} />
            <div style={{ display: "flex", background: accent, color: "white", padding: "10px 18px", fontSize: 21, fontWeight: 800, textTransform: "uppercase" }}>{severity}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", color: "#69a7ff", fontSize: 26, fontWeight: 700, marginBottom: 16 }}>{vendor}</div>
            <div style={{ display: "flex", fontSize: title.length > 105 ? 38 : 45, lineHeight: 1.08, fontWeight: 800 }}>{title}</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {(cves.length ? cves : ["SOURCE VERIFIED", "ACTION READY"]).map((item) => <div key={item} style={{ display: "flex", border: "1px solid #466382", padding: "8px 12px", fontSize: 17 }}>{item}</div>)}
          </div>
        </div>
        <div style={{ width: "32%", display: "flex", background: "#dfe8f3", borderLeft: `7px solid ${accent}`, backgroundImage: `url(${asset})`, backgroundRepeat: "no-repeat", backgroundSize: "cover", backgroundPosition: "center" }} />
      </div>
    </div>,
    size
  );
}
