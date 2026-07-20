import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogArticle } from "@/components/blog-article";
import { requireAdmin } from "@/lib/admin-auth";
import { getContentPost } from "@/lib/content-posts";

export const metadata: Metadata = {
  title: "Article Preview",
  robots: { index: false, follow: false }
};

export const dynamic = "force-dynamic";

type PreviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ContentPreviewPage({ params }: PreviewPageProps) {
  await requireAdmin();
  const { id } = await params;
  const post = await getContentPost(id);
  if (!post) notFound();

  return (
    <main>
      <section className="content-preview-bar">
        <div>
          <p className="eyebrow">Private preview</p>
          <strong>{post.status}</strong>
          <span>Revision {post.revisions[0]?.version || 1}</span>
        </div>
        <Link className="button secondary" href="/admin#content-studio">
          Back to Content Studio
        </Link>
      </section>
      <BlogArticle post={post.content} showLeadForm={false} />
    </main>
  );
}
