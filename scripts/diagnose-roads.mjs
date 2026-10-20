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

const total = await client.query("SELECT COUNT(*)::int AS n FROM roads");
const seed = await client.query(
  "SELECT COUNT(*)::int AS n FROM roads WHERE osm_id LIKE 'seed/%'",
);
const aoi = await client.query(
  "SELECT COUNT(*)::int AS n FROM roads WHERE osm_id LIKE 'aoi/%'",
);
const osm = await client.query(
  "SELECT COUNT(*)::int AS n FROM roads WHERE osm_id LIKE 'way/%'",
);
const byClass = await client.query(
  "SELECT road_class, COUNT(*)::int AS n FROM roads GROUP BY 1 ORDER BY 1",
);
const samples = await client.query(`
  SELECT osm_id, ref, name, road_class,
         ROUND(ST_Length(geom::geography)::numeric, 0) AS len_m
  FROM roads
  ORDER BY
    CASE WHEN osm_id LIKE 'seed/%' THEN 0 ELSE 1 END,
    len_m DESC NULLS LAST
  LIMIT 12
`);

console.log(
  JSON.stringify(
    {
      total: total.rows[0].n,
      seedApprox: seed.rows[0].n,
      aoiAuto: aoi.rows[0].n,
      osmWays: osm.rows[0].n,
      byClass: byClass.rows,
      samples: samples.rows,
    },
    null,
    2,
  ),
);

await client.end();
