
import AboutHomeFour from '@/components/about/AboutHomeFour';
import BlogArea from '@/components/blog/BlogArea';
import Wrapper from '@/layouts/Wrapper';
import FooterOne from '@/layouts/footers/FooterOne';
import HeaderOne from '@/layouts/headers/HeaderOne';

export const metadata = {
  title: "Digital Marketing & AI SEO Insights Blog",
  description: "Explore expert insights on SEO, GEO, AI marketing, LinkedIn growth, and lead generation. Learn what works in 2026 with QuantumCrafters."
};

const index = () => {
  return (
    <Wrapper>
      <HeaderOne />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <main>
            <BlogArea />
            <AboutHomeFour />
          </main>
          <FooterOne />
        </div>
      </div>
    </Wrapper>
  );
};

export default index;
