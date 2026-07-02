'use client';
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

export default function Login() {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

    const router = useRouter();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);

      const res = await fetch("https://analyzer.qcsstudio.com/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      // 🔐 Token save (agar backend bhej raha ho)
      if (data.token) {
        localStorage.setItem("token", data.token);
      }
      // router.push("/suggestions");
      // router.push("/https://rzp.io/rzp/EGOrlgI");
      // window.location.href = "https://rzp.io/rzp/EGOrlgI";
      router.push("/payment");
      console.log("login data============",data)
      alert("Login Successful 🎉");

    

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container min-vh-100 p-0">

      <h1 className="brand-title text-center my-5">Login</h1>

      <div className="flex-grow-1 d-flex justify-content-center align-items-center">
        <div className="form-box">

          <h2 className="heading-small">Hey,</h2>
          <h1 className="heading-large">Welcome Back !</h1>
          <p className="text-muted mb-4">We are very happy to see you back!</p>

          {error && <p className="text-danger small">{error}</p>}

          <form onSubmit={onSubmit}>
            <div className="mb-3">
              <label className="form-label small">Email</label>
              <input
                type="email"
                className="form-control"
                name="email"
                value={form.email}
                onChange={onChange}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label small">Password</label>
              <input
                type="password"
                className="form-control"
                name="password"
                value={form.password}
                onChange={onChange}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-signup w-100 mb-3"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>

                <p>Don't have an Account <Link href='/signup' className="text-primary">Create an account</Link></p>
            <div className="or-divider mb-3">
              <span>OR</span>
            </div>

            <button type="button" className="btn btn-google w-100">
              <Image
                src="/assets/img/Images/Google-signup.png"
                alt="google-logo"
                width={34}
                height={34}
              />
              <span>Login with Google</span>
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
