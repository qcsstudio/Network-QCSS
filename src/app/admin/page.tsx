import type { Metadata } from "next";
import Image from "next/image";
import { LogOut, ShieldCheck } from "lucide-react";
import { AdminDashboardTabs } from "@/components/admin-dashboard-tabs";
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
import { VerifyGridOnboardingQueue } from "@/components/verifygrid-onboarding-queue";
import { getEmptyVerifyGridPortfolio, getVerifyGridPortfolio, type VerifyGridPortfolio } from "@/lib/verifygrid";
import { VerifyGridAccessGate } from "@/components/verifygrid-access-gate";
import { getVerifyGridAccessState } from "@/lib/verifygrid-operator-auth";

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
  const [dashboardResult, contentPosts, distributionSnapshot, advisories, verifyGridAccess] = await Promise.all([
    getDashboardSnapshot()
      .then((snapshot) => ({ snapshot, storageUnavailable: false }))
      .catch((error) => {
        console.error("Admin dashboard storage is unavailable.", error);
        return { snapshot: getEmptyDashboardSnapshot(), storageUnavailable: true };
      }),
    listContentPosts().catch((error) => {
      console.error("Content Studio storage is unavailable.", error);
      return [] as ContentPostRecord[];
    }),
    getDistributionSnapshot().catch((error) => {
      console.error("Distribution operations are unavailable.", error);
      return null;
    }),
    listAdminSecurityAdvisories().catch((error) => {
      console.error("Advisory management storage is unavailable.", error);
      return [] as AdminAdvisoryRecord[];
    }),
    getVerifyGridAccessState(session.email)
  ]);
  const { snapshot, storageUnavailable } = dashboardResult;
  const verifyGridPortfolio = verifyGridAccess.state === "unlocked" ? await getVerifyGridPortfolio().catch((error) => {
    if (process.env.NODE_ENV === "production") console.error("VerifyGrid storage is unavailable.", error);
    else console.warn("VerifyGrid development database is not migrated; rendering an empty portfolio.");
    return process.env.NODE_ENV === "development" ? getEmptyVerifyGridPortfolio() : null as VerifyGridPortfolio | null;
  }) : null;

  return (
    <main className="admin-page">
      <header className="admin-command-header">
        <div className="admin-command-header-inner">
          <div className="admin-command-brand">
            <Image alt="QuantumCrafters Studio Pvt. Ltd." height={100} priority src="/brand/quantumcrafters-logo.png" width={328} />
            <span aria-hidden="true" className="admin-command-divider" />
            <div>
              <p><i aria-hidden="true" /> QCS Network Command</p>
              <h1>Operations dashboard</h1>
            </div>
          </div>
          <div className="admin-command-session">
            <ShieldCheck aria-hidden="true" size={20} />
            <div><span>Authenticated operator</span><strong>{session.email}</strong></div>
            <form method="post" action="/api/admin/logout">
              <button aria-label="Sign out" className="icon-button" title="Sign out" type="submit"><LogOut aria-hidden="true" size={19} /></button>
            </form>
          </div>
        </div>
      </header>
      <section className="admin-dashboard-section">
        {storageUnavailable ? (
          <section className="admin-system-alert">
            <div>
              <p className="eyebrow">Storage connection</p>
              <h2>Dashboard data is temporarily unavailable.</h2>
              <p>Configure PostgreSQL and run the production migration before relying on lead and assessment reporting.</p>
            </div>
            <span className="status-pill missing">Action required</span>
          </section>
        ) : null}
        <AdminDashboardTabs
          advisories={<AdvisoryManagementPanel initialAdvisories={advisories} />}
          badges={{
            advisories: advisories.length,
            content: contentPosts.length,
            distribution: distributionSnapshot?.linkedin.connected ? "Live" : "Check",
            overview: snapshot.totals.leads,
            verifygrid: verifyGridAccess.state === "unlocked" ? "Ready" : "Locked"
          }}
          content={<ContentRadarPanel initialPosts={contentPosts} />}
          distribution={<DistributionControlPanel initialSnapshot={distributionSnapshot} />}
          overview={<OperatorDashboard snapshot={snapshot} />}
          verifygrid={verifyGridAccess.state === "unlocked" ? (
            <>
              <VerifyGridOnboardingQueue />
              <VerifyGridControlPanel initialPortfolio={verifyGridPortfolio} />
            </>
          ) : (
            <VerifyGridAccessGate access={verifyGridAccess} email={session.email} />
          )}
        />
      </section>
    </main>
  );
}
