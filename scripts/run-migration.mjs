import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(1);
}

const sqlPath = path.join(root, "supabase/migrations/001_init_postgis.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query(sql);

const result = await client.query(`
  SELECT tablename
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('roads', 'satellite_scans', 'analysis_reports')
  ORDER BY 1
`);

console.log(
  "OK tables:",
  result.rows.map((row) => row.tablename).join(", "),
);

await client.end();
