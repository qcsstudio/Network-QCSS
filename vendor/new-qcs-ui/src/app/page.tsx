
import AboutUs from "@/components/about/AboutUs";
import AwardsHomeOne from "@/components/awards/AwardsHomeOne";
import BlogHomeOne from "@/components/blog/BlogHomeOne";
import BrandHomeOne from "@/components/brand/BrandHomeOne";
import FeatureHomeTwo from "@/components/feature/FeatureHomeTwo";
import HeroHomeTwo from "@/components/hero/HeroHomeTwo";
import InnovativeHomeTwo from "@/components/innovative/InnovativeHomeTwo";
import PortfolioHomeOne from "@/components/portfolio/PortfolioHomeOne";
import ServiceHomeOne from "@/components/service/ServiceHomeOne";
import Testimonial from "@/components/testimonial/Testimonial";
import VideoHomeTwo from "@/components/video/VideoHomeTwo";
import FooterOne from "@/layouts/footers/FooterOne";
import HeaderOne from "@/layouts/headers/HeaderOne";
import Wrapper from "@/layouts/Wrapper";
import { featureData } from "@/data/featureData";
import ServiceAreaDetails from "@/components/service/ServiceAreaDetails";
import {  innovative_data_home } from "@/data/innovation_homeTwo";
import img from "@/assets/img/Images/growth.png";
import {service_data_home} from "@/data/serviceArea_detail";




export const metadata = {
  title: "AI Growth & Marketing Automation Services",
  description: "Transform growth with agentic AI, AI SEO, performance ads, chatbots, and automation—built to improve revenue, pipeline velocity, and operational efficiency.",
  verification: {
    google: "MbqWeyYPvPzsogXFxsL8o_LZUqhL-lqb0C6-EeSNemM",
  },
};

const index = () => {

  return (
    <Wrapper>
      <HeaderOne />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <main>
            <HeroHomeTwo />
            <VideoHomeTwo />
            <InnovativeHomeTwo data={innovative_data_home} image={img}/>
            <ServiceHomeOne/>
            <ServiceAreaDetails data={service_data_home} para={false} heading="Our Working Process"/>
            {/* <Service data={service_data}/> */}
            <FeatureHomeTwo feature_data={featureData}/>
            <PortfolioHomeOne />
            <Testimonial />
            <BrandHomeOne style_2={false} />
            <AwardsHomeOne />
            <BlogHomeOne />
            <AboutUs />
          </main>
          <FooterOne />
        </div>
      </div>
    </Wrapper>
  );
};

export default index;
