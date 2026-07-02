
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import banner_img from '@/assets/img/service_details_banner.jpg';


interface DataType {
  title: string;
  description: string;
  features: string[];
}
const hero_contact: DataType = {
  title: `If You’re on LinkedIn for Attention, We’re Not for You.
 If You’re Here for Revenue — Welcome.`,
  description: `QCS partners with high-ticket B2B founders to build a LinkedIn Sales Engine that delivers qualified sales conversations month after month — with the precision, consistency, and rigor of an elite consulting firm.`,
  features: [
    `We don’t run campaigns.`,
    `We engineer outcomes`,
    ` For a very limited number of clients.`,
  ]
}
const { title, description, features } = hero_contact

const HeroServiceDetails = () => {
  return (
    <>
      <div className="cs_height_219 cs_height_lg_120"></div> 
      <section>
        <div className="container">
          <div className="cs_section_heading cs_style_1 cs_type_1">
            <div className="cs_section_heading_text">
              <h2 className="cs_section_title anim_text_writting">
                 {title}
              </h2>
            </div>
          </div>
          <div className="cs_height_100 cs_height_lg_60"></div>
          <div className="cs_service_details">
            <div className="cs_service_details_img">
              <div className="cs_style_img">
                <Image src={banner_img} alt="service_details_banner" />
              </div>
            </div>
            <div className="cs_service_details_text ">
              <div className="cs_service_details_p ">
                <p className="anim_text">{description}</p>
                <ul className="anim_div_ShowDowns">
                  {features.map((item, i) => (
                    <li key={i}>{item}</li>                    
                  ))} 
                </ul>
              </div>
              <Link href='/linkedin-profile-audit' className='rounded-3 p-2 border-none outline-none d-inline-block'>Start With a LinkedIn Profile Audit</Link>
            </div>
          </div>
        </div>
      </section> 
    </>
  );
};

export default HeroServiceDetails;