import { getPublishedCcnaLessonBySlug } from "@/lib/ccna-learning";
import { ccnaSocialVisual } from "@/lib/ccna-social-visual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = await getPublishedCcnaLessonBySlug(slug).catch(() => null);
  if (!lesson) return new Response("Lesson not found", { status: 404 });
  return ccnaSocialVisual(lesson, 1920, 1080);
}
