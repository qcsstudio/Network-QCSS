import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArticle } from "@/components/blog-article";
import { getApprovalPreview } from "@/lib/editorial-approvals";
import { buildEditorialLinkedInCommentary } from "@/lib/social-publications";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private Editorial Review",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true }
};

export default async function ContentReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const preview = await getApprovalPreview(id, query.token || "");
  if (!preview) notFound();
  return (
    <main>
      <section className="review-banner">
        <p className="eyebrow">Private WhatsApp review</p>
        <h1>Revision {preview.approval.revisionVersion}</h1>
        <p>This preview expires {preview.approval.expiresAt.toLocaleString("en-IN")}. Use the buttons in the original WhatsApp message to decide.</p>
      </section>
      <BlogArticle post={preview.post.content} showLeadForm={false} />
      <section className="section">
        <div className="answer-panel">
          <p className="eyebrow">Proposed LinkedIn post</p>
          <pre className="linkedin-caption-preview">{buildEditorialLinkedInCommentary(preview.post)}</pre>
        </div>
      </section>
    </main>
  );
}
