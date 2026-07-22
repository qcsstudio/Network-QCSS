"use client";

import { useEffect, useRef } from "react";
import { KeyRound } from "lucide-react";

export function PortalAccessForm() {
  const tokenInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const supplied = fragment.get("token") || "";
    if (supplied && tokenInput.current) {
      tokenInput.current.value = supplied;
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  return (
    <form action="/api/portal/access" method="post">
      <label><span>One-time access token</span><input autoComplete="off" name="token" ref={tokenInput} required type="password" /></label>
      <button className="button primary" type="submit"><KeyRound aria-hidden="true" size={17} /> Open workspace</button>
    </form>
  );
}
