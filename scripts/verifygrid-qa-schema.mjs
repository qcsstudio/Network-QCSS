import pg from "pg";

const [mode, schema] = process.argv.slice(2);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
if (!/^(verifygrid_qa_)[a-z0-9_]{8,48}$/.test(schema || "")) throw new Error("Use an explicitly named verifygrid_qa_* schema.");
if (!["create", "drop"].includes(mode)) throw new Error("Mode must be create or drop.");

const url = new URL(process.env.DATABASE_URL);
if (["prefer", "require", "verify-ca"].includes(url.searchParams.get("sslmode") || "")) {
  url.searchParams.set("sslmode", "verify-full");
}

const pool = new pg.Pool({ connectionString: url.toString(), max: 1 });
const identifier = `"${schema.replaceAll('"', '""')}"`;
try {
  await pool.query(mode === "create" ? `CREATE SCHEMA IF NOT EXISTS ${identifier}` : `DROP SCHEMA IF EXISTS ${identifier} CASCADE`);
  console.log(`${mode === "create" ? "Created" : "Dropped"} isolated QA schema ${schema}.`);
} finally {
  await pool.end();
}
