import type { Metadata } from "next";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { AdminLoginForm } from "@/components/admin-login-form";
import { adminCredentialsConfigured, getAdminSession } from "@/lib/admin-auth";
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
    error === "rate"
      ? "Too many login attempts. Please wait a few minutes and try again."
      : error === "config"
        ? "Admin access is not configured. Add the required admin environment variables in Vercel and redeploy."
        : "Invalid admin credentials.";
  const credentialsReady = adminCredentialsConfigured();

  return (
    <main className="admin-login-page">
      <section aria-labelledby="admin-login-title" className="admin-login-shell">
        <div className="admin-login-visual">
          <Image
            alt="QuantumCrafters Studio Pvt. Ltd."
            className="admin-login-logo"
            height={100}
            priority
            src="/brand/quantumcrafters-logo.png"
            width={328}
          />
          <div className="admin-login-copy">
            <span className="admin-login-security"><ShieldCheck aria-hidden="true" size={18} /> Secure operator portal</span>
            <p className="eyebrow">QCS Network Command</p>
            <h1 id="admin-login-title">Private operations console.</h1>
            <p>Network intelligence, publishing, lead operations, and VerifyGrid in one controlled workspace.</p>
          </div>
          <div className="admin-login-visual-status">
            <span><i aria-hidden="true" /> Administrative actions are audited</span>
            <strong>QuantumCrafters Studio Private Limited</strong>
          </div>
        </div>

        <div className="admin-login-access">
          <div className="admin-login-heading">
            <span className="admin-login-shield"><ShieldCheck aria-hidden="true" size={24} /></span>
            <p className="eyebrow">Authorized access</p>
            <h2>Sign in</h2>
            <p>Continue to the QCS administration workspace.</p>
          </div>
          <AdminLoginForm credentialsReady={credentialsReady} errorMessage={errorMessage} showError={Boolean(error)} />
          <p className="admin-login-policy">Protected by rate limiting, secure sessions, and audit logging.</p>
        </div>
      </section>
    </main>
  );
}
