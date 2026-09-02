import { notFound } from "next/navigation";
import { getPublishedCcnaLessonBySlug } from "@/lib/ccna-learning";
import { ccnaSocialVisual } from "@/lib/ccna-social-visual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = await getPublishedCcnaLessonBySlug(slug).catch(() => null);
  if (!lesson) notFound();
  return ccnaSocialVisual(lesson, size.width, size.height);
}
