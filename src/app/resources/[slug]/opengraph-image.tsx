import { ImageResponse } from "next/og";
import { getPublishedBlogPost } from "@/lib/content-posts";
import { siteConfig } from "@/lib/content";
import { resourceVisualPath } from "@/lib/editorial-visuals";

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
  const asset = new URL(post ? resourceVisualPath(post) : "/brand/network-command-hero.png", siteConfig.url).toString();
  const logo = new URL("/brand/quantumcrafters-logo.png", siteConfig.url).toString();

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#edf3fa", color: "#111b2d", padding: 38, fontFamily: "Arial" }}>
      <div style={{ width: "100%", display: "flex", border: "2px solid #cbd7e6", background: "#ffffff" }}>
        <div style={{ width: "64%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 38 }}>
          <div style={{ width: 300, height: 76, display: "flex", backgroundImage: `url(${logo})`, backgroundRepeat: "no-repeat", backgroundSize: "contain", backgroundPosition: "left center" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", color: "#426bcc", fontSize: 22, fontWeight: 800, textTransform: "uppercase" }}>{category}</div>
            <div style={{ display: "flex", fontSize: title.length > 100 ? 38 : 46, lineHeight: 1.08, fontWeight: 850 }}>{title}</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {keywords.map((keyword) => <div key={keyword} style={{ display: "flex", background: "#eef3fb", border: "1px solid #c8d5e7", padding: "8px 12px", fontSize: 17 }}>{keyword}</div>)}
          </div>
        </div>
        <div style={{ width: "36%", display: "flex", background: "#dfe8f3", borderLeft: "7px solid #d62c67", backgroundImage: `url(${asset})`, backgroundRepeat: "no-repeat", backgroundSize: "cover", backgroundPosition: "center" }} />
      </div>
    </div>,
    size
  );
}
