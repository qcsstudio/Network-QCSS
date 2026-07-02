'use client'
import React from 'react';
import Link from 'next/link';
import Image, { StaticImageData } from 'next/image';

import { Swiper, SwiperSlide } from "swiper/react";

import portfolio_img_1 from '@/assets/img/Images/download1.png';
import portfolio_img_2 from '@/assets/img/Images/download2.png';
import portfolio_img_3 from '@/assets/img/Images/download3.png';
import portfolio_img_4 from '@/assets/img/Images/download4.png';
import portfolio_img_5 from '@/assets/img/Images/download5.png';

interface DataType {
  img: StaticImageData;
  title: string;
  category: string;
}[]

const portfolio_slider: DataType[] = [
  {
    img: portfolio_img_1,
    title: ` ElevatrX `,
    category: `AI social media planning, scheduling, analytics—turn posts into measurable growth.`,
  },
  {
    img: portfolio_img_2,
    title: `QCS HRMS`,
    category: `All-in-one HR, payroll, attendance, hiring—run workforce operations seamlessly.`,
  },
  {
    img: portfolio_img_3,
    title: `LinkedIn Profile Analyzer`,
    category: ` Scores profiles, finds conversion gaps, generates fixes to boost leads.`,
  },
  {
    img: portfolio_img_4,
    title: ` QCS Voice & Chat Bot`,
    category: `24/7 voice+chat assistant for support, qualification, and smart handoffs.`,
  },
  {
    img: portfolio_img_5,
    title: `Agentic AI Help Desk Automation`,
    category: `Agents triage, resolve, escalate tickets end-to-end with governed automation.`,
  },
  // {
  //   img: portfolio_img_3,
  //   title: `Project Task Management`,
  //   category: `Digital Services / Figma Design`,
  // },
]


const PortfolioHomeOne = () => {
  return (
    <>
      <div className="cs_horizontal_scroll_wrap">
        <div className="cs_height_145 cs_height_lg_60"></div>
        <div className="container">
          <div className="cs_section_heading cs_style_1 cs_type_2">
            <div className="cs_section_heading_text">
              <div className="cs_section_subtitle anim_div_ShowZoom">
                Portfolio
              </div>
              <h2 className="cs_section_title anim_heading_title">
                Some Recent Project We Successfully Done
              </h2>
            </div>
          </div>
          <div className="cs_height_100 cs_height_lg_60"></div>
        </div>
        <Swiper
          loop={true}
          speed={1000}
          slidesPerView="auto" 
          pagination={{
            el: ".cs_pagination",
            clickable: true,
          }}
          className="cs_horizontal_scrolls anim_div_ShowDowns">
          {portfolio_slider.map((item, i) =>
            <SwiperSlide key={i} className="swiper-slide">
              <div className="cs_horizontal_scroll">
                <Link href="/portfolio-details" className="cs_portfolio cs_style_1">
                  <div className="cs_portfolio_img">
                    <Image src={item.img} alt="Thumb" />
                  </div>
                  <div className="cs_portfolio_overlay"></div>
                  <div className="cs_portfolio_info">
                    <h2 className="cs_portfolio_title">
                      {item.title}
                    </h2>
                    <div className="cs_portfolio_subtitle">
                      {item.category}
                    </div>
                  </div>
                </Link>
              </div>
            </SwiperSlide>
          )} 

        </Swiper>
      </div>
      <div className="cs_height_145 cs_height_lg_60"></div>
    </>
  );
};

export default PortfolioHomeOne;