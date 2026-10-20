/**
 * DEPRECATED for map display.
 * Approximate straight-line corridors do NOT follow real roads and confuse the UI.
 * Prefer: npm run import:roads
 * This script is kept only as an emergency offline fallback — do not use in normal flow.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

const SEED = [
  {
    osm_id: "seed/A2",
    name: "Autostrada A2",
    road_class: "motorway",
    ref: "A2",
    coordinates: [
      [14.6, 52.4],
      [16.9, 52.4],
      [19.0, 52.2],
      [21.0, 52.15],
      [22.7, 52.1],
    ],
  },
  {
    osm_id: "seed/A4",
    name: "Autostrada A4",
    road_class: "motorway",
    ref: "A4",
    coordinates: [
      [15.0, 51.1],
      [17.0, 51.1],
      [19.0, 50.1],
      [20.0, 50.05],
      [22.0, 49.8],
    ],
  },
  {
    osm_id: "seed/A1",
    name: "Autostrada A1",
    road_class: "motorway",
    ref: "A1",
    coordinates: [
      [18.6, 54.4],
      [18.7, 53.0],
      [19.2, 51.8],
      [19.1, 50.3],
    ],
  },
  {
    osm_id: "seed/S8",
    name: "Ekspresowa S8",
    road_class: "trunk",
    ref: "S8",
    coordinates: [
      [17.0, 51.1],
      [19.5, 51.8],
      [21.0, 52.2],
      [22.5, 53.1],
    ],
  },
  {
    osm_id: "seed/S7",
    name: "Ekspresowa S7",
    road_class: "trunk",
    ref: "S7",
    coordinates: [
      [18.6, 54.35],
      [20.5, 52.8],
      [21.0, 52.2],
      [20.0, 50.05],
      [19.9, 49.5],
    ],
  },
  {
    osm_id: "seed/DK7",
    name: "Droga krajowa 7",
    road_class: "primary",
    ref: "DK7",
    coordinates: [
      [18.65, 54.35],
      [20.6, 52.9],
      [21.0, 52.23],
      [20.0, 50.06],
      [19.95, 49.42],
    ],
  },
  {
    osm_id: "seed/DK8",
    name: "Droga krajowa 8",
    road_class: "primary",
    ref: "DK8",
    coordinates: [
      [16.95, 51.1],
      [19.0, 51.75],
      [21.0, 52.25],
      [23.1, 53.15],
    ],
  },
  {
    osm_id: "seed/S17",
    name: "Ekspresowa S17",
    road_class: "trunk",
    ref: "S17",
    coordinates: [
      [21.05, 52.2],
      [21.5, 51.5],
      [22.55, 51.25],
    ],
  },
];

loadEnvLocal();
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

let n = 0;
for (const road of SEED) {
  const geojson = JSON.stringify({
    type: "LineString",
    coordinates: road.coordinates,
  });
  await client.query(
    `
    INSERT INTO roads (osm_id, name, road_class, ref, geom, latest_pci)
    VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326), NULL)
    ON CONFLICT (osm_id) DO UPDATE SET
      name = EXCLUDED.name,
      road_class = EXCLUDED.road_class,
      ref = EXCLUDED.ref,
      geom = EXCLUDED.geom,
      updated_at = now()
    `,
    [road.osm_id, road.name, road.road_class, road.ref, geojson],
  );
  n += 1;
}

const count = await client.query(`SELECT COUNT(*)::int AS n FROM roads`);
console.log(`Seeded ${n} corridors. Total roads=${count.rows[0].n}`);
await client.end();
