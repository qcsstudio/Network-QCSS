import ipaddr from "ipaddr.js";
import { z } from "zod";

export const MAX_NETWORK_INPUT = 262_144;
export const networkLimits = { prefixes: 128, routes: 512, interfaces: 128, rules: 512, allowedVlans: 4094 } as const;
type NetworkCollection = Exclude<keyof typeof networkLimits, "allowedVlans">;
export const collectionState = z.enum(["complete", "partial", "failed"]);
export const identifier = z.string().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/);
export const emptyOptions = z.object({}).strict();

export function checked<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(message);
  return result.data;
}

function boundedObject(value: unknown, maxKeys: number, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(message);
  let keys = 0;
  for (const key in value) {
    if (Object.hasOwn(value, key) && ++keys > maxKeys) throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function boundedArray(value: unknown, max: number, message: string): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(message);
  return value;
}

function preflightVlans(value: unknown, message: string): void {
  const vlans = boundedArray(value, networkLimits.allowedVlans, message);
  const seen = new Uint8Array(4095);
  for (const vlan of vlans) {
    if (typeof vlan !== "number" || !Number.isInteger(vlan) || vlan < 1 || vlan > 4094 || seen[vlan]) {
      throw new Error(message);
    }
    seen[vlan] = 1;
  }
}

function preflightCollections(value: unknown, collection: NetworkCollection, message: string): void {
  const root = boundedObject(value, collection === "prefixes" ? 1 : collection === "rules" ? 3 : 2, message);
  const entries = boundedArray(root[collection], networkLimits[collection], message);
  if (collection === "prefixes") return;
  // Zod array .max() still validates every element. Check all collection sizes
  // and record shapes first, before any Zod element validation can allocate errors.
  for (const entry of entries) {
    const record = boundedObject(entry, collection === "routes" ? 9 : 7, message);
    if (collection === "interfaces") {
      if (record.allowedVlans != null) preflightVlans(record.allowedVlans, message);
      if (record.peer !== undefined) {
        const peer = boundedObject(record.peer, 5, message);
        if (peer.allowedVlans != null) preflightVlans(peer.allowedVlans, message);
      }
    } else if (collection === "rules") {
      for (const key of ["sourcePorts", "destinationPorts"]) {
        const range = record[key];
        if (range !== null && typeof range === "object") boundedObject(range, 2, message);
      }
    }
  }
}

export function readJson<T>(schema: z.ZodType<T>, input: string, message: string, collection: NetworkCollection): T {
  if (typeof input !== "string" || !input.trim() || input.length > MAX_NETWORK_INPUT) {
    throw new Error("Supply nonempty JSON no larger than 262144 characters.");
  }
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new Error("Invalid JSON: check syntax, duplicate keys, and nesting depth (maximum 12).");
  }
  preflightCollections(value, collection, message);
  try {
    // JSON.parse owns syntax validation. This lexical pass only rejects ambiguous
    // duplicate keys (including escaped keys) and excessive container depth.
    const frames: (Set<string> | null)[] = [];
    const tokens = /"(?:[^"\\]|\\.)*"|[{}\[\]:]/g;
    for (const token of input.matchAll(tokens)) {
      const text = token[0];
      if (text === "{" || text === "[") {
        frames.push(text === "{" ? new Set() : null);
        if (frames.length > 12) throw new Error();
      } else if (text === "}" || text === "]") {
        frames.pop();
      } else if (text.startsWith('"')) {
        let after = token.index + text.length;
        while (/\s/.test(input[after] ?? "") && after < input.length) after++;
        if (input[after] === ":") {
          const key: string = JSON.parse(text);
          const keys = frames.at(-1);
          if (keys?.has(key)) throw new Error();
          keys?.add(key);
        }
      }
    }
  } catch {
    throw new Error("Invalid JSON: check syntax, duplicate keys, and nesting depth (maximum 12).");
  }
  return checked(schema, value, message);
}

export type Address = ipaddr.IPv4 | ipaddr.IPv6;
export type Prefix = {
  address: Address;
  family: "ipv4" | "ipv6";
  bits: number;
  width: number;
  first: bigint;
  last: bigint;
  count: bigint;
  canonical: string;
  hostBits: boolean;
};

