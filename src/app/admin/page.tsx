import type { Metadata } from "next";
import Image from "next/image";
import { LogOut, ShieldCheck } from "lucide-react";
import { AdminDashboardTabs } from "@/components/admin-dashboard-tabs";
import { ContentRadarPanel } from "@/components/content-radar-panel";
import { OperatorDashboard } from "@/components/operator-dashboard";
import { requireAdmin } from "@/lib/admin-auth";
import { requestContext } from "@/lib/security";
import { createAuditLog, getDashboardSnapshot } from "@/lib/store";
import { listContentPosts } from "@/lib/content-posts";
import { DistributionControlPanel } from "@/components/distribution-control-panel";
import { getDistributionSnapshot } from "@/lib/distribution";
import { AdvisoryManagementPanel } from "@/components/advisory-management-panel";
import { listAdminSecurityAdvisories } from "@/lib/advisories";
import { VerifyGridControlPanel } from "@/components/verifygrid-control-panel";
import { VerifyGridOnboardingQueue } from "@/components/verifygrid-onboarding-queue";
import { getVerifyGridPortfolio } from "@/lib/verifygrid";
import { VerifyGridAccessGate } from "@/components/verifygrid-access-gate";
import { VerifyGridSecurityBar } from "@/components/verifygrid-security-bar";
import { getVerifyGridAccessState } from "@/lib/verifygrid-operator-auth";
import { CcnaLearningDesk } from "@/components/ccna-learning-desk";
import { listCcnaLessons } from "@/lib/ccna-learning";
import { loadSection } from "@/lib/section-availability";
import { SectionUnavailable } from "@/components/section-unavailable";

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
  const [dashboard, content, distribution, advisory, access, learning] = await Promise.all([
    loadSection("Dashboard", getDashboardSnapshot),
    loadSection("Content Studio", listContentPosts),
    loadSection("Distribution", getDistributionSnapshot),
    loadSection("Advisory management", listAdminSecurityAdvisories),
    loadSection("VerifyGrid access", () => getVerifyGridAccessState(session.email)),
    loadSection("CCNA Learning Desk", listCcnaLessons)
  ]);
  const verifyGridAccess = access.data;
  const portfolio = verifyGridAccess?.state === "unlocked"
    ? await loadSection("VerifyGrid portfolio", getVerifyGridPortfolio) : null;
  const storageUnavailable = [dashboard, content, distribution, advisory, access, learning].some((result) => !result.available) || portfolio?.available === false;

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
              <h2>Some dashboard services are unavailable.</h2>
              <p>Check database capacity and connectivity. Unavailable tabs show their status instead of empty records. Available modules remain accessible.</p>
            </div>
            <span className="status-pill missing">Action required</span>
          </section>
        ) : null}
        <AdminDashboardTabs
          advisories={advisory.available ? <AdvisoryManagementPanel initialAdvisories={advisory.data} /> : <SectionUnavailable admin title="Advisory management" />}
          badges={{
            advisories: advisory.available ? advisory.data.length : "Unavailable",
            content: content.available ? content.data.length : "Unavailable",
            distribution: distribution.available ? distribution.data.linkedin.connected ? "Connected" : "Check" : "Unavailable",
            learning: learning.available ? learning.data.filter((lesson) => lesson.status === "published").length : "Unavailable",
            overview: dashboard.available ? dashboard.data.totals.leads : "Unavailable",
            verifygrid: !access.available || portfolio?.available === false ? "Unavailable" : verifyGridAccess?.state === "unlocked" ? "Ready" : "Locked"
          }}
          content={content.available ? <ContentRadarPanel initialPosts={content.data} /> : <SectionUnavailable admin title="Content Studio" />}
          distribution={distribution.available ? <DistributionControlPanel initialSnapshot={distribution.data} /> : <SectionUnavailable admin title="Distribution" />}
          learning={learning.available ? <CcnaLearningDesk initialLessons={learning.data} /> : <SectionUnavailable admin title="CCNA Learning Desk" />}
          overview={dashboard.available ? <OperatorDashboard snapshot={dashboard.data} /> : <SectionUnavailable admin title="Dashboard data" />}
          verifygrid={!verifyGridAccess || portfolio?.available === false ? <SectionUnavailable admin title="VerifyGrid" /> : verifyGridAccess.state === "unlocked" && portfolio?.available ? (
            <>
              <VerifyGridSecurityBar access={verifyGridAccess} />
              <VerifyGridOnboardingQueue />
              <VerifyGridControlPanel access={verifyGridAccess.operator} initialPortfolio={portfolio.data} />
            </>
          ) : (
            <VerifyGridAccessGate access={verifyGridAccess} email={session.email} />
          )}
        />
      </section>
    </main>
  );
}
