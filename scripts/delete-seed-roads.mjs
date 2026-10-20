import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  const k = t.slice(0, i);
  const v = t.slice(i + 1);
  if (!process.env[k]) process.env[k] = v;
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const deleted = await client.query(
  "DELETE FROM roads WHERE osm_id LIKE 'seed/%'",
);
const remaining = await client.query("SELECT COUNT(*)::int AS n FROM roads");
console.log("deleted seed rows:", deleted.rowCount);
console.log("remaining roads:", remaining.rows[0].n);
await client.end();
