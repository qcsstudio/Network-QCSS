
import React from 'react';
import Image from 'next/image';
import logo from '@/assets/img/Images/favicon.png';

const BannerAbout = () => {
  return (
    <>
      <div className="cs_height_219 cs_height_lg_120"></div>
      <section>
        <div className="container">
          <div className="cs_section_heading cs_style_1 cs_type_1">
            <div className="cs_section_heading_text">
              <h1 className="cs_section_title anim_text_writting">
                How Our Agency is Transforming <br /> Businesses and Brands through <br /> Online Solutions
              </h1>
            </div>
            <div className="cs_section_heading_right ">
              <div className="cs_animated_badge ">
                <div className="rounded_text rotating ">
                  <svg viewBox="0 0 200 200">
                    <path
                      id="textPath"
                      d="M100,100 m-80,0 a 80,80 0 1,1 160,0 a 80,80 0 1,1 -160,0"
                      fill="none"
                    />


                    <text fontSize="17">
                      <textPath href="#textPath" startOffset="0%">
                        QuantumCrafters Studio • QuantumCrafters Studio •
                      </textPath>
                    </text>

                  </svg>
                </div>

                <div className="position-absolute cs_ceneter_text">
                  <Image src={logo} alt="textPath-logo" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
export default BannerAbout;