export type WorkspaceId = "config" | "packet" | "path" | "performance" | "dns" | "tls" | "switching" | "routing" | "firewall" | "vpn" | "sdwan" | "subnet" | "logs" | "exposure" | "device";
export type EvidenceState = "imported" | "calculated" | "simulated";
export type Finding = { level: "info" | "review"; title: string; detail: string };
export type Metric = { label: string; value: string | number; unit?: string; meaning: string };
export type ToolkitResult = {
  title: string;
  summary: string;
  evidence: EvidenceState;
  metrics: Metric[];
  rows: Record<string, string | number>[];
  findings: Finding[];
  caveats: string[];
  sourceIds: string[];
  provenance?: { parserVersion: string; profile: string; command: string; scope: string };
  visual?: { title: string; caption: string; flow: boolean; items: { label: string; steps: { label: string; value: string }[] }[] };
};
export type ToolkitOptions = Record<string, string>;
export type ToolkitAnalyzer = (input: string, options: ToolkitOptions) => ToolkitResult;
export type ToolkitField = { key: string; label: string; meaning: string; type?: "number" | "select" | "text"; options?: { value: string; label: string }[]; initial?: string };
export type ToolkitOperation = {
  id: WorkspaceId;
  name: string;
  description: string;
  inputLabel: string;
  format: string;
  sample: string;
  fields: ToolkitField[];
  analyze: ToolkitAnalyzer;
};
