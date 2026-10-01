import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

globalThis.__publicIndexMock = { securityAdvisory: { findMany: async (query) => {
  assert.equal(query.take, undefined);
  assert.deepEqual(query.where, { status: { in: ["published", "withdrawn"] }, deletedAt: null });
  assert.deepEqual(query.select.revisions, { orderBy: { version: "desc" }, take: 1, select: { version: true, createdAt: true } });
  assert.equal(query.select.technicalExplanation, undefined);
  return Array.from({ length: 301 }, (_, index) => ({ id: String(index) }));
} } };
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.endsWith("/public-advisory-index.ts") && specifier === "./prisma.ts") {
    return { url: "data:text/javascript,export const getPrismaClient=()=>globalThis.__publicIndexMock", shortCircuit: true };
  }
  return next(specifier, context);
} });
const { getPublicAdvisoryIndex } = await import("../src/lib/public-advisory-index.ts");
const original = { DATABASE_URL: process.env.DATABASE_URL, STORE_DRIVER: process.env.STORE_DRIVER };
test.afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("public discovery loads every published record without revision bodies", async () => {
  process.env.DATABASE_URL = "mock://not-a-real-database";
  assert.equal((await getPublicAdvisoryIndex()).length, 301);
});

test("missing production database configuration fails instead of silently dropping published URLs", async () => {
  process.env.DATABASE_URL = "";
  process.env.STORE_DRIVER = "postgres";
  await assert.rejects(getPublicAdvisoryIndex(), /unavailable/);
});

test.after(() => { hook.deregister(); delete globalThis.__publicIndexMock; });
