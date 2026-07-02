"use client";
import React  from "react";

const VideoHomeTwo = () => {

  return (
    <>
     
          <div
            className="cs_digital_agency cs_video_block cs_style1 cs_video_open cs_bg cs_parallax_bg"
            style={{
              position: "relative",
            }}
          >
            <video
              src="/assets/video/QCS.mp4"
              autoPlay
              loop
              muted
              playsInline
              // controls
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            ></video>
          </div>
       
    </>
  );
};

export default VideoHomeTwo;
