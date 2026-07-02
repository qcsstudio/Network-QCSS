'use client'
import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation, Pagination } from 'swiper/modules';

interface DataType {
  img: string;
  sub_title: string;
  title: string;
  des: string;
}[]

const about_slider: DataType[] = [
  {
    // img: "/assets/img/about_img.jpg", SAME ALL THREE
    img: "/assets/img/Images/about_img_1.png",
    sub_title: "Our Vision",
    title: `Engineer Clarity <br> Unify Workflows <br> Compound Growth`,
    des: `We imagine growth as everyday reality, not a campaign spike. By unifying tools, data, and teams into one system, work moves faster and cleaner. Agents handle the busywork, people handle decisions—and every week’s learning compounds.`,
  },
  {
    img: "/assets/img/Images/about_img_2.png",
    sub_title: "Our Mission",
    title: `Design Once <br> Run Everywhere <br> Measure What Matters`,
    des: ` We turn scattered tools into a governed operating model. Agents execute, apps scale, and marketing self-optimizes while dashboards tie effort to revenue. Teams get fewer handoffs, clearer accountability, and confident, repeatable ROI.`,
  },
  {
    img: "/assets/img/Images/about_img_3.png",
    sub_title: "Our Principle",
    title: `Build Once <br> Make It Smarter <br> Every Week`,
    des: ` We replace fragile, one-off tactics with systems that learn. We design agentic AI, craft high-performance apps, and run AI-powered marketing as one operating model—so your best week becomes the baseline.`,
  },
]

const AboutHomeOne = () => {
  return (
    <>
      <div className="cs_height_130 cs_height_lg_60"></div>
      <Swiper
        loop={true}
        speed={1000}
        modules={[Navigation, Pagination, Autoplay]}
         autoplay={{
                        delay: 5000,
                        disableOnInteraction: false,
                    }}
        navigation={{
          nextEl: ".cs_swiper_button_next",
          prevEl: ".cs_swiper_button_prev",
        }}
        pagination={{
          el: ".cs_pagination",
          clickable: true,
          type: "fraction",

          renderFraction: function (currentClass, totalClass) {
            return `<span class="${currentClass}"></span> 
             ${' / '}
             <span class="${totalClass}"></span>`;
          },

        }}
        className="cs_slider cs_slider_2">
        {about_slider.map((item, index) => (
          <SwiperSlide key={index} className="swiper-slide">
            <div className="cs_about cs_style_1">
              <div className="cs_about_bg cs_bg" style={{ backgroundImage: `url(${item.img})` }}></div>
              <div className="container">
                <div className="cs_about_text">
                  <div className="cs_section_heading cs_style_1">
                    <div className="cs_section_heading_text">
                      <div className="cs_section_subtitle">{item.sub_title}</div>
                      {/* <h2 className="cs_section_title">
                        {item.title}
                      </h2> */}

                      {/* <h2
                        className="cs_section_title"
                        dangerouslySetInnerHTML={{ __html: item.title }}
                      /> */}
                      <h2 className="cs_section_title" dangerouslySetInnerHTML={{ __html: item.title }} />
                    </div>
                  </div>
                  <div className="cs_height_40 cs_height_lg_30"></div>
                  <p className="cs_m0">
                    {item.des}
                  </p>
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}

        <div className="container">
          <div className="cs_swiper_controll">
            <div className="cs_pagination cs_style2 cs_primary_font"></div>
            <div className="cs_swiper_navigation_wrap">

              <div style={{ cursor: 'pointer' }} className="cs_swiper_button_prev">
                <svg width="82" height="24" viewBox="0 0 82 24" fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path d="M82 1H2L24 23" stroke="currentColor" />
                </svg>
              </div>
              <div style={{ cursor: 'pointer' }} className="cs_swiper_button_next">
                <svg width="82" height="24" viewBox="0 0 82 24" fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path d="M0 23H80L58 1" stroke="currentColor" />
                </svg>
              </div>

            </div>
          </div>
        </div>
      </Swiper>
    </>
  );
};

export default AboutHomeOne;