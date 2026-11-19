import { z } from "zod";
import type { ToolkitAnalyzer, ToolkitResult } from "./types";

export const MAX_IMPORT_BYTES = 1_048_576;
export const MAX_RECORDS = 2_000;
export const unknown = "unavailable";
export const text = z.string().min(1).max(4096);
export const nonnegative = z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER);
export const integer = nonnegative.int();
export const timestamp = z.iso.datetime({ offset: true })
  .refine((s) => !/\.\d{4}/.test(s), "Timestamps support at most three fractional-second digits.")
  .refine((s) => Number.isFinite(Date.parse(s)));
export const nullableNumber = nonnegative.nullable();

class ImportError extends Error {}
export function fail(message: string): never { throw new ImportError(message); }

export function boundInput(input: string, maxBytes = MAX_IMPORT_BYTES) {
  if (!input.trim()) fail("Import is empty. Supply the documented export format.");
  if (input.length > maxBytes || new TextEncoder().encode(input).length > maxBytes) {
    fail(`Import exceeds the ${maxBytes}-byte limit. Export a smaller observation window.`);
  }
}

export function boundTree(root: unknown) {
  const stack = [{ value: root, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const { value, depth } = stack.pop()!;
    if (++nodes > 60_000 || depth > 24) fail("Import exceeds the structure limit (60000 values or 24 levels).");
    if (typeof value === "number" && !Number.isFinite(value)) fail("Import contains a non-finite number.");
    if (typeof value === "string" && value.length > 16_384) fail("Import contains a field longer than 16384 characters.");
    if (value && typeof value === "object") {
      const entries = Object.entries(value);
      if (entries.length > MAX_RECORDS) fail("Import exceeds the 2000-items-per-container limit.");
      for (const [key, child] of entries) {
        if (["__proto__", "prototype", "constructor"].includes(key)) fail("Import contains a forbidden object key.");
        if (key.length > 256) fail("Import contains a field name longer than 256 characters.");
        stack.push({ value: child, depth: depth + 1 });
      }
    }
  }
}

function rejectDuplicateJsonKeys(input: string) {
  const scopes: (Set<string> | null)[] = [];
  // Only inspect key tokens here; JSON.parse remains the syntax and value parser.
  // Decode each key before comparison so escaped spellings cannot hide duplicates.
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (character === "{" || character === "[") {
      scopes.push(character === "{" ? new Set<string>() : null);
      if (scopes.length > 25) fail("Import exceeds the structure limit (60000 values or 24 levels).");
    } else if (character === "}" || character === "]") {
      scopes.pop();
    } else if (character === '"') {
      const start = index++;
      while (index < input.length && input[index] !== '"') {
        if (input[index] === "\\") index++;
        index++;
      }
      if (index >= input.length) fail("Invalid JSON. Supply a complete export, not JSON lines or a partial document.");
      let next = index + 1;
      while (next < input.length && /[ \t\r\n]/.test(input[next])) next++;
      const keys = scopes.at(-1);
      if (input[next] !== ":" || !keys) continue;
      let key: string;
      try { key = JSON.parse(input.slice(start, index + 1)) as string; }
      catch { fail("Invalid JSON. Supply a complete export, not JSON lines or a partial document."); }
      if (key.length > 256) fail("Import contains a field name longer than 256 characters.");
      if (keys.has(key)) fail("Duplicate JSON object keys are unsupported, including escaped equivalents. Export unambiguous objects or explicit arrays; repeated packet layers remain unsupported.");
      keys.add(key);
      if (keys.size > MAX_RECORDS) fail("Import exceeds the 2000-items-per-container limit.");
    }
  }
}

export function json(input: string): unknown {
  boundInput(input);
  rejectDuplicateJsonKeys(input);
  let value: unknown;
  try { value = JSON.parse(input); } catch { fail("Invalid JSON. Supply a complete export, not JSON lines or a partial document."); }
  boundTree(value);
  return value;
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Unsupported shape: expected an object in the documented export.");
  return value as Record<string, unknown>;
}
export function optionalRecord(value: unknown) { return value === undefined ? {} : record(value); }
export function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_RECORDS) fail("Unsupported shape: expected an array of at most 2000 items.");
  return value;
}
export function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return nonnegative.parse(value);
  if (typeof value === "string" && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return nonnegative.parse(Number(value));
  fail("Unsupported numeric field. Expected a finite nonnegative number, not a unit string.");
}
export function display(value: string | number | null | undefined) { return value ?? unknown; }
export function safeAnalyze(analyze: ToolkitAnalyzer): ToolkitAnalyzer {
  return (input, options) => {
    try {
      const output = analyze(input, options);
      if (output.rows.length > MAX_RECORDS) fail("Analysis exceeds the 2000-row output limit. Import a smaller observation window.");
      return output;
    }
    catch (error) {
      if (error instanceof ImportError) throw new Error(error.message);
      // Parser diagnostics can include raw values, PEM contents or secret-bearing keys.
      throw new Error("Unsupported or malformed import. Check the exact format, supported fields and value limits; input details are withheld.");
    }
  };
}
export function result(title: string, sourceIds: string[]): ToolkitResult {
  return { title, summary: "", evidence: "imported", metrics: [], rows: [], findings: [], sourceIds,
    caveats: ["Local import only: no network probe, upload, storage or device command is performed.",
      "Limits: 1 MiB UTF-8, 2000 items per container and output rows, 60000 values, 24 nesting levels. Unsupported input is rejected, never silently truncated."] };
}
export function example(value: unknown) { return JSON.stringify(value, null, 2); }
