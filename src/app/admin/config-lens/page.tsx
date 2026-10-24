import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { ConfigLensAdmin } from "@/components/config-lens-admin";
export const metadata: Metadata = { title: "Config Lens Update Desk", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function ConfigLensAdminPage() {
  await requireAdmin();
  return <main><nav className="section"><Link href="/admin">Back to admin dashboard</Link></nav><ConfigLensAdmin /></main>;
}
