import { createHash } from "node:crypto";

// Process-local only: no paid cache service, disk files, cookies or private rows.
export function createPublicReadCache({ maxBytes = 24 * 1024 * 1024, maxEntries = 256,
  ttlMs = 300_000, now = () => Date.now() } = {}) {
  if (![maxBytes, maxEntries, ttlMs].every(value => Number.isFinite(value) && value > 0)) throw new Error("Invalid public cache bounds.");
  const entries = new Map<string, { value: unknown; bytes: number; expires: number }>();
  const pending = new Map<string, Promise<unknown>>();
  let bytes = 0;
  function remove(key: string) {
    const item = entries.get(key);
    if (item) bytes -= item.bytes;
    entries.delete(key);
  }
  return async function read<T>(key: string, load: () => Promise<T>): Promise<T> {
    for (const [id, item] of entries) if (item.expires <= now()) remove(id);
    const hit = entries.get(key);
    if (hit) {
      entries.delete(key);
      entries.set(key, hit);
      return structuredClone(hit.value) as T;
    }
    const inflight = pending.get(key);
    if (inflight) return structuredClone(await inflight) as T;
    const promise = (async () => {
      const value = await load();
      if (value !== null && value !== undefined) {
        const size = Buffer.byteLength(JSON.stringify(value));
        if (size <= maxBytes) {
          while (entries.size && (bytes + size > maxBytes || entries.size >= maxEntries)) remove(entries.keys().next().value!);
          entries.set(key, { value: structuredClone(value), bytes: size, expires: now() + ttlMs });
          bytes += size;
        }
      }
      return value;
    })();
    // Bound bookkeeping under untrusted distinct URL traffic as well as stored data.
    if (pending.size < 32) pending.set(key, promise);
    try { return structuredClone(await promise); }
    finally { if (pending.get(key) === promise) pending.delete(key); }
  };
}

const cached = createPublicReadCache();
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function readPublicSnapshot<G, T>(scope: string, gate: () => Promise<G>, load: (current: G) => Promise<T>, read = cached) {
  // A cache hit never substitutes for the database publication/revision check.
  const before = await gate();
  const version = digest(before);
  const key = digest([process.env.DATABASE_URL || "local", scope, version]);
  const data = await read(key, () => load(before));
  if (digest(await gate()) !== version) throw new Error("Public content changed during this read. Retry the request.");
  return { current: before, data };
}
