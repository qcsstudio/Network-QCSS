import { ImageResponse } from "next/og";
import { getPublishedBlogPost } from "@/lib/content-posts";
import { siteConfig } from "@/lib/content";
import { resourceVisualPath } from "@/lib/editorial-visuals";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  const title = post?.title || "QCS Network Intelligence";
  const category = post?.category || "Network operations";
  const asset = new URL(post ? resourceVisualPath(post) : "/brand/network-command-hero.png", siteConfig.url).toString();
  const logo = new URL("/brand/quantumcrafters-logo.png", siteConfig.url).toString();

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#edf3fa", color: "#111b2d", fontFamily: "Arial" }}>
      <div style={{ width: "34%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "46px 38px", background: "#ffffff", borderRight: "8px solid #426bcc" }}>
        <div style={{ width: 285, height: 76, display: "flex", backgroundImage: `url(${logo})`, backgroundRepeat: "no-repeat", backgroundSize: "contain", backgroundPosition: "left center" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", color: "#d62c67", fontSize: 24, fontWeight: 800, textTransform: "uppercase" }}>{category}</div>
          <div style={{ display: "flex", fontSize: title.length > 90 ? 34 : 40, lineHeight: 1.08, fontWeight: 800 }}>{title}</div>
        </div>
        <div style={{ display: "flex", color: "#5c6a7c", fontSize: 21 }}>QCS practical intelligence</div>
      </div>
      <div style={{ width: "66%", height: "100%", display: "flex", background: "#dfe8f3", backgroundImage: `url(${asset})`, backgroundRepeat: "no-repeat", backgroundSize: "cover", backgroundPosition: "center" }} />
    </div>,
    { width: 1200, height: 675 }
  );
}
