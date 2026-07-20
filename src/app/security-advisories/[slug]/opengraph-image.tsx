import { ImageResponse } from "next/og";
import { getSecurityAdvisory } from "@/lib/advisories";

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

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#081525", color: "#f8fbff", padding: 58, fontFamily: "Arial" }}>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", border: "2px solid #28415f", padding: 44 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 25, fontWeight: 700, color: "#ff7b3f" }}>QCS SECURITY ADVISORY DESK</div>
          <div style={{ display: "flex", background: accent, color: "white", padding: "12px 22px", fontSize: 24, fontWeight: 800, textTransform: "uppercase" }}>{severity}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 1010 }}>
          <div style={{ display: "flex", color: "#69a7ff", fontSize: 28, fontWeight: 700, marginBottom: 18 }}>{vendor}</div>
          <div style={{ display: "flex", fontSize: title.length > 105 ? 42 : 50, lineHeight: 1.08, fontWeight: 800 }}>{title}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {(cves.length ? cves : ["SOURCE VERIFIED", "ACTION READY"]).map((item) => (
              <div key={item} style={{ display: "flex", border: "1px solid #466382", padding: "9px 14px", fontSize: 18 }}>{item}</div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#c9d7e6" }}>qcsstudio.com/security-advisories</div>
        </div>
      </div>
    </div>,
    size
  );
}
