import { networkOperations } from "./network";
import { importOperations } from "./imports";
import { comparisonOperations } from "./comparisons";
import { rawOperation } from "./raw";
import type { ToolkitOperation, ToolkitResult } from "./types";

export const operations: ToolkitOperation[] = [...networkOperations, ...importOperations, ...comparisonOperations, rawOperation];
export const inputBudget = 20 * 1024 * 1024;

function mask(value: string): string {
  // Withhold the entire free-text field: partial replacement can leak escaped
  // quoted values or comma-separated Authorization credentials.
  if (/-----BEGIN [^-]*PRIVATE KEY-----/.test(value) || /\b(?:password|passwd|psk|secret|token|authorization|proxy-authorization|api[-_ ]?key|community)[\s"'\\]*[:=]/i.test(value)) return "[SENSITIVE TEXT WITHHELD]";
  return value;
}

// Mask known secret assignments even when they occur in imported free-text labels.
export function maskResult(result: ToolkitResult): ToolkitResult {
  function visit(value: unknown): unknown {
    if (typeof value === "string") return mask(value);
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [mask(key), /^(?:password|passwd|psk|secret|token|authorization|proxy-authorization|api[-_ ]?key|community)$/i.test(key) ? "[MASKED]" : visit(item)]));
    return value;
  }
  return visit(result) as ToolkitResult;
}

export function analyzeLocal(id: string, input: string, options: Record<string, string>): ToolkitResult {
  if (new TextEncoder().encode(input).byteLength > inputBudget) throw new Error("This import exceeds the local 20 MiB processing budget.");
  if (input.includes("\0") || /-----BEGIN [^-]*PRIVATE KEY-----/.test(input)) throw new Error("Do not import binary data or private keys.");
  const operation = operations.find(item => item.id === id);
  if (!operation) throw new Error("Unsupported workspace.");
  return maskResult(operation.analyze(input, options));
}