export function parseAddress(text: string): Address {
  try {
    if (text.length > 45 || text.includes("%") || text.trim() !== text) throw new Error();
    if (!text.includes(":")) {
      if (!ipaddr.IPv4.isValidFourPartDecimal(text)) throw new Error();
    } else {
      const groups = text.split(":");
      if (text.includes(".")) {
        if (!ipaddr.IPv4.isValidFourPartDecimal(groups.pop()!)) throw new Error();
      }
      // Reject nonstandard overlong hextets that the library accepts when their
      // numeric value still fits. The library remains responsible for parsing.
      if (groups.some(group => !/^[0-9a-f]{0,4}$/i.test(group))) throw new Error();
    }
    // ipaddr.js 2.2.0 rewrites ::a.b.c.d to ::ffff:a.b.c.d. An equivalent
    // explicit zero group avoids that compatibility rewrite and preserves bits.
    return ipaddr.parse(/^::[0-9.]+$/.test(text) ? `::0:${text.slice(2)}` : text);
  } catch {
    throw new Error("Invalid IP address. Use dotted-decimal IPv4 or IPv6 without a zone identifier.");
  }
}

function addressNumber(address: Address): bigint {
  return address.toByteArray().reduce((total, byte) => (total << 8n) | BigInt(byte), 0n);
}

export function formatAddress(value: bigint, width: number): string {
  const bytes = new Array<number>(width / 8);
  for (let i = bytes.length - 1; i >= 0; i--) {
    bytes[i] = Number(value & 255n);
    value >>= 8n;
  }
  const address = ipaddr.fromByteArray(bytes);
  return address instanceof ipaddr.IPv6 ? address.toRFC5952String() : address.toString();
}

export function parsePrefix(text: string): Prefix {
  try {
    const slash = text.indexOf("/");
    if (slash < 1 || !/^(0|[1-9][0-9]{0,2})$/.test(text.slice(slash + 1))) throw new Error();
    const originalAddress = parseAddress(text.slice(0, slash));
    const [address, bits] = ipaddr.parseCIDR(`${originalAddress.toString()}/${text.slice(slash + 1)}`);
    const family = address.kind();
    const width = family === "ipv4" ? 32 : 128;
    const count = 1n << BigInt(width - bits);
    const original = addressNumber(address);
    const first = (original / count) * count;
    return { address, family, bits, width, first, last: first + count - 1n, count,
      canonical: `${formatAddress(first, width)}/${bits}`, hostBits: original !== first };
  } catch {
    throw new Error("Invalid CIDR. Use an IPv4 /0-32 or IPv6 /0-128 prefix without a zone identifier.");
  }
}

function validAddress(text: string): boolean {
  try { parseAddress(text); return true; } catch { return false; }
}
function validPrefix(text: string, canonical: boolean): boolean {
  try { const prefix = parsePrefix(text); return !canonical || !prefix.hostBits; } catch { return false; }
}

export const addressSchema = z.string().min(1).max(45).refine(validAddress);
export const prefixSchema = z.string().min(3).max(49).refine(text => validPrefix(text, false));
export const networkPrefixSchema = z.string().min(3).max(49).refine(text => validPrefix(text, true));

export function matches(address: Address, prefix: Prefix): boolean {
  return address.kind() === prefix.family && address.match(prefix.address, prefix.bits);
}

export function overlaps(a: Prefix, b: Prefix): boolean {
  return a.family === b.family && a.first <= b.last && b.first <= a.last;
}

export function exactUnion(prefixes: Prefix[]): Prefix[] {
  const result: Prefix[] = [];
  for (const family of ["ipv4", "ipv6"] as const) {
    const sorted = prefixes.filter(p => p.family === family).sort((a, b) =>
      a.first < b.first ? -1 : a.first > b.first ? 1 : a.bits - b.bits);
    const stack: Prefix[] = [];
    for (const prefix of sorted) {
      if (stack.at(-1) && stack.at(-1)!.last >= prefix.last) continue;
      stack.push(prefix);
      // Merge aligned siblings only; never fill an address gap to shorten output.
      while (stack.length >= 2) {
        const right = stack.at(-1)!;
        const left = stack.at(-2)!;
        if (left.bits !== right.bits || left.bits === 0 || left.last + 1n !== right.first ||
          left.first % (2n * left.count) !== 0n) break;
        stack.splice(-2, 2, parsePrefix(`${formatAddress(left.first, left.width)}/${left.bits - 1}`));
      }
    }
    result.push(...stack);
  }
  return result;
}
