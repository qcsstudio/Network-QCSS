import ipaddr from "ipaddr.js";
import { z } from "zod";

export const MAX_COMPARISON_INPUT = 131_072;
const emptyOptionsSchema = z.strictObject({});
const forbiddenJsonKeys = new Set(["__proto__", "constructor", "prototype"]);

export function requireEmptyComparisonOptions(options: unknown, label: string): void {
  try {
    if (options === null || typeof options !== "object") throw new Error();
    const prototype = Object.getPrototypeOf(options);
    if ((prototype !== Object.prototype && prototype !== null) || Reflect.ownKeys(options).length !== 0 || !emptyOptionsSchema.safeParse(options).success) {
      throw new Error();
    }
  } catch {
    throw new Error(`Invalid ${label} options. This operation does not accept options.`);
  }
}

function checkJsonObjectKeys(input: string): void {
  const frames: (Set<string> | null)[] = [];
  // Check keys before parsing the document can discard earlier duplicate values.
  // JSON.parse decodes only individual key strings here; it owns full syntax validation below.
  for (const token of input.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\]]/g)) {
    const text = token[0];
    if (text === "{" || text === "[") {
      frames.push(text === "{" ? new Set() : null);
      if (frames.length > 12) throw new Error("JSON nesting limit exceeded.");
    } else if (text === "}" || text === "]") {
      frames.pop();
    } else {
      let next = token.index + text.length;
      while (next < input.length && /\s/.test(input[next])) next++;
      if (input[next] !== ":") continue;
      const key: string = JSON.parse(text);
      if (forbiddenJsonKeys.has(key)) throw new Error("Unsupported JSON object key.");
      const keys = frames.at(-1);
      if (keys?.has(key)) throw new Error("Duplicate JSON object key.");
      keys?.add(key);
    }
  }
}

export function parseComparison<T>(input: string, schema: z.ZodType<T>, label: string): T {
  const message = `Invalid ${label} JSON. Use the documented schema and bounded sample; duplicate keys, unknown fields, unsupported values, nesting beyond 12 levels and oversized inputs are rejected. Do not include secrets.`;
  if (typeof input !== "string" || input.length > MAX_COMPARISON_INPUT) throw new Error(message);
  try {
    checkJsonObjectKeys(input);
    return schema.parse(JSON.parse(input));
  } catch {
    // Parser errors can contain submitted values and unknown property names.
    throw new Error(message);
  }
}

export function parseIP(value: string) {
  if (!value || value.length > 45 || !/^[0-9a-fA-F:.]+$/.test(value)) throw new Error("Invalid IP literal.");
  const decimalV4 = (part: string) => /^(0|[1-9][0-9]{0,2})(\.(0|[1-9][0-9]{0,2})){3}$/.test(part);
  if (!value.includes(":") && !decimalV4(value)) throw new Error("Use four-part decimal IPv4.");
  if (value.includes(":")) {
    const groups = value.split(":");
    if (value.includes(".") && !decimalV4(groups.pop()!)) throw new Error("Invalid embedded IPv4.");
    if (groups.some((group) => !/^[0-9a-fA-F]{0,4}$/.test(group))) throw new Error("Invalid IPv6 hextet.");
  }
  // ipaddr.js 2.2.0 maps ::a.b.c.d to ::ffff:a.b.c.d; an explicit zero group preserves the actual bits.
  return ipaddr.parse(value.includes(".") && /^::[0-9.]+$/.test(value) ? `::0:${value.slice(2)}` : value);
}

export const ipLiteralSchema = z.string().max(45).refine((value) => {
  try { parseIP(value); return true; } catch { return false; }
});

export function parseNetwork(value: string) {
  const parts = value.split("/");
  if (parts.length !== 2 || !/^(0|[1-9][0-9]{0,2})$/.test(parts[1])) throw new Error("Invalid CIDR.");
  const address = parseIP(parts[0]);
  const bits = address.kind() === "ipv4" ? 32 : 128;
  const prefix = Number(parts[1]);
  if (prefix > bits) throw new Error("Invalid prefix length.");
  const number = address.toByteArray().reduce((result, byte) => (result << 8n) | BigInt(byte), 0n);
  const hostBits = BigInt(bits - prefix);
  const start = (number >> hostBits) << hostBits;
  return { family: address.kind(), start, end: start + (1n << hostBits) - 1n };
}

export const cidrSchema = z.string().max(49).refine((value) => {
  try { parseNetwork(value); return true; } catch { return false; }
});

export const shortText = z.string().trim().min(1).max(120).refine((value) => !/[\u0000-\u001f\u007f]/.test(value));
