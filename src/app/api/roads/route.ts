import { NextResponse } from "next/server";
import { findRoadsInBbox } from "@/lib/db/roads";
import { parseBboxParam } from "@/lib/map/geo";
import { TtlCache } from "@/lib/cache/ttlCache";
import { errorResponse } from "@/lib/http/apiErrors";
import type { RoadClass, RoadSegment } from "@/types/road";

export const dynamic = "force-dynamic";

const ROAD_CLASSES = new Set<RoadClass>([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
]);

const roadsCache = new TtlCache<{
  count: number;
  limit: number;
  bbox: [number, number, number, number];
  class: RoadClass | "all";
  roads: RoadSegment[];
}>(30_000, 120);

function parseClassParam(raw: string | null): RoadClass | "all" {
  if (!raw || raw === "all") {
    return "all";
  }
  return ROAD_CLASSES.has(raw as RoadClass) ? (raw as RoadClass) : "all";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bbox = parseBboxParam(searchParams.get("bbox"));
  if (!bbox) {
    return errorResponse(400, {
      code: "VALIDATION",
      message: "Query param bbox=west,south,east,north is required",
    });
  }

  const limitRaw = Number(searchParams.get("limit") ?? "2000");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), 5000)
    : 2000;
  const roadClass = parseClassParam(searchParams.get("class"));
  const cacheKey = `${bbox.map((n) => n.toFixed(4)).join(",")}|${limit}|${roadClass}`;

  const cached = roadsCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "X-Cache": "HIT",
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    });
  }

  try {
    const roads = await findRoadsInBbox(bbox, limit, roadClass);
    const body = {
      count: roads.length,
      limit,
      bbox,
      class: roadClass,
      roads,
    };
    roadsCache.set(cacheKey, body);
    return NextResponse.json(body, {
      headers: {
        "X-Cache": "MISS",
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(500, {
      code: "INTERNAL",
      message,
    });
  }
}
