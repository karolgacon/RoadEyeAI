import type { RoadClass, RoadSegment } from "@/types/road";
import type { PciScore } from "@/types/pci";
import { isPciScore } from "@/types/pci";
import type { BBox } from "@/types/satellite";
import { getPgPool } from "@/lib/db/pg";

interface RoadsInBboxRow {
  id: string;
  osm_id: string | null;
  name: string | null;
  road_class: string;
  ref: string | null;
  latest_pci: number | null;
  latest_analyzed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  geojson: GeoJSON.LineString | GeoJSON.MultiLineString | string;
}

const ROAD_CLASSES = new Set<RoadClass>([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
]);

function toIso(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function parseGeoJson(
  value: RoadsInBboxRow["geojson"],
): GeoJSON.LineString | GeoJSON.MultiLineString {
  const parsed = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "type" in parsed &&
    (parsed.type === "LineString" || parsed.type === "MultiLineString")
  ) {
    return parsed as GeoJSON.LineString | GeoJSON.MultiLineString;
  }
  throw new Error("Invalid road geometry GeoJSON");
}

function mapRow(row: RoadsInBboxRow): RoadSegment {
  const roadClass = ROAD_CLASSES.has(row.road_class as RoadClass)
    ? (row.road_class as RoadClass)
    : "unclassified";
  const pci =
    row.latest_pci !== null && isPciScore(row.latest_pci)
      ? (row.latest_pci as PciScore)
      : null;

  return {
    id: row.id,
    osmId: row.osm_id,
    name: row.name,
    roadClass,
    ref: row.ref,
    geometryGeoJson: parseGeoJson(row.geojson),
    latestPci: pci,
    latestAnalyzedAt: toIso(row.latest_analyzed_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

export async function findRoadsInBbox(
  bbox: BBox,
  limit = 2000,
  roadClass: RoadClass | "all" = "all",
): Promise<RoadSegment[]> {
  const pool = getPgPool();
  const [west, south, east, north] = bbox;
  const classFilter = roadClass === "all" ? null : roadClass;
  const result = await pool.query<RoadsInBboxRow>(
    `
    SELECT
      r.id,
      r.osm_id,
      r.name,
      r.road_class,
      r.ref,
      r.latest_pci,
      r.latest_analyzed_at,
      r.created_at,
      r.updated_at,
      ST_AsGeoJSON(r.geom)::json AS geojson
    FROM roads r
    WHERE r.geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      AND ST_Intersects(
        r.geom,
        ST_MakeEnvelope($1, $2, $3, $4, 4326)
      )
      AND ($6::text IS NULL OR r.road_class = $6)
    ORDER BY
      CASE r.road_class
        WHEN 'motorway' THEN 1
        WHEN 'trunk' THEN 2
        WHEN 'primary' THEN 3
        WHEN 'secondary' THEN 4
        ELSE 5
      END,
      r.ref NULLS LAST
    LIMIT GREATEST(1, LEAST($5::int, 5000))
    `,
    [west, south, east, north, limit, classFilter],
  );
  return result.rows.map(mapRow);
}

export async function findRoadById(id: string): Promise<RoadSegment | null> {
  const pool = getPgPool();
  const result = await pool.query<RoadsInBboxRow>(
    `
    SELECT
      id,
      osm_id,
      name,
      road_class,
      ref,
      latest_pci,
      latest_analyzed_at,
      created_at,
      updated_at,
      ST_AsGeoJSON(geom)::json AS geojson
    FROM roads
    WHERE id = $1
    LIMIT 1
    `,
    [id],
  );
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

export async function countRoads(): Promise<number> {
  const pool = getPgPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM roads`,
  );
  return Number(result.rows[0]?.count ?? 0);
}
