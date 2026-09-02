"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, X, XCircle } from "lucide-react";

type ActionStatus = "running" | "success" | "warning" | "error";

type ActionToast = {
  detail: string;
  id: string;
  label: string;
  status: ActionStatus;
};

const actionGetPaths = ["/api/admin/content-radar", "/api/cron/advisory-discovery", "/api/cron/social-publisher"];

function requestBodyAction(init?: RequestInit) {
  if (typeof init?.body !== "string") return "";
  try {
    const value = JSON.parse(init.body) as { action?: unknown; importCatalog?: unknown };
    if (typeof value.action === "string") return value.action.replaceAll("_", " ");
    if (value.importCatalog) return "synchronize library";
  } catch {
    return "";
  }
  return "";
}

function operationLabel(pathname: string, method: string, init?: RequestInit) {
  const action = requestBodyAction(init);
  if (pathname.includes("content-radar")) return "Content radar scan";
  if (pathname.includes("ccna-lessons")) return action ? `CCNA ${action}` : "CCNA Learning Desk";
  if (pathname.includes("advisory-discovery")) return "Security advisory scan";
  if (pathname.includes("social-publisher")) return pathname.includes("retryFailed") ? "LinkedIn failure retry" : "LinkedIn queue processing";
  if (pathname.includes("editorial-images")) return "Contextual image generation";
  if (pathname.includes("content-posts")) return action ? `Article ${action}` : method === "DELETE" ? "Article deletion" : "Article creation";
  if (pathname.includes("security-advisories")) return action ? `Advisory ${action}` : method === "DELETE" ? "Advisory deletion" : "Advisory save";
  if (pathname.includes("linkedin/publications")) return action ? `LinkedIn ${action}` : "LinkedIn publication update";
  if (pathname.includes("integrations/linkedin")) return method === "DELETE" ? "LinkedIn disconnect" : "LinkedIn integration";
  if (pathname.includes("verifygrid")) return action ? `VerifyGrid ${action}` : "VerifyGrid operation";
  return action ? `Admin ${action}` : "Admin operation";
}

function shouldReport(url: URL, method: string) {
  if (method !== "GET") return url.pathname.startsWith("/api/admin/") || url.pathname.startsWith("/api/cron/");
  return actionGetPaths.includes(url.pathname);
}

async function responseDetail(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return { degraded: false, detail: response.ok ? "The operation completed." : `The server returned HTTP ${response.status}.` };
  try {
    const payload = (await response.clone().json()) as Record<string, unknown>;
    if (typeof payload.error === "string") return { degraded: false, detail: payload.error };
    if (typeof payload.linkedinWarning === "string" && payload.linkedinWarning) {
      return { degraded: true, detail: `Website action completed. LinkedIn was held: ${payload.linkedinWarning}` };
    }
    if (Array.isArray(payload.results)) {
      const results = payload.results as Array<Record<string, unknown>>;
      const published = results.reduce((sum, item) => sum + Number(item.published || 0), 0);
      const queued = results.reduce((sum, item) => sum + Number(item.queued || 0), 0);
      const failures = results.filter((item) => typeof item.error === "string" && item.error).length;
      return {
        degraded: failures > 0,
        detail: `${results.length} sources checked; ${published} published${queued ? `; ${queued} retained for review` : ""}${failures ? `; ${failures} source warning(s)` : ""}.`
      };
    }
    if (typeof payload.processed === "number") return { degraded: false, detail: `${payload.processed} LinkedIn item(s) processed.` };
    if (Array.isArray(payload.topics)) return { degraded: false, detail: `${payload.topics.length} topic(s) ranked.` };
    if (Array.isArray(payload.outcomes)) return { degraded: false, detail: `${payload.outcomes.length} item(s) completed.` };
    return { degraded: false, detail: "The operation completed and the dashboard is current." };
  } catch {
    return { degraded: false, detail: response.ok ? "The operation completed." : `The server returned HTTP ${response.status}.` };
  }
}

export function AdminActionCenter() {
  const [toasts, setToasts] = useState<ActionToast[]>([]);
  const sequence = useRef(0);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : null;
      const url = new URL(request?.url || String(input), window.location.origin);
      const method = (init?.method || request?.method || "GET").toUpperCase();
      if (!shouldReport(url, method)) return originalFetch(input, init);

      const id = `admin-action-${Date.now()}-${sequence.current++}`;
      const label = operationLabel(`${url.pathname}${url.search}`, method, init);
      const runningToast: ActionToast = { detail: "Working securely. You can remain on this page.", id, label, status: "running" };
      setToasts((current) => [...current.filter((toast) => toast.status !== "success"), runningToast].slice(-4));
      try {
        const response = await originalFetch(input, init);
        const summary = await responseDetail(response);
        const detail = summary.detail;
        const status: ActionStatus = response.ok ? (summary.degraded ? "warning" : "success") : "error";
        setToasts((current) => current.map((toast) => toast.id === id ? { ...toast, detail, status } : toast));
        window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), status === "success" ? 5500 : status === "warning" ? 9000 : 12000);
        return response;
      } catch (error) {
        const detail = error instanceof Error ? error.message : "The operation could not reach the server.";
        setToasts((current) => current.map((toast) => toast.id === id ? { ...toast, detail, status: "error" } : toast));
        window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 12000);
        throw error;
      }
    };
    window.fetch = wrappedFetch;
    document.documentElement.dataset.adminActionCenter = "ready";
    return () => {
      window.fetch = originalFetch;
      delete document.documentElement.dataset.adminActionCenter;
    };
  }, []);

  return (
    <aside aria-label="Administration action status" aria-live="polite" className="admin-action-center">
      {toasts.map((toast) => (
        <section aria-atomic="true" className={`admin-action-toast is-${toast.status}`} key={toast.id} role={toast.status === "error" ? "alert" : "status"}>
          <span className="admin-action-toast-icon">
            {toast.status === "running" ? <LoaderCircle aria-hidden="true" className="admin-action-spinner" /> : toast.status === "success" ? <CheckCircle2 aria-hidden="true" /> : toast.status === "warning" ? <AlertTriangle aria-hidden="true" /> : <XCircle aria-hidden="true" />}
          </span>
          <div><strong>{toast.label}</strong><p>{toast.detail}</p></div>
          <button aria-label={`Dismiss ${toast.label} status`} onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} type="button"><X aria-hidden="true" size={17} /></button>
        </section>
      ))}
    </aside>
  );
}
