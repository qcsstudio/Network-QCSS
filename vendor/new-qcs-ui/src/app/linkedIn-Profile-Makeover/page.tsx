import HeroServiceDetails from '@/components/hero/HeroServiceDetails';
import Wrapper from '@/layouts/Wrapper';
import FooterOne from '@/layouts/footers/FooterOne';
import HeaderOne from '@/layouts/headers/HeaderOne';
import HeroHomeThree from '@/components/hero/HeroHomeThree';
import LinkedInSalesEngineLanding from '@/components/service/LinkedInSalesEngineLanding';

export const metadata = {
  title: "Done-for-You LinkedIn Sales & Outbound Engine | QCS",
  description: "Build a managed LinkedIn outbound engine with positioning, profile conversion, prospect intelligence, manual outreach, follow-ups, and weekly optimization by QuantumCrafters."
 
};


const index = () => {
  return (
    <Wrapper>
      <HeaderOne />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <main>
            <HeroHomeThree />
            <HeroServiceDetails />
            <LinkedInSalesEngineLanding />
          </main>
          <FooterOne />
        </div>
      </div>
    </Wrapper>
  );
};

export default index;
