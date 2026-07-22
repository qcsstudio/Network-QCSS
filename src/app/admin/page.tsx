import type { Metadata } from "next";
import { ContentRadarPanel, type ContentPostRecord } from "@/components/content-radar-panel";
import { OperatorDashboard } from "@/components/operator-dashboard";
import { requireAdmin } from "@/lib/admin-auth";
import { requestContext } from "@/lib/security";
import { createAuditLog, getDashboardSnapshot, getEmptyDashboardSnapshot } from "@/lib/store";
import { listContentPosts } from "@/lib/content-posts";
import { DistributionControlPanel } from "@/components/distribution-control-panel";
import { getDistributionSnapshot } from "@/lib/distribution";
import { AdvisoryManagementPanel } from "@/components/advisory-management-panel";
import { listAdminSecurityAdvisories, type AdminAdvisoryRecord } from "@/lib/advisories";
import { VerifyGridControlPanel } from "@/components/verifygrid-control-panel";
import { getEmptyVerifyGridPortfolio, getVerifyGridPortfolio, type VerifyGridPortfolio } from "@/lib/verifygrid";

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
  const contentPosts = await listContentPosts().catch((error) => {
    console.error("Content Studio storage is unavailable.", error);
    return [] as ContentPostRecord[];
  });
  const distributionSnapshot = await getDistributionSnapshot().catch((error) => {
    console.error("Distribution operations are unavailable.", error);
    return null;
  });
  const advisories = await listAdminSecurityAdvisories().catch((error) => {
    console.error("Advisory management storage is unavailable.", error);
    return [] as AdminAdvisoryRecord[];
  });
  const verifyGridPortfolio = await getVerifyGridPortfolio().catch((error) => {
    if (process.env.NODE_ENV === "production") console.error("VerifyGrid storage is unavailable.", error);
    else console.warn("VerifyGrid development database is not migrated; rendering an empty portfolio.");
    return process.env.NODE_ENV === "development" ? getEmptyVerifyGridPortfolio() : null as VerifyGridPortfolio | null;
  });

  return (
    <main className="admin-page">
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
      <section className="section flush admin-dashboard-section">
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
        <VerifyGridControlPanel initialPortfolio={verifyGridPortfolio} />
        <DistributionControlPanel initialSnapshot={distributionSnapshot} />
        <AdvisoryManagementPanel initialAdvisories={advisories} />
        <ContentRadarPanel initialPosts={contentPosts} />
        <OperatorDashboard snapshot={snapshot} />
      </section>
    </main>
  );
}
