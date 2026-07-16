import type { Metadata } from "next";
import { getAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false }
};

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getAdminSession();
  if (session) redirect("/admin");
  const { error } = await searchParams;
  const errorMessage =
    error === "rate" ? "Too many login attempts. Please wait a few minutes and try again." : "Invalid admin credentials.";

  return (
    <main>
      <section className="page-hero">
        <p className="eyebrow">Private layer</p>
        <h1>Admin login</h1>
        <p>Access lead intelligence, assessment data, event activity, and export tools.</p>
      </section>
      <section className="section auth-section">
        <form className="lead-form auth-form" method="post" action="/api/admin/login">
          <label>
            Admin email
            <input name="email" type="email" required placeholder="admin@network-qcss.local" />
          </label>
          <label>
            Password
            <input name="password" type="password" required placeholder="Admin password" />
          </label>
          <button className="button primary" type="submit">
            Sign in
          </button>
          {error ? <p className="form-note error">{errorMessage}</p> : null}
          <p className="form-note">Development default is documented in README. Production must override it with env vars.</p>
        </form>
      </section>
    </main>
  );
}
