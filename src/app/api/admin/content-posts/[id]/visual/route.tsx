import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { EditorialArtwork } from "@/components/editorial-artwork";
import { isAdminRequest } from "@/lib/admin-auth";
import { getContentPost } from "@/lib/content-posts";
import { qcsEditorialLogo } from "@/lib/editorial-logo";
import { resourceVisualProfile } from "@/lib/editorial-visuals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const post = await getContentPost(id);
  if (!post) {
    return NextResponse.json({ error: "Content post not found" }, { status: 404 });
  }

  const logo = await qcsEditorialLogo();
  const profile = resourceVisualProfile(post.content);

  return new ImageResponse(
    <EditorialArtwork format="hero" logoUrl={logo} profile={profile} title={post.content.title} />,
    {
      width: 1440,
      height: 810,
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    }
  );
}
