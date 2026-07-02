"use client";
import { useEffect, useState } from "react";
import { Editor } from "../JoditEditor/JoditEditor";

const JobPostForm = () => {
  const [jobs, setJobs] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: "", type: "success" });
  const [search, setSearch] = useState("");

  const [formData, setFormData] = useState({
    heading: "",
    description: "",
    location: "",
    experience: "",
    skills: "",
    workHours: "",
  });

  // ================= FETCH =================
  const fetchJobs = async () => {
    const res = await fetch("/api/career");
    const data = await res.json();
    setJobs(data);
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // ================= TOAST =================
  const showToast = (msg, type = "success") => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: "", type }), 3000);
  };

  // ================= SUBMIT =================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const url = editingId ? `/api/career/${editingId}` : "/api/career";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (!res.ok) {
      showToast("Something went wrong", "danger");
      setLoading(false);
      return;
    }

    showToast(editingId ? "Job Updated" : "Job Created");
    setShowModal(false);
    resetForm();
    fetchJobs();
    setLoading(false);
  };

  // ================= DELETE =================
  const handleDelete = async (job) => {
    if (!window.confirm("Are you sure you want to delete this job?")) return;

    const res = await fetch(`/api/career/${job.heading}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Job Deleted");
      fetchJobs();
    }
  };

  // ================= EDIT =================
  const handleEdit = (job) => {
    setFormData(job);
    setEditingId(job.heading);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      heading: "",
      description: "",
      location: "",
      experience: "",
      skills: "",
      workHours: "",
    });
    setEditingId(null);
  };

  // ================= FILTER =================
  const filteredJobs = jobs.filter((job) =>
    job.heading.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container-fluid p-4">
      {/* ================= HEADER ================= */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="fw-bold">Job Postings</h3>
        <input
          className="form-control w-25"
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ================= TABLE ================= */}
      <div className="table-responsive shadow-sm rounded">
        <table className="table table-bordered table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Position</th>
              <th>Location</th>
              <th>Experience</th>
              <th>Skills</th>
              <th>Description</th>
              <th width="120">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center text-muted">
                  No job postings found
                </td>
              </tr>
            )}
            {filteredJobs.map((job, i) => (
              <tr key={i}>
                <td>{job.heading}</td>
                <td>{job.location}</td>
                <td>{job.experience}</td>
                <td>{job.skills}</td>
                <td dangerouslySetInnerHTML={{ __html: job.description }} />
                <td>
                  <button
                    className="btn btn-sm btn-success me-2"
                    onClick={() => handleEdit(job)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(job)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ================= ADD BUTTON ================= */}
      <button
        className="btn btn-danger rounded-circle position-fixed bottom-0 end-0 m-4"
        style={{ width: 55, height: 55 }}
        onClick={() => {
          resetForm();
          setShowModal(true);
        }}
      >
        +
      </button>

      {/* ================= MODAL ================= */}
      {showModal && (
        <div className="modal fade show d-block bg-dark bg-opacity-50">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <form onSubmit={handleSubmit}>
                <div className="modal-header">
                  <h5 className="modal-title">
                    {editingId ? "Edit Job" : "Add Job"}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowModal(false)}
                  />
                </div>

                <div className="modal-body row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Job Title</label>
                    <input
                      className="form-control"
                      value={formData.heading}
                      disabled={!!editingId}
                      onChange={(e) =>
                        setFormData({ ...formData, heading: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Location</label>
                    <input
                      className="form-control"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label">Description</label>
                    <Editor content={formData} setContent={setFormData} />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Experience</label>
                    <input
                      className="form-control"
                      value={formData.experience}
                      onChange={(e) =>
                        setFormData({ ...formData, experience: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Skills</label>
                    <input
                      className="form-control"
                      value={formData.skills}
                      onChange={(e) =>
                        setFormData({ ...formData, skills: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Work Hours</label>
                    <input
                      className="form-control"
                      value={formData.workHours}
                      onChange={(e) =>
                        setFormData({ ...formData, workHours: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" disabled={loading}>
                    {loading ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOAST ================= */}
      {toast.show && (
        <div
          className={`toast show position-fixed top-0 end-0 m-3 text-bg-${toast.type}`}
        >
          <div className="toast-body">{toast.msg}</div>
        </div>
      )}
    </div>
  );
};

export default JobPostForm;
