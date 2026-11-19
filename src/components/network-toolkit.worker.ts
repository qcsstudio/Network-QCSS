import { analyzeLocal, inputBudget, maskResult, operations } from "@/lib/toolkit/engine";
import { generateCaptureFilters, type CaptureFilterOptions } from "@/lib/toolkit/comparisons";
import { rawErrorMessage, rawInputLimit, RawOutputError } from "@/lib/toolkit/raw-catalog";
import { ParameterInputError, prepareParameterInput } from "@/lib/toolkit/parameter-inputs";
import { parseDiagnosticReport } from "@/lib/toolkit/local-diagnostics";
import type { ToolkitResult, WorkspaceId } from "@/lib/toolkit/types";

// There is no network fallback. Dependencies are bundled before these guards run.
Object.defineProperty(globalThis, "fetch", { value: () => Promise.reject(new Error("Network disabled in this workspace.")), writable: false });
for (const name of ["XMLHttpRequest", "WebSocket", "EventSource"]) {
  Object.defineProperty(globalThis, name, { value: class { constructor() { throw new Error("Network disabled in this workspace."); } }, writable: false });
}

self.onmessage = async (event: MessageEvent<{ kind: "catalog" | "analyze" | "filters" | "parameters" | "runner"; id?: string; input?: string; file?: File; options?: Record<string, string>; filters?: CaptureFilterOptions; values?: Record<string, string>; rows?: Record<string, Record<string, string>[]> }>) => {
  if (event.data.kind === "catalog") {
    self.postMessage({ catalog: operations.map(({ analyze: _analyze, ...operation }) => { void _analyze; return operation; }) });
    return;
  }
  try {
    if (event.data.kind === "runner") {
      const file = event.data.file;
      if (!file || file.size > 256 * 1024 || !/\.json$/i.test(file.name)) { self.postMessage({ error: "Choose a QCS local runner JSON report up to 256 KiB. Nothing was uploaded." }); return; }
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      self.postMessage({ result: maskResult(parseDiagnosticReport(text)) });
      return;
    }
    if (event.data.kind === "parameters") {
      const prepared = prepareParameterInput(event.data.id as WorkspaceId, event.data.values || {}, event.data.rows || {});
      let result: ToolkitResult;
      if (prepared.kind === "analyze") result = analyzeLocal(prepared.id, prepared.input, prepared.options);
      else if (prepared.kind === "result") result = prepared.result;
      else {
        const filters = generateCaptureFilters(prepared.filters);
        result = { title: "Capture and display filters", summary: "Generated from entered parameters. No capture or packet probe started.", evidence: "calculated", metrics: [], rows: [{ language: "BPF capture filter", expression: filters.bpf }, { language: "Wireshark display filter", expression: filters.wireshark }], findings: [], caveats: filters.caveats, sourceIds: filters.sourceIds };
      }
      result.caveats = ["Derived from entered parameters, not a live observation or proof of device state.", ...result.caveats];
      if (!result.visual && result.rows.length) result.visual = { title: "Parameter model", caption: `First ${Math.min(3, result.rows.length)} of ${result.rows.length} calculated records. No physical topology or successful traffic flow is inferred.`, flow: false, items: result.rows.slice(0, 3).map((row, index) => ({ label: `Model record ${index + 1}`, steps: Object.entries(row).slice(0, 4).map(([label, value]) => ({ label: label.replace(/([a-z])([A-Z])/g, "$1 $2"), value: String(value) })) })) };
      self.postMessage({ result: maskResult(result) });
      return;
    }
    if (event.data.kind === "filters") {
      const filters = generateCaptureFilters(event.data.filters!);
      self.postMessage({ result: { title: "Capture and display filters", summary: "Separate expressions generated from the supplied endpoints and transport conditions. No capture was started.", evidence: "calculated", metrics: [], rows: [{ language: "BPF capture filter", expression: filters.bpf }, { language: "Wireshark display filter", expression: filters.wireshark }], findings: [], caveats: filters.caveats, sourceIds: filters.sourceIds } });
      return;
    }
    const { file, id, input, options } = event.data;
    if (file && id === "device" && file.size > rawInputLimit) throw new RawOutputError("size");
    if (file && file.size > inputBudget) {
      self.postMessage({ error: "This file exceeds the local 20 MiB import budget. Export a focused evidence window; nothing was uploaded." });
      return;
    }
    self.postMessage({ progress: file ? "Reading file on this device..." : "Checking supplied evidence locally..." });
    let text = file ? new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()) : input || "";
    if (id === "subnet" && !text.trimStart().startsWith("{")) text = JSON.stringify({ prefixes: text.trim().split(/[\s,]+/) });
    self.postMessage({ result: analyzeLocal(id || "", text, options || {}) });
  } catch (error) {
    // Parser exceptions may contain raw input. Never echo them to the document or telemetry.
    if (error instanceof ParameterInputError) { self.postMessage({ error: error.message }); return; }
    self.postMessage({ error: rawErrorMessage(error) || "The input could not be interpreted for this operation. Check its format, required fields and supported values using the example. Private keys, binary files and unsupported data are rejected. Nothing was uploaded." });
  }
};
