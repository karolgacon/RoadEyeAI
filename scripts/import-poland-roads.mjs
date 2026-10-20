import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const POLAND_BBOX = { west: 14.05, south: 49.0, east: 24.2, north: 54.9 };
const HIGHWAYS_DEFAULT = ["motorway", "trunk", "primary"];
const USER_AGENT = "RoadEyeAI/0.1 (road monitoring; local-dev)";

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }
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

function parseArgs(argv) {
  const args = {
    includeSecondary: false,
    secondaryOnly: false,
    bbox: null,
    tileSize: null,
  };
  for (const arg of argv) {
    if (arg === "--include-secondary") {
      args.includeSecondary = true;
    } else if (arg === "--secondary-only") {
      args.secondaryOnly = true;
      args.includeSecondary = true;
    } else if (arg.startsWith("--tile=")) {
      const n = Number(arg.slice("--tile=".length));
      if (Number.isFinite(n) && n > 0.05 && n <= 2) args.tileSize = n;
    } else if (arg.startsWith("--bbox=")) {
      const parts = arg
        .slice("--bbox=".length)
        .split(",")
        .map((n) => Number(n));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        args.bbox = {
          west: parts[0],
          south: parts[1],
          east: parts[2],
          north: parts[3],
        };
      }
    }
  }
  return args;
}

function buildTiles(bbox, size) {
  const tiles = [];
  for (let south = bbox.south; south < bbox.north; south += size) {
    for (let west = bbox.west; west < bbox.east; west += size) {
      tiles.push({
        west,
        south,
        east: Math.min(west + size, bbox.east),
        north: Math.min(south + size, bbox.north),
      });
    }
  }
  return tiles;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

async function fetchOverpass(query, attempt = 1) {
  const url = OVERPASS_URLS[(attempt - 1) % OVERPASS_URLS.length];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);
  try {
    if (attempt > 1) {
      log(`  retry ${attempt}/8 → ${url}`);
    }
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      if (attempt < 8) {
        await sleep(2000 * attempt);
        return fetchOverpass(query, attempt + 1);
      }
      throw new Error(`Overpass HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    return response.json();
  } catch (error) {
    if (attempt < 8) {
      await sleep(2000 * attempt);
      return fetchOverpass(query, attempt + 1);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function wayToLineString(way) {
  if (!Array.isArray(way.geometry) || way.geometry.length < 2) {
    return null;
  }
  return {
    type: "LineString",
    coordinates: way.geometry.map((p) => [p.lon, p.lat]),
  };
}

function buildQuery(tile, highways) {
  const filters = highways
    .map(
      (h) =>
        `way["highway"="${h}"](${tile.south},${tile.west},${tile.north},${tile.east});`,
    )
    .join("\n  ");
  return `
[out:json][timeout:60];
(
  ${filters}
);
out geom;
`.trim();
}

async function upsertWays(client, ways, highways) {
  let upserted = 0;
  await client.query("BEGIN");
  try {
    for (const way of ways) {
      const highway = way.tags?.highway;
      if (!highway || !highways.includes(highway)) continue;
      const geom = wayToLineString(way);
      if (!geom) continue;

      const osmId = `way/${way.id}`;
      const name = way.tags?.name ?? null;
      const ref = way.tags?.ref ?? null;

      await client.query(
        `
        INSERT INTO roads (osm_id, name, road_class, ref, geom)
        VALUES (
          $1, $2, $3, $4,
          ST_SimplifyPreserveTopology(
            ST_SetSRID(ST_GeomFromGeoJSON($5), 4326),
            0.00005
          )
        )
        ON CONFLICT (osm_id) DO UPDATE SET
          name = EXCLUDED.name,
          road_class = EXCLUDED.road_class,
          ref = EXCLUDED.ref,
          geom = EXCLUDED.geom,
          updated_at = now()
        `,
        [osmId, name, highway, ref, JSON.stringify(geom)],
      );
      upserted += 1;
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  return upserted;
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL");
  }

  const highways = args.secondaryOnly
    ? ["secondary"]
    : args.includeSecondary
      ? [...HIGHWAYS_DEFAULT, "secondary"]
      : HIGHWAYS_DEFAULT;

  // Smaller tiles when secondary is included — Overpass times out on 1° cells.
  const tileSize =
    args.tileSize ??
    (args.includeSecondary || args.secondaryOnly ? 0.5 : 1.0);

  const area = args.bbox ?? POLAND_BBOX;
  const tiles = buildTiles(area, tileSize);

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  log(
    `Import RoadEye AI: ${tiles.length} tiles @ ${tileSize}°, highways=${highways.join(",")}`,
  );

  let total = 0;
  let errors = 0;
  for (let i = 0; i < tiles.length; i += 1) {
    const tile = tiles[i];
    process.stdout.write(
      `[${i + 1}/${tiles.length}] ${tile.west.toFixed(2)},${tile.south.toFixed(2)} … `,
    );
    try {
      const data = await fetchOverpass(buildQuery(tile, highways));
      const ways = Array.isArray(data.elements)
        ? data.elements.filter((el) => el.type === "way")
        : [];
      const upserted = await upsertWays(client, ways, highways);
      total += upserted;
      log(`${ways.length} ways → ${upserted} upsert`);
    } catch (error) {
      errors += 1;
      log(`ERROR: ${error instanceof Error ? error.message : error}`);
    }
    await sleep(900);
  }

  const count = await client.query(`SELECT COUNT(*)::int AS n FROM roads`);
  const byClass = await client.query(
    `SELECT road_class, COUNT(*)::int AS n FROM roads GROUP BY 1 ORDER BY 1`,
  );
  log(
    `Done. Upserted this run≈${total}. Errors=${errors}. Total roads=${count.rows[0].n}`,
  );
  for (const row of byClass.rows) {
    log(`  ${row.road_class}: ${row.n}`);
  }
  await client.end();
  if (errors > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
