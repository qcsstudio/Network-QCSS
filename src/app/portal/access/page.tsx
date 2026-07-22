import type { Metadata } from "next";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { PortalAccessForm } from "@/components/portal-access-form";
import { getVerifyGridPortalSession } from "@/lib/verifygrid-portal-auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "VerifyGrid Client Access", robots: { index: false, follow: false } };

export default async function VerifyGridPortalAccessPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getVerifyGridPortalSession()) redirect("/portal");
  const { error } = await searchParams;
  return (
    <main className="portal-access-page">
      <section className="portal-access-panel">
        <Image alt="QuantumCrafters Studio Pvt. Ltd." className="portal-brand-logo" height={72} priority src="/brand/quantumcrafters-logo.png" width={320} />
        <ShieldCheck aria-hidden="true" size={34} />
        <p className="eyebrow">QCS VerifyGrid</p>
        <h1>Client assurance access</h1>
        <p>Use the one-time workspace link supplied by QCS. Access remains isolated to the membership encoded in that invitation.</p>
        <PortalAccessForm />
        {error ? <p className="form-note error">This link is invalid, expired, already used, or revoked.</p> : null}
      </section>
    </main>
  );
}
