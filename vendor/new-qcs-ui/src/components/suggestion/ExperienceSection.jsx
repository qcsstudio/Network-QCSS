import Image from "next/image";

const ExperienceSection = ({data}) => {
    if (!data || !data.original || !data.original.experience) {
        return <p className="text-center">Loading.....</p>;
    }
    console.log("ExperienceSection data:", data);
  return (
    <div className="container my-5">
      <div className="card shadow-sm rounded-4 p-4">
        <h3 className="fw-bold mb-4">Experience</h3>

        {data?.original?.experience?.map((item, index) => (
          <div key={index}>
            <div className="d-flex mb-3">
              {/* Company Logo (optional static ya API se) */}
              <Image
                src="/company.png"
                width={48}
                height={48}
                alt="Company"
              />

              <div className="ms-3">
                <h6 className="fw-bold mb-0">{item.company}</h6>
                <p className="mb-0">{item.employmentType}</p>

                <small className="text-muted d-block">
                  {item.duration}
                </small>

                <small className="text-muted">
                  {item.location}
                </small>

                {/* Skills */}
                {/* {item.skills?.length > 0 && (
                  <div className="mt-2">
                    <span className="fw-semibold">Skills: </span>
                    {item.skills.map((skill, i) => (
                      <span
                        key={i}
                        className="badge bg-light text-dark border me-2 mb-2"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )} */}
              </div>
            </div>

            {index !== experienceData.length - 1 && <hr />}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExperienceSection;
