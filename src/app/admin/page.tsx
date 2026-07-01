import type { Metadata } from "next";
import { OperatorDashboard } from "@/components/operator-dashboard";
import { getDashboardSnapshot } from "@/lib/store";

export const metadata: Metadata = {
  title: "Operator Dashboard",
  robots: { index: false, follow: false }
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const snapshot = await getDashboardSnapshot();

  return (
    <main>
      <section className="page-hero dark">
        <p className="eyebrow">Private layer</p>
        <h1>Lead intelligence, assessment signals, and pipeline activity.</h1>
        <p>
          This dashboard reads the same API-backed data that will later sync into CRM, automation, WhatsApp, and reporting
          systems.
        </p>
      </section>
      <section className="section flush">
        <OperatorDashboard snapshot={snapshot} />
      </section>
    </main>
  );
}
