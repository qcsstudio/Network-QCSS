import React from 'react'
import Wrapper from '@/layouts/Wrapper';
import FooterOne from '@/layouts/footers/FooterOne';
import HeaderOne from '@/layouts/headers/HeaderOne';
import BannerAbout from '@/components/brand/BannerAbout';
import VideoHomeOne from '@/components/video/VideoHomeOne';
import FeatureHomeTwo from "@/components/feature/FeatureHomeTwo";
import Service from "@/components/service/Service";
import ServiceHomeTwo from '@/components/service/ServiceHomeTwo';
import BrandHomeOne from "@/components/brand/BrandHomeOne";
import Testimonial from "@/components/testimonial/Testimonial";
import AboutUs from "@/components/about/AboutUs";


import { featureData } from "@/data/featureData";

const page = () => {
  return (
    <>
      <Wrapper>
        <HeaderOne />
        <div id="smooth-wrapper">
          <div id="smooth-content">
            <main>

              <BannerAbout />
              <VideoHomeOne style_2={true} />
              <FeatureHomeTwo feature_data={featureData} />
              {/* <Service /> */}
              <ServiceHomeTwo />
              <BrandHomeOne style_2={false} />
              <Testimonial />
              <AboutUs />
            </main>
            <FooterOne />
          </div>
        </div>
      </Wrapper>
    </>
  )
}

export default page