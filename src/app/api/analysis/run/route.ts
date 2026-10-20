import { NextResponse } from "next/server";
import { z } from "zod";
import { getSatelliteScanById } from "@/lib/db/scans";
import { saveAnalysisReport } from "@/lib/db/reports";
import { findRoadById } from "@/lib/db/roads";
import { getPgPool } from "@/lib/db/pg";
import { runRoadVisionAnalysis } from "@/lib/ai/vision";
import { CloudBlockedError } from "@/lib/satellite/errors";
import type { ApiErrorBody } from "@/types/analysis";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import {
  checkRateLimit,
  clientIpFromRequest,
} from "@/lib/http/rateLimit";
import { rateLimitedResponse } from "@/lib/http/apiErrors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  scanId: z.string().uuid(),
  roadId: z.string().uuid().optional().nullable(),
});

function errorResponse(status: number, body: ApiErrorBody) {
  return NextResponse.json(body, { status });
}

async function ensureRoadId(
  roadId: string | null | undefined,
  bbox: [number, number, number, number],
): Promise<string> {
  if (roadId) {
    return roadId;
  }

  const pool = getPgPool();
  const id = randomUUID();
  const [west, south, east, north] = bbox;
  const midLat = (south + north) / 2;
  const lineWkt = `LINESTRING(${west} ${midLat}, ${east} ${midLat})`;

  await pool.query(
    `
    INSERT INTO roads (id, osm_id, name, road_class, ref, geom)
    VALUES (
      $1, $2, $3, 'primary', 'AOI',
      ST_SetSRID(ST_GeomFromText($4), 4326)
    )
    `,
    [id, `aoi/${id}`, "Odcinek AOI (auto)", lineWkt],
  );

  return id;
}

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const limit = checkRateLimit({
    key: `analysis:${ip}`,
    limit: 12,
    windowMs: 60_000,
  });
  if (!limit.ok) {
    return rateLimitedResponse(limit.retryAfterSec);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return errorResponse(400, {
      code: "VALIDATION",
      message: "Niepoprawny JSON",
    });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, {
      code: "VALIDATION",
      message: "Wymagane: scanId (uuid), opcjonalnie roadId",
      details: parsed.error.flatten(),
    });
  }

  try {
    const scan = await getSatelliteScanById(parsed.data.scanId);
    if (!scan) {
      return errorResponse(404, {
        code: "NO_SCENE",
        message: "Nie znaleziono skanu satelitarnego",
      });
    }

    const roadId = await ensureRoadId(parsed.data.roadId, scan.bbox);
    const road = await findRoadById(roadId);

    const vision = await runRoadVisionAnalysis({
      imageUrl: scan.imageUrl,
      bbox: scan.bbox,
      cloudCoverage: scan.cloudCoverage,
      evalscriptId: scan.evalscriptId,
      source: scan.source,
      roadGeometry: road?.geometryGeoJson ?? null,
    });

    const report = await saveAnalysisReport({
      roadId,
      scanId: scan.scanId,
      result: vision.result,
      modelId: vision.modelId,
      raw: vision.raw,
    });

    return NextResponse.json({
      ok: true,
      provider: vision.provider,
      modelId: vision.modelId,
      report,
      evidence: {
        imageUrl: scan.imageUrl,
        bbox: scan.bbox,
        width: scan.width,
        height: scan.height,
        source: scan.source,
      },
    });

  } catch (error) {
    if (error instanceof CloudBlockedError) {
      return errorResponse(422, {
        code: "CLOUD_BLOCKED",
        message: error.message,
      });
    }
    if (error instanceof ZodError) {
      return errorResponse(422, {
        code: "VALIDATION",
        message: "Odpowiedź modelu nie przeszła walidacji schematu",
        details: error.flatten(),
      });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    const code =
      message.includes("API_KEY") || message.includes("GOOGLE_GENERATIVE")
        ? "CONFIG"
        : message.toLowerCase().includes("rate")
          ? "RATE_LIMIT"
          : "UPSTREAM";
    return errorResponse(code === "CONFIG" ? 503 : 502, {
      code,
      message,
    });
  }
}
