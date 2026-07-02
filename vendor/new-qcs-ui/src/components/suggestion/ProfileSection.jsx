'use client';
import Image from 'next/image';
import React, { useEffect, useState } from 'react'
import { DNA } from 'react-loader-spinner';

const ProfileSection = ({ data }) => {

  const [showFullAboutUpdated, setShowFullAboutUpdated] = useState(false);
  const [showAllExperience, setShowAllExperience] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);

  console.log("ProfileSection data:", data);

  useEffect(() => {
    if (data) {
      document.body.style.overflow = "auto";
    }
  }, [data]);
  const experienceData = data?.original?.profile?.experience || [];
  const profile_pic = data?.original?.profile?.profile_picture || "";
  const educationData = data?.original?.profile?.education || [];
  const skillsData = data?.original?.profile?.skills || [];
  const aboutData = data?.original?.profile?.about || [];
  const experienceDataUpdated = data?.improved?.profile?.experience || [];
  const profile_picvUpdated = data?.improved?.profile?.profile_picture || [];
  const educationDataUpdated = data?.improved?.profile?.education || [];
  const skillsDataUpdated = data?.improved?.profile?.skills || [];
  const aboutDataUpdated = data?.improved?.profile?.about || [];
  console.log("Education data:", educationData);

  const renderAboutText = (text, expanded, setExpanded) => {
    if (!text) {
      return <p className="text-muted">No about information available.</p>;
    }

    // ✅ Ensure string
    const aboutString = Array.isArray(text)
      ? text.join(" ")
      : String(text);

    const words = aboutString.split(" ");
    const isLong = words.length > 20;
    const shortText = words.slice(0, 20).join(" ");

    return (
      <p className="text-muted">
        {expanded || !isLong ? aboutString : `${shortText}...`}

        {isLong && (
          <span
            className="text-primary ms-2"
            style={{ cursor: "pointer", fontWeight: 500 }}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "See less" : "See more"}
          </span>
        )}
      </p>
    );
  };

  // experience
  const visibleExperience = showAllExperience
    ? experienceData
    : experienceData.slice(0, 1);

  //skills
  const visibleSkills = showAllSkills
    ? skillsData
    : skillsData.slice(0, 5);

  //updated skills
  const Updated_visibleSkills = showAllSkills
    ? skillsDataUpdated
    : skillsDataUpdated.slice(0, 5);

  if (!data) {
    return (
      <>


        <div className="d-flex justify-content-center align-items-center min-vh-100">
          <DNA
            visible={true}
            height="100"
            width="100"
            ariaLabel="dna-loading"
            wrapperStyle={{}}
            wrapperClass="dna-wrapper"
          />
        </div>
        <h1 className='text-black'>Please Wait...</h1>
      </>
    );
  }

  return (
    <>
      <div className='container d-flex gap-1 '>


        <div className='row'>

          {/* original ==================================  */}
          <div className='col-lg-6 col-12'>

            <div className=" my-5">
              <div className="profile-card shadow-sm rounded-4 overflow-hidden">

                {/* ===== Cover Section ===== */}
                <div className="cover-section position-relative">
                  <div className="cover-overlay"></div>

                  {/* Badge */}
                  {/* <span className="designer-badge">Designer</span> */}

                  {/* Profile Image */}
                  <div className="profile-img-wrapper">
                    <Image
                      // src="/profile.jpg"   
                      src={profile_pic}
                      alt="Profile"
                      width={120}
                      height={120}
                      className="profile-img border"
                    />
                  </div>

                  {/* Headline */}
                  <div className="cover-text">

                  </div>
                </div>

                {/* ===== Content Section ===== */}
                <div className="p-4 pt-5">
                  <div className="row">
                    <div className="col-md-8">
                      <h3 className="fw-bold mb-1">{data?.original?.profile?.name}</h3>
                      <p className="text-muted mb-1 d-flex justify-content-between">{data?.original?.profile?.headline} <span className='fw-normal text-black fs-1'>{data?.original?.score?.sections?.headline}</span></p>
                      <p className="text-muted">
                        {data?.original?.profile?.location} <span className="text-primary">Contact info</span>
                      </p>

                      <p className="text-muted mt-2">{data?.original?.profile?.connections}</p>

                      <div className="d-flex gap-2 mt-3">
                        <button className="btn btn-primary rounded-pill px-4">Connect</button>
                        <button className="btn btn-outline-primary rounded-pill px-4">Message</button>
                        <button className="btn btn-outline-secondary rounded-pill px-4">More</button>
                      </div>
                    </div>

                    {/* <div className="col-md-4 mt-4 mt-md-0">
              <div className="d-flex align-items-center mb-3">
                <img src="/netflix.png" width="28" className="me-2" />
                <span className="fw-semibold">Netflix Inc</span>
              </div>
              <div className="d-flex align-items-center">
                <img src="/stanford.png" width="28" className="me-2" />
                <span className="fw-semibold">Stanford University</span>
              </div>
            </div> */}
                  </div>
                </div>

              </div>
            </div>

            {/* About */}

            <div className=" my-5">
              <div className="card shadow-sm rounded-4 p-4">
                <h3 className="fw-bold mb-4 d-flex justify-content-between">About <span className='fw-normal '>{data?.original?.score?.sections?.about}</span></h3>
                {renderAboutText(
                  aboutData,
                  showFullAboutUpdated,
                  setShowFullAboutUpdated
                )}


              </div>
            </div>

            {/* ============Experience============ */}
            <div className=" my-5">
              <div className="card shadow-sm rounded-4 p-4">
                <h3 className="fw-bold mb-4 d-flex justify-content-between">Experience <span className='fw-normal '>{data?.original?.score?.sections?.experience}</span></h3>

                {visibleExperience.map((item, index) => (
                  <div key={index}>
                    <div className="d-flex mb-3">
                      <div className="ms-3">
                        <h6 className="fw-bold mb-0">{item.company}</h6>
                        <p className="mb-0">{item.employmentType}</p>

                        <small className="text-muted d-block">
                          {item.duration}
                        </small>

                        <small className="text-muted">
                          {item.location}
                        </small>
                      </div>
                    </div>

                    {index !== visibleExperience.length - 1 && <hr />}
                  </div>
                ))}

                {experienceData.length > 1 && (
                  <div className="text-center mt-2">
                    <span
                      className="text-primary"
                      style={{ cursor: "pointer", fontWeight: 500 }}
                      onClick={() => setShowAllExperience(!showAllExperience)}
                    >
                      {showAllExperience ? "See less" : "See more"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ===============education section============== */}
            <div className=" my-5">
              <div className="card shadow-sm rounded-4 p-4">
                <h3 className="fw-bold mb-4 d-flex justify-content-between">Education<span className='fw-normal '>{data?.original?.score?.sections?.education}</span></h3>
                {educationData.map((item, index) => (
                  <div key={index}>
                    <div className="d-flex mb-3">
                      <div className="ms-3">
                        <h6 className="fw-bold mb-0">{item.institute}</h6>
                        <p className="mb-0">{item.degree}</p>
                        <p className="mb-0">{item.duration}</p>
                        <p className="mb-0">{item.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills Section */}
            <div className=" my-5">
              <div className="card shadow-sm rounded-4 p-4">
                <h3 className="fw-bold mb-4 d-flex justify-content-between">Skills<span className='fw-normal '>{data?.original?.score?.sections?.skills}</span></h3>
                {visibleSkills.map((skill, index) => (
                  <span
                    key={index}
                    className="pill me-2 mb-2"
                  >
                    {skill}
                  </span>
                ))}

                {skillsData.length > 5 && (
                  <div className="mt-3">
                    <span
                      className="text-primary"
                      style={{ cursor: "pointer", fontWeight: 500 }}
                      onClick={() => setShowAllSkills(!showAllSkills)}
                    >
                      {showAllSkills ? "See less" : "See more"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* updated profile section ================== */}
          <div className='col-lg-6 col-12'>

            <div className=" my-5">
              <div className="profile-card shadow-sm rounded-4 overflow-hidden">

                {/* ===== Cover Section ===== */}
                <div className="cover-section position-relative">
                  <div className="cover-overlay"></div>

                  {/* Badge */}
                  {/* <span className="designer-badge">Designer</span> */}

                  {/* Profile Image */}
                  <div className="profile-img-wrapper">
                    <Image
                      // src="/profile.jpg"   
                      src={profile_pic}
                      alt="Profile"
                      width={120}
                      height={120}
                      className="profile-img border"
                    />
                  </div>

                  {/* Headline */}
                  <div className="cover-text">

                  </div>
                </div>

                {/* ===== Content Section ===== */}
                <div className="p-4 pt-5">
                  <div className="row">
                    <div className="col-md-8">
                      <h3 className="fw-bold mb-1">{data?.original?.profile?.name}</h3>
                      <p className="text-muted mb-1 d-flex justify-content-between">{data?.improved?.profile?.headline}<span className='fw-normal text-black fs-1'>{data?.original?.score?.sections?.headline}</span></p>
                      <p className="text-muted">
                        {data?.original?.profile?.location} <span className="text-primary">Contact info</span>
                      </p>

                      <p className="text-muted mt-2">{data?.original?.profile?.connections}</p>

                      <div className="d-flex gap-2 mt-3">
                        <button className="btn btn-primary rounded-pill px-4">Connect</button>
                        <button className="btn btn-outline-primary rounded-pill px-4">Message</button>
                        <button className="btn btn-outline-secondary rounded-pill px-4">More</button>
                      </div>
                    </div>

                    {/* <div className="col-md-4 mt-4 mt-md-0">
              <div className="d-flex align-items-center mb-3">
                <img src="/netflix.png" width="28" className="me-2" />
                <span className="fw-semibold">Netflix Inc</span>
              </div>
              <div className="d-flex align-items-center">
                <img src="/stanford.png" width="28" className="me-2" />
                <span className="fw-semibold">Stanford University</span>
              </div>
            </div> */}
                  </div>
                </div>

              </div>
            </div>

            {/* About */}

            <div className=" my-5">
              <div className="card shadow-sm rounded-4 p-4">
                <h3 className="fw-bold mb-4 d-flex justify-content-between">About <span className='fw-normal '>{data?.improved?.score?.sections?.about}</span></h3>
                {renderAboutText(
                  aboutDataUpdated,
                  showFullAboutUpdated,
                  setShowFullAboutUpdated
                )}


              </div>
            </div>

            {/* ============Experience============ */}
            <div className=" my-5">
              <div className="card shadow-sm rounded-4 p-4">
                <h3 className="fw-bold mb-4 d-flex justify-content-between">Experience <span className='fw-normal '>{data?.improved?.score?.sections?.experience}</span></h3>

                {visibleExperience.map((item, index) => (
                  <div key={index}>
                    <div className="d-flex mb-3">
                      <div className="ms-3">
                        <h6 className="fw-bold mb-0">{item.company}</h6>
                        <p className="mb-0">{item.employmentType}</p>

                        <small className="text-muted d-block">
                          {item.duration}
                        </small>

                        <small className="text-muted">
                          {item.location}
                        </small>
                      </div>
                    </div>

                    {index !== visibleExperience.length - 1 && <hr />}
                  </div>
                ))}

                {experienceData.length > 1 && (
                  <div className="text-center mt-2">
                    <span
                      className="text-primary"
                      style={{ cursor: "pointer", fontWeight: 500 }}
                      onClick={() => setShowAllExperience(!showAllExperience)}
                    >
                      {showAllExperience ? "See less" : "See more"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ===============education section============== */}
            <div className=" my-5">
              <div className="card shadow-sm rounded-4 p-4">
                <h3 className="fw-bold mb-4 d-flex justify-content-between">Education <span className='fw-normal '>{data?.improved?.score?.sections?.education}</span></h3>
                {educationData.map((item, index) => (
                  <div key={index}>
                    <div className="d-flex mb-3">
                      <div className="ms-3">
                        <h6 className="fw-bold mb-0">{item.institute}</h6>
                        <p className="mb-0">{item.degree}</p>
                        <p className="mb-0">{item.duration}</p>
                        <p className="mb-0">{item.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills Section */}
            <div className=" my-5">
              <div className="card shadow-sm rounded-4 p-4">
                <h3 className="fw-bold mb-4 d-flex justify-content-between">Skills<span className='fw-normal '>{data?.improved?.score?.sections?.skills}</span></h3>
                {Updated_visibleSkills.map((skill, index) => (
                  <span
                    key={index}
                    className="pill me-2 mb-2"
                  >
                    {skill}
                  </span>
                ))}

                {skillsDataUpdated.length > 5 && (
                  <div className="mt-3">
                    <span
                      className="text-primary"
                      style={{ cursor: "pointer", fontWeight: 500 }}
                      onClick={() => setShowAllSkills(!showAllSkills)}
                    >
                      {showAllSkills ? "See less" : "See more"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>







      </div>
    </>
  );

}

export default ProfileSection