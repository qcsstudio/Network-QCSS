import type { Metadata } from "next";
import { ContentRadarPanel } from "@/components/content-radar-panel";
import { OperatorDashboard } from "@/components/operator-dashboard";
import { requireAdmin } from "@/lib/admin-auth";
import { requestContext } from "@/lib/security";
import { createAuditLog, getDashboardSnapshot, getEmptyDashboardSnapshot } from "@/lib/store";

export const metadata: Metadata = {
  title: "Operator Dashboard",
  robots: { index: false, follow: false }
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireAdmin();
  await createAuditLog(
    {
      action: "admin.dashboard_view",
      actor: session.email,
      target: "admin"
    },
    await requestContext()
  );
  const dashboardResult = await getDashboardSnapshot()
    .then((snapshot) => ({ snapshot, storageUnavailable: false }))
    .catch((error) => {
      console.error("Admin dashboard storage is unavailable.", error);
      return { snapshot: getEmptyDashboardSnapshot(), storageUnavailable: true };
    });
  const { snapshot, storageUnavailable } = dashboardResult;

  return (
    <main>
      <section className="page-hero dark">
        <p className="eyebrow">Private layer</p>
        <h1>Lead intelligence, assessment signals, and pipeline activity.</h1>
        <p>
          This dashboard reads the same API-backed data that will later sync into CRM, automation, WhatsApp, and reporting
          systems.
        </p>
        <form method="post" action="/api/admin/logout">
          <button className="button secondary" type="submit">
            Sign out {session.email}
          </button>
        </form>
      </section>
      <section className="section flush">
        {storageUnavailable ? (
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Storage connection</p>
                <h2>Dashboard data is temporarily unavailable.</h2>
                <p>Configure PostgreSQL and run the production migration before relying on lead and assessment reporting.</p>
              </div>
              <span className="status-pill missing">Action required</span>
            </div>
          </section>
        ) : null}
        <ContentRadarPanel />
        <OperatorDashboard snapshot={snapshot} />
      </section>
    </main>
  );
}
