import { ImageResponse } from "next/og";
import { getPublishedBlogPost } from "@/lib/content-posts";

export const runtime = "nodejs";
export const alt = "QCS network engineering guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ResourceOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  const title = post?.title || "QCS Network Intelligence";
  const category = post?.category || "Network operations";
  const keywords = post?.keywords.slice(0, 3) || ["Network", "Security", "Cloud"];

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#f4f7fb", color: "#111b2d", padding: 58, fontFamily: "Arial" }}>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", border: "2px solid #cbd7e6", padding: 44, background: "#ffffff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 25, fontWeight: 800, color: "#d62c67" }}>QUANTUMCRAFTERS STUDIO</div>
          <div style={{ display: "flex", fontSize: 22, color: "#426bcc" }}>{category}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 42 }}>
          <div style={{ width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center", border: "18px solid #ff7b3f", borderRadius: 100, fontSize: 43, fontWeight: 900, color: "#d62c67" }}>QCS</div>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 810 }}>
            <div style={{ display: "flex", fontSize: title.length > 100 ? 42 : 50, lineHeight: 1.08, fontWeight: 850 }}>{title}</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {keywords.map((keyword) => <div key={keyword} style={{ display: "flex", background: "#eef3fb", border: "1px solid #c8d5e7", padding: "9px 14px", fontSize: 18 }}>{keyword}</div>)}
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#5c6a7c" }}>qcsstudio.com/resources</div>
        </div>
      </div>
    </div>,
    size
  );
}
