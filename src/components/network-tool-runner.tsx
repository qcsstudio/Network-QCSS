"use client";

import { FormEvent, useMemo, useState } from "react";
import { getStoredConsent } from "@/components/consent-banner";
import { trackBrowserEvent } from "@/lib/client-tracking";
import { getNetworkUtilityTool } from "@/lib/network-tools";

type DetailValue = string | number | boolean | string[] | Record<string, string | number | boolean>[];

type ToolDetail = {
  label: string;
  value: DetailValue;
};

type ToolResult = {
  tool: string;
  title: string;
  target: string;
  status: "ok" | "warning" | "error";
  summary: string;
  details: ToolDetail[];
  generatedAt: string;
};

function sessionId() {
  const key = "network-qcss-session";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = `sess_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  window.localStorage.setItem(key, created);
  return created;
}

function isRecordList(value: unknown[]): value is Record<string, string | number | boolean>[] {
  return value.every((item) => item && typeof item === "object" && !Array.isArray(item));
}

function renderValue(value: DetailValue, label = "") {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="muted-text">None found</span>;
    if (isRecordList(value)) {
      const keys = Array.from(new Set(value.flatMap((item) => Object.keys(item))));
      return (
        <div className="mini-table">
          <div className="mini-row head">
            {keys.map((key) => (
              <span key={key}>{key}</span>
            ))}
          </div>
          {value.map((row, index) => (
            <div className="mini-row" key={`${index}-${keys.join("-")}`}>
              {keys.map((key) => (
                <span key={key}>{String(row[key] ?? "")}</span>
              ))}
            </div>
          ))}
        </div>
      );
    }

    if (/command|cleanup|prepare|validate|evidence/i.test(label)) {
      return (
        <ol className="command-result-list">
          {value.map((item) => (
            <li key={String(item)}>
              <code>{String(item)}</code>
            </li>
          ))}
        </ol>
      );
    }

    return (
      <ul className="inline-result-list">
        {value.map((item) => (
          <li key={String(item)}>{String(item)}</li>
        ))}
      </ul>
    );
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function NetworkToolRunner({ slug }: { slug: string }) {
  const tool = useMemo(() => getNetworkUtilityTool(slug), [slug]);
  const [target, setTarget] = useState("");
  const [port, setPort] = useState(443);
  const [fieldValues, setFieldValues] = useState<Record<string, string | number>>(() =>
    Object.fromEntries((tool?.fields || []).map((field) => [field.name, field.defaultValue ?? ""]))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ToolResult | null>(null);

  if (!tool) return null;
  const activeTool = tool;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    const consent = getStoredConsent();
    const response = await fetch("/api/network-tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: slug,
        target,
        port: activeTool.portRequired ? port : undefined,
        params: activeTool.fields ? fieldValues : undefined,
        sessionId: sessionId(),
        consent
      })
    });
    const payload = (await response.json()) as { ok: boolean; result?: ToolResult; error?: string };
    setLoading(false);

    if (!response.ok || !payload.ok || !payload.result) {
      setError(payload.error || "Unable to run this tool right now.");
      return;
    }

    setResult(payload.result);
    trackBrowserEvent("network_tool_run", {
      tool: slug,
      category: activeTool.category,
      status: payload.result.status
    });
  }

  return (
    <div className="network-tool-shell">
      <form className="network-tool-form" onSubmit={submit}>
        {activeTool.fields ? (
          <div className="tool-field-grid">
            {activeTool.fields.map((field) => (
              <label key={field.name}>
                {field.label}
                {field.type === "select" ? (
                  <select
                    value={fieldValues[field.name] ?? field.defaultValue ?? ""}
                    required={field.required}
                    onChange={(event) => setFieldValues((current) => ({ ...current, [field.name]: event.target.value }))}
                  >
                    {(field.options || []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    min={field.min}
                    max={field.max}
                    value={fieldValues[field.name] ?? ""}
                    required={field.required}
                    placeholder={field.placeholder}
                    onChange={(event) => setFieldValues((current) => ({ ...current, [field.name]: event.target.value }))}
                  />
                )}
                {field.helper && <small>{field.helper}</small>}
              </label>
            ))}
          </div>
        ) : (
          <>
            <label>
              {activeTool.inputLabel}
              <input
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                required
                placeholder={activeTool.placeholder}
              />
            </label>
            {activeTool.portRequired && (
              <label>
                TCP port
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={port}
                  onChange={(event) => setPort(Number(event.target.value))}
                  required
                />
              </label>
            )}
          </>
        )}
        <button className="button primary" disabled={loading} type="submit">
          {loading ? "Working..." : activeTool.fields ? `Generate ${activeTool.shortTitle}` : `Run ${activeTool.shortTitle}`}
        </button>
        <p className="form-note">
          {activeTool.fields
            ? "Generated scripts are planning aids. Confirm syntax against device version, change window, and vendor documentation before use."
            : "Public diagnostics only. Private, localhost, multicast, and reserved targets are blocked."}
        </p>
      </form>

      <div className={`network-tool-result ${result?.status || ""}`} aria-live="polite">
        {error ? (
          <div>
            <p className="eyebrow">Tool error</p>
            <h2>Check the target and try again.</h2>
            <p>{error}</p>
          </div>
        ) : result ? (
          <>
            <div className="result-heading">
              <div>
                <p className="eyebrow">Live result</p>
                <h2>{result.summary}</h2>
              </div>
              <span className={`status-pill ${result.status === "ok" ? "ready" : "missing"}`}>{result.status}</span>
            </div>
            <div className="result-grid">
              {result.details.map((detail) => (
                <article key={detail.label}>
                  <strong>{detail.label}</strong>
                  <div>{renderValue(detail.value, detail.label)}</div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div>
            <p className="eyebrow">Waiting for input</p>
            <h2>{activeTool.outputPromise}</h2>
            <p>Run a public check to understand the symptom before deeper troubleshooting.</p>
          </div>
        )}
      </div>
    </div>
  );
}
