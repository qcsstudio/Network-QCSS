
import React from 'react';

// interface DataType {
//   id: string;
//   title: string;
//   description: string;
// }
// const service_data: DataType[] = [
//   {
//     id: 'one',
//     title: "Executive Strategy Session",
//     description: `We diagnose gaps. Present growth scenarios. Define your dominance angle.`,
//   },
//   {
//     id: 'Two',
//     title: "Engine Build (7–10 Days)",
//     description: `Positioning → Messaging → Targeting → System Setup`,
//   },
//   {
//     id: 'Three',
//     title: "Controlled Outbound",
//     description: `Daily manual outbound. Controlled volumes. High-quality conversations.`,
//   },
//   {
//     id: 'Four',
//     title: "Optimization Cycles",
//     description: `Weekly refinement until predictable call flow is achieved.`,
//   },
// ]


const ServiceAreaDetails = ({data,para,heading}) => {
  return (
    <>
      <div className="cs_height_150 cs_height_lg_50"></div>
      <section>
        <div className="container">

          {heading &&
           <div className="cs_section_heading_hr cs_style_1 cs_color_1 mb-5">
              <div className="cs_hr_design"></div>
              <div className="cs_section_heading cs_style_1 cs_color_1">
                <div className="cs_section_heading_text">
                  <h2 className="cs_section_title anim_heading_title text-black">
                    {heading}
                  </h2>
                </div>
              </div>
              <div className="cs_hr_design"></div>
            </div>}
         
            {para &&
             <div className="cs_work cs_work_text">
            <h4 className="anim_heading_title">
              Specialization & Working Process
            </h4>
            <p className="cs_mp0 anim_text">
              We build the LinkedIn sales engine end-to-end: positioning, profile conversion, prospect intelligence,
              outbound messaging, controlled manual execution, and weekly optimization until sales conversations become predictable.
            </p>
          </div>}
          {/* <div className="cs_work cs_work_text">
            <h4 className="anim_heading_title">
              Specialization & Working Process
            </h4>
            <p className="cs_mp0 anim_text">
              We build the LinkedIn sales engine end-to-end: positioning, profile conversion, prospect intelligence,
              outbound messaging, controlled manual execution, and weekly optimization until sales conversations become predictable.
            </p>
          </div> */}
          <div className="cs_height_80 cs_height_lg_40"></div>
          <div>
            <div className="cs_work cs_work_1">
              <div className="cs_card_work cs_style_1">
                {data.map((item, i) => (
                  <div key={i} className="cs_card cs_mt_nthchild_0 anim_div_ShowLeftSide">
                    <div className="cs_card cs_style_1">
                      <div className="cs_posagation">
                        <div className="cs_work_style_1"></div>
                        <div className="cs_work_style_2"></div>
                      </div>
                      <div className="cs_stroke_number">
                        <span>{item.id}</span>
                      </div>
                    </div>

                    <h6 className="cs_work_title">{item.title}</h6>
                    <p className="cs_work_subtitle">
                      {item.description}
                    </p>
                  </div>
                ))}

              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default ServiceAreaDetails;