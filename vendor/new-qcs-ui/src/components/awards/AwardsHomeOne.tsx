'use client'
import React, { useState } from 'react';
import award_img_1 from "@/assets/img/award_1.svg";
import award_img_2 from "@/assets/img/award_2.svg";
import award_img_3 from "@/assets/img/award_3.svg";

import award_thumb_1 from "@/assets/img/Images/DPIIT.png";
import award_thumb_2 from "@/assets/img/Images/Google.png";
import award_thumb_3 from "@/assets/img/Images/MBP.png";
import Image, { StaticImageData } from 'next/image';


interface DataType {
  id: number;
  ward_img: any;
  img: StaticImageData;
  brand: string;
  title: string;
  des: string;
}[]

const award_data: DataType[] = [
  {
    id: 1,
    ward_img: award_img_1,
    img: award_thumb_1,
    brand: `DPIIT Startup India`,
    title: `Start Up India Recognised`,
    des: `Government recognition by DPIIT for eligible startups—unlocking benefits, faster compliance, and added credibility for Indian and global buyers.`,
  },
  {
    id: 2,
    ward_img: award_img_2,
    img: award_thumb_2,
    brand: ` Google Partner`,
    title: `Google Partner (Ads)`,
    des: `Meets Google’s badge thresholds for performance, spend, and certified experts—evidence of accountable, ROI-driven campaign management.`,
  },
  {
    id: 3,
    ward_img: award_img_3,
    img: award_thumb_3,
    brand: ` Meta Business Partner`,
    title: ` Meta Business Partner`,
    des: `Recognised capability across Facebook & Instagram. Strong signal for paid social + lead gen systems that scale with governance. `,
  },
]

const AwardsHomeOne = ({ style_2 }: any) => {

  const [activeTab, setActiveTab] = useState(0);
  const handleMouseEnter = (index: any) => {
    setActiveTab(index);
  };

  return (
    <>
      {style_2 ? <div className="cs_height_145 cs_height_lg_60"></div> : null}
      <section>
        <div className="container">
          <div className="cs_section_heading cs_style_1 cs_type_1 swiper-slide swiper-slide-active">
            <div className="cs_section_heading_text">
              <div className="cs_section_subtitle anim_div_ShowZoom">
                Our Awards
              </div>
              <h2 className="cs_section_title anim_heading_title">
                Recognitions That Buyers Trust
              </h2>
            </div>
          </div>
          <div className="cs_height_100 cs_height_lg_60"></div>
          <div className="cs_card_2_list">
            {award_data.map((item, i) =>
              <div key={i}
                onMouseEnter={() => handleMouseEnter(i)}
                className={`cs_card cs_style_2 cs_hover_tab anim_div_ShowDowns ${activeTab === i ? 'active' : ''}`}>
                <div className="cs_card_left">
                  <div className="cs_card_logo">
                    <Image src={item.ward_img} alt="Award" />
                  </div>
                  <div>
                    <h2 className="cs_card_title">{item.title}</h2>
                    <div className="cs_card_subtitle">
                      {item.des}
                    </div>
                  </div>
                </div>
                <div className="cs_card_right">
                  <h2 className="cs_card_brand">{item.brand}</h2>
                </div>
                <div className="cs_card_hover_img">
                  <Image src={item.img} alt="certificates" />
                </div>
              </div>
            )}

          </div>
        </div>
      </section>
      <div className="cs_height_145 cs_height_lg_60"></div>
    </>
  );
};

export default AwardsHomeOne;