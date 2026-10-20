import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq);
  const value = trimmed.slice(eq + 1);
  if (!process.env[key]) process.env[key] = value;
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const result = await client.query(`
  UPDATE roads
  SET latest_pci = NULL, latest_analyzed_at = NULL, updated_at = now()
  WHERE osm_id LIKE 'seed/%' OR latest_pci IS NOT NULL
`);
console.log("Cleared demo/placeholder PCI on", result.rowCount, "rows");
await client.end();
