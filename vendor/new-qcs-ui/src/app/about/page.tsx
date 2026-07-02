import About from '@/components/about/About';
import AwardsHomeOne from '@/components/awards/AwardsHomeOne';
import BannerAbout from '@/components/brand/BannerAbout';
import BrandHomeOne from '@/components/brand/BrandHomeOne';
import FunFactHomeOne from '@/components/funfact/FunFactHomeOne';
import Gellary from '@/components/gellary/Gellary';
import TeamHomeTwo from '@/components/team/TeamHomeTwo';
import Testimonial from '@/components/testimonial/Testimonial';
import VideoHomeOne from '@/components/video/VideoHomeOne';
import Wrapper from '@/layouts/Wrapper';
import FooterOne from '@/layouts/footers/FooterOne';
import HeaderOne from '@/layouts/headers/HeaderOne';
import AboutHomeOne from '@/components/about/AboutHomeOne';
import ServiceHomeFive from '@/components/service/ServiceHomeFive';

export const metadata = {
  title: "About QuantumCrafters - AI Growth, Automation & Marketing",
  description: "Learn how QuantumCrafters blends strategic thinking with AI-driven growth, automation, and marketing to help brands scale faster and smarter."
 
};

const index = () => {

  return (
    <Wrapper>
      <HeaderOne />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <main>
            <BannerAbout />
            <VideoHomeOne style_2={true} />
            <About />
            <AboutHomeOne />
            {/* <TeamHomeTwo style_2={true} style_3={true} /> */}
            {/* <FunFactHomeOne style_3={true} /> */}

            <AwardsHomeOne style_2={true} />
            <BrandHomeOne />
            <ServiceHomeFive />
            {/* <Testimonial /> */}
            <Gellary style_2={true} />

          </main>
          <FooterOne />
        </div>
      </div>

    </Wrapper>
  );
};

export default index;
