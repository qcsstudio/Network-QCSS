import { notFound } from "next/navigation";
import { getPublicCcnaLessonBySlug } from "@/lib/ccna-public-lessons";
import { ccnaSocialVisual } from "@/lib/ccna-social-visual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = await getPublicCcnaLessonBySlug(slug).catch(() => null);
  if (!lesson) notFound();
  return ccnaSocialVisual(lesson, size.width, size.height);
}
