import React from 'react'
import Wrapper from '@/layouts/Wrapper';
import FooterOne from '@/layouts/footers/FooterOne';
import HeaderOne from '@/layouts/headers/HeaderOne';
import BannerAbout from '@/components/brand/BannerAbout';
import VideoHomeOne from '@/components/video/VideoHomeOne';
import FeatureHomeTwo from "@/components/feature/FeatureHomeTwo";
import Service from "@/components/service/Service";
import BrandHomeOne from "@/components/brand/BrandHomeOne";
import Testimonial from "@/components/testimonial/Testimonial";
import BlogHomeOne from "@/components/blog/BlogHomeOne";
import AboutUs from "@/components/about/AboutUs";


import { featureData } from "@/data/featureData";

const WebDevelopment = () => {
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
                  <BrandHomeOne style_2={false} />
                             <BlogHomeOne />
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

export default WebDevelopment