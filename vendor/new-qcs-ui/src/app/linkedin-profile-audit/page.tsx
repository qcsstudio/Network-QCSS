import AuditSection from '@/components/service/AuditSection';
import Wrapper from '@/layouts/Wrapper';
import FooterOne from '@/layouts/footers/FooterOne';
import HeaderOne from '@/layouts/headers/HeaderOne';

export const metadata = {
  title: "LinkedIn Profile Audit | QCS",
  description: "Run a role-based LinkedIn profile audit, see your score, and unlock a paid profile rewrite designed to reach a 100% QCS profile score.",
};

const LinkedInProfileAuditPage = () => {
  return (
    <Wrapper>
      <HeaderOne />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <main>
            <div className="cs_height_120 cs_height_lg_80"></div>
            <AuditSection />
            <div className="cs_height_120 cs_height_lg_80"></div>
          </main>
          <FooterOne />
        </div>
      </div>
    </Wrapper>
  );
};

export default LinkedInProfileAuditPage;
