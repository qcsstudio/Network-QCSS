'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface FaqItemType {
  id: string;
  question: string;
  answer: string;

  title?: string;
  description: string;
  features: string[];
}

interface DataType {
  faq_data: FaqItemType[];
}

const service_faq_content: DataType = {
  faq_data: [
    {
      id: 'One',
      question: `Positioning Architecture (Differentiation That Sticks)`,
      answer: `We rebuild your entire narrative so prospects immediately understand:`,

      title: "why you’re relevant, why you’re superior, why now.",
      description: "Deliverables:",
      features: ["Value Proposition Redesign", "Founder / Brand Positioning System", "Conversion-Optimized LinkedIn Profile", "Authority Layer Assets", "Offer & Message Calibration"],
    },

    {
      id: 'Two',
      question: `Prospect Intelligence (Precision Targeting)`,
      answer: `You don’t need more leads.
                You need the right decision-makers, identified with consulting-level rigor.`,

      // title: "Prospect Intelligence Title",
      description: "We map:",
      features: ["Buyer roles", "Org structures", "Industry patterns","Trigger events","Intent signals"],
    },

    {
      id: 'Three',
      question: `High-Impact Messaging (Response Psychology)`,
      answer: `We design messaging frameworks that cut through noise and create movement.`,

      title: "High-Impact Messaging Title",
      description: "Components",
      features: ["Multi-step conversation pathways", "Personalized outreach sequences","Warm-up engagement scripts","Re-engagement flows","Objection pre-handling structures"],
    },

    {
      id: 'Four',
      question: `Manual Outbound Execution (White-Glove)`,
      answer: `Every touchpoint is controlled, intentional, and conversion-driven.`,

      title: "Manual Outbound Execution Title",
      description: "Description for Manual Outbound Execution",
      features: ["No bots.", " No mass blast.", "No automation footprints."],
    },

    {
      id: 'Five',
      question: `Weekly Optimization (Performance Governance)`,
      answer: `This is where elites separate from amateurs.`,

      // title: "Weekly Optimization Title",
      description: "We run:",
      features: ["Weekly data reviews", "Message refinement","Prospect refresh cycles","Conversion pattern analysis","Strategic improvements"],
    },

    {
      id: 'Six',
      question: `Pipeline Visibility (Executive Reporting)`,
      answer: `No vanity metrics`,

      // title: "Pipeline Visibility Title",
      description: "Only numbers that matter:",
      features: ["Acceptance rate", "Response rate", "Conversation rate","Conversation rate","Booked calls","Cost of acquisition","Revenue impact"],
    },
  ],
};

const ServiceDetailsFaq = () => {
  const { faq_data } = service_faq_content;

  // 👉 Default: first item open
  const [activeIndex, setActiveIndex] = useState<number | null>(0);

  // 👉 Proper toggle
  const toggleAccordion = (index: number) => {
    setActiveIndex((prev) => (prev === index ? null : index));
  };

  // 👉 Show default (0) content IF everything is closed
  const activeData =
    activeIndex !== null ? faq_data[activeIndex] : faq_data[0];

  return (
    <>
      <div className="cs_height_150 cs_height_lg_60"></div>

      <div className="container">
        <div className="cs_service_details cs_type_2">

          {/* LEFT SIDE - FAQ */}
          <div className="cs_service_details_img">
            <div className="cs_accordeon">
              {faq_data.map((item, i) => (
                <div
                  key={i}
                  onClick={() => toggleAccordion(i)}
                  className={`cs_accordion_item ${i === activeIndex ? 'active cs_icon' : ''
                    }`}
                >
                  <div className="cs_accordion_header">
                    <p className="cs_accordion_title cs_m0" id={`heading${item.id}`}>
                      {item.question}
                    </p>

                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 25 25"
                      width="30"
                      style={{
                        transform: i === activeIndex ? 'rotate(-90deg)' : 'none',
                      }}
                    >
                      <path
                        d="m17.5 5.999-.707.707 5.293 5.293H1v1h21.086l-5.294 5.295.707.707L24 12.499l-6.5-6.5z"
                        data-name="Right"
                      />
                    </svg>
                  </div>

                  <div className={`cs_accordion_body ${i === activeIndex ? '' : 'd-none'}`}>
                    {item.answer}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT SIDE - Dynamic Content */}
          <div className="cs_service_details_text justify-content-center d-flex flex-column ">
            <div className="cs_specialization cs_section_heading cs_style_1">
              <div className="cs_section_heading_text">
                <h4 className="cs_section_title_4">{activeData.title}</h4>
              </div>

              <p>{activeData.description}</p>

              <ul>
                {activeData.features.map((feature, i) => (
                  <li key={i}>{feature}</li>
                ))}
              </ul>

              <Link href="/linkedin-profile-audit" className="cs_btn cs_style_1 cs_color_1 mt-3 d-inline-flex">
                <span>Check My Profile Score First</span>
              </Link>
            </div>

            {/* <div className="cs_back_to_services_btn">
              <a href="#" className="cs_style_1">
                <span>Back To Services Page</span>
                <svg
                  width="19"
                  height="13"
                  viewBox="0 0 19 13"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18.5303 7.03033C18.8232 6.73744 18.8232 6.26256 18.5303 5.96967L13.7574 1.1967C13.4645 0.903806 12.9896 0.903806 12.6967 1.1967C12.4038 1.48959 12.4038 1.96447 12.6967 2.25736L16.9393 6.5L12.6967 10.7426C12.4038 11.0355 12.4038 11.5104 12.6967 11.8033C12.9896 12.0962 13.4645 12.0962 13.7574 11.8033L18.5303 7.03033ZM0 7.25H18V5.75H0V7.25Z"
                    fill="currentColor"
                  ></path>
                </svg>
              </a>
            </div> */}
          </div>

        </div>
      </div>
    </>
  );
};

export default ServiceDetailsFaq;
