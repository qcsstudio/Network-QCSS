"use client";
import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname } from "next/navigation";
import Spinner from "../Spinner";
const LinkedInSalesEngine = () => {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const pathname = usePathname()
    const [formSubmitted, setFormSubmitted] = useState(token);
    const [formData, setFormData] = useState({ name: "", email: "" });
    const [isVerified, setIsVerified] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.name && formData.email) {
            setFormSubmitted(true);

            setFormSubmitted(false);
            setLoading(true)

            try {
                const res = await fetch("/api/send-mail", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: formData.email,
                        name: formData.name,
                        path: pathname
                    }),
                });
                const data = await res.json();
                console.log("API Response:", data);
                const success = data?.success
                const isVerified = data?.isVerified
                if (success == true) {
                    setLoading(false)
                    setIsVerified(true);

                }
                if (isVerified == true) {
                    setIsVerified(false);
                    window.location.href = data.url;

                }
            } catch (error) {
                console.error("Error calling API:", error);
            }
        } else {
            alert("Please fill both fields!");
        }
    };

    return (
        <div style={{ height: "100vh", position: "relative" }}>
            {/* PDF Background */}
            <iframe
                src="/resources/The QCS LinkedIn Sales Engine A 6-Pillar Framework for Predictable B2B Pipeline.pdf"
                width="100%"
                height="100%"
                style={{
                    border: "none",
                    filter: formSubmitted ? "none" : "blur(15px)",
                    pointerEvents: formSubmitted ? "auto" : "none",
                }}
            />

              {/* Form Overlay */}
      {!formSubmitted && (
        <div
          className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)", zIndex: 10 }}
        >
          <div className="bg-white p-4 rounded-4 shadow" style={{ width: "320px" }}>
            <h5 className="text-center fw-semibold mb-3">Access PDF</h5>

            <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
              <input
                type="text"
                name="name"
                placeholder="Enter your name"
                value={formData.name}
                onChange={handleChange}
                className="form-control"
              />

              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                className="form-control"
              />

              <button
                type="submit"
                className="btn btn-primary d-flex justify-content-center align-items-center gap-2"
              >
                {loading ? <Spinner /> : "Submit & View PDF"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Verification Popup */}
      {isVerified && (
        <div
          className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)", zIndex: 10 }}
        >
          <div
            className="bg-white p-4 rounded-4 shadow text-center"
            style={{ width: "320px" }}
          >
            <div
              style={{
                fontSize: "100px",
                color: "#9ABC66",
                lineHeight: 1,
              }}
            >
              ✓
            </div>

            <h5 className="fw-semibold mt-3">
              Please check your email inbox to verify your account.
            </h5>
          </div>
        </div>
      )}
        </div>
    );
};

export default LinkedInSalesEngine;
