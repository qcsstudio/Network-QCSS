"use client";

import Image from "next/image";
import React from "react";
import Link from "next/link";

const boxStyle: React.CSSProperties = {
  width: "100px",
  height: "100px",
  // background: "#888",
  // marginBottom: "20px",
};

const cardStyle: React.CSSProperties = {
  background: "#101010",
  color: "#000",
};

export default function PipelineSection() {
  return (
    <section className="py-5 my-5" style={{ background: "#101010", color: "#fff" }}>
      <div className="container">
        {/* Heading */}
        <h2 className="fw-bold mb-2 text-white">
          The Market Has Changed. Most Founders Haven’t.
        </h2>

        <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 mb-4">
          <p className="text-white mb-0" style={{ fontSize: "14px" }}>
            This is not marketing.{" "}
            <span className="text-white">This is Growth Engineering.</span>
          </p>
          <Link href="/linkedin-profile-audit" className="cs_btn cs_style_1 cs_color_1">
            <span>Audit Your LinkedIn Before We Build</span>
          </Link>
        </div>

        <div className="row g-2">
          {/* Old Model */}
          <div className="col-md-6 ">
            <div className="p-4 rounded pipeline-box" style={cardStyle}>
              {/* Grey Box */}
              <div style={boxStyle}>
                <Image
                  src="/assets/img/Images/Old Model.png"
                  alt="Old-Model"
                  width={100}
                  height={100}
                />  
              </div>

              <h5 className="fw-bold text-white mt-5">The Old Model</h5>
              <hr />

              <ul style={{ lineHeight: "1.8", color: "#ffffff" ,marginTop:"10px",listStyle:"none" ,padding:"0"}}>
                <li style={{display:"flex",gap:"10px"}}> <Image src="/assets/img/Images/button-icon-list.svg" alt="list-mark1" width={12} height={12} /> <span>Post-often</span></li>
                <li style={{display:"flex",gap:"10px"}}> <Image src="/assets/img/Images/button-icon-list.svg" alt="list-mark2" width={12} height={12} /> <span>Hope buyers notice </span></li>
                <li style={{display:"flex",gap:"10px"}}> <Image src="/assets/img/Images/button-icon-list.svg" alt="list-mark3" width={12} height={12} /> <span>Send polite DMs </span></li>
                <li style={{display:"flex",gap:"10px"}}> <Image src="/assets/img/Images/button-icon-list.svg" alt="list-mark4" width={12} height={12} /> <span>Outsource to content agencies </span></li>
                <li style={{display:"flex",gap:"10px"}}> <Image src="/assets/img/Images/button-icon-list.svg" alt="list-mark5" width={12} height={12} /> <span>Wait for leads to appear </span></li>
              </ul>
            </div>
          </div>

          {/* New Model */}
          <div className="col-md-6 ">
            <div className="p-4 rounded pipeline-box" style={cardStyle}>
              {/* Grey Box */}
              <div style={boxStyle}>
                <Image
                  src="/assets/img/Images/New Model.png"
                  alt="New-Model"
                  width={100}
                  height={100}
                />  
              </div>

              <h5 className="fw-bold text-white mt-5">
                The New Model (Elite Growth Firms Use This):
              </h5>
              <hr />

              <ul style={{ lineHeight: "1.8", color: "#ffffff",marginTop:"10px" }}>
                <li style={{display:"flex",gap:"10px"}}> <Image src="/assets/img/Images/button-icon-list.svg" alt="Post-often1" width={12} height={12} /> <span>Strategic positioning that commands attention </span></li>
                <li style={{display:"flex",gap:"10px"}}> <Image src="/assets/img/Images/button-icon-list.svg" alt="Post-often2" width={12} height={12} /> <span>Precision segmentation: decision-makers only </span></li>
                <li style={{display:"flex",gap:"10px"}}> <Image src="/assets/img/Images/button-icon-list.svg" alt="Post-often3" width={12} height={12} /> <span>Message flows designed for response psychology </span></li>
                <li style={{display:"flex",gap:"10px"}}> <Image src="/assets/img/Images/button-icon-list.svg" alt="Post-often4" width={12} height={12} /> <span>Manual outbound with controlled touchpoints </span></li>
                <li style={{display:"flex",gap:"10px"}}> <Image src="/assets/img/Images/button-icon-list.svg" alt="Post-often5" width={12} height={12} /> <span>Weekly optimization based on conversion patterns </span></li>
                <li style={{display:"flex",gap:"10px"}}> <Image src="/assets/img/Images/button-icon-list.svg" alt="Post-often6" width={12} height={12} /> <span>Governance, dashboards, accountability </span></li>
              </ul>
            </div>
          </div>

        </div>

        <div className="text-center mt-5">
          <p className="text-white mb-3">Not sure where your profile leaks replies? Run the audit first and bring the score into the strategy call.</p>
          <Link href="/linkedin-profile-audit" className="cs_btn cs_style_1 cs_color_1">
            <span>Run LinkedIn Profile Audit →</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
