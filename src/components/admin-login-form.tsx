"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, LogIn, Mail } from "lucide-react";

type AdminLoginFormProps = {
  credentialsReady: boolean;
  errorMessage: string;
  showError: boolean;
};

export function AdminLoginForm({ credentialsReady, errorMessage, showError }: AdminLoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form className="admin-login-form" method="post" action="/api/admin/login">
      <div className="admin-login-field">
        <label htmlFor="admin-email">Email address</label>
        <div className="admin-login-input">
          <Mail aria-hidden="true" size={18} />
          <input autoComplete="username" id="admin-email" name="email" type="email" required placeholder="Admin email" />
        </div>
      </div>
      <div className="admin-login-field">
        <label htmlFor="admin-password">Password</label>
        <div className="admin-login-input">
          <LockKeyhole aria-hidden="true" size={18} />
          <input autoComplete="current-password" id="admin-password" name="password" type={showPassword ? "text" : "password"} required placeholder="Admin password" />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="admin-password-toggle"
            onClick={() => setShowPassword((current) => !current)}
            title={showPassword ? "Hide password" : "Show password"}
            type="button"
          >
            {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
          </button>
        </div>
      </div>
      <button className="button primary admin-login-submit" type="submit">
        <LogIn aria-hidden="true" size={18} /> Sign in
      </button>
      {showError ? <p className="form-note error" role="alert">{errorMessage}</p> : null}
      {!credentialsReady ? <p className="form-note error" role="alert">Production admin credentials have not been configured.</p> : null}
    </form>
  );
}
