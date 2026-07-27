import { ImageResponse } from "next/og";
import { getPublishedBlogPost } from "@/lib/content-posts";
import { resourceVisualPath } from "@/lib/editorial-visuals";

/* next/og requires a native image element while rendering server-side artwork. */
/* eslint-disable @next/next/no-img-element */

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  const title = post?.title || "QCS Network Intelligence";
  const category = post?.category || "Network operations";
  const origin = new URL(request.url).origin;
  const asset = new URL(post ? resourceVisualPath(post) : "/brand/network-command-hero.png", origin).toString();
  const logo = new URL("/brand/quantumcrafters-logo.png", origin).toString();

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#edf3fa", color: "#111b2d", fontFamily: "Arial" }}>
      <div style={{ width: "34%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "74px 61px", background: "#ffffff", borderRight: "13px solid #426bcc" }}>
        <img alt="" src={logo} width={456} height={122} style={{ objectFit: "contain", objectPosition: "left center" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", color: "#d62c67", fontSize: 38, fontWeight: 800, textTransform: "uppercase" }}>{category}</div>
          <div style={{ display: "flex", fontSize: title.length > 90 ? 54 : 64, lineHeight: 1.08, fontWeight: 800 }}>{title}</div>
        </div>
        <div style={{ display: "flex", color: "#5c6a7c", fontSize: 34 }}>QCS practical intelligence</div>
      </div>
      <div style={{ width: "66%", height: "100%", display: "flex", background: "#dfe8f3", backgroundImage: `url(${asset})`, backgroundRepeat: "no-repeat", backgroundSize: "cover", backgroundPosition: "center" }} />
    </div>,
    {
      width: 1920,
      height: 1080,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" }
    }
  );
}
