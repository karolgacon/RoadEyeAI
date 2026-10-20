import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchSatelliteImage, isEvalscriptId } from "@/lib/satellite/client";
import { SatelliteError } from "@/lib/satellite/errors";
import { persistSatelliteScan } from "@/lib/db/scans";
import type { ApiErrorBody } from "@/types/analysis";
import type { BBox } from "@/types/satellite";
import {
  checkRateLimit,
  clientIpFromRequest,
} from "@/lib/http/rateLimit";
import { rateLimitedResponse } from "@/lib/http/apiErrors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  evalscriptId: z.string().default("true-color"),
  roadId: z.string().uuid().optional().nullable(),
});

function errorResponse(status: number, body: ApiErrorBody) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const limit = checkRateLimit({
    key: `satellite:${ip}`,
    limit: 20,
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
      message: "Niepoprawne dane wejściowe",
      details: parsed.error.flatten(),
    });
  }

  const { bbox, dateFrom, dateTo, evalscriptId, roadId } = parsed.data;
  if (!isEvalscriptId(evalscriptId)) {
    return errorResponse(400, {
      code: "VALIDATION",
      message: "evalscriptId musi być true-color | ndvi | ndmi",
    });
  }

  const [west, south, east, north] = bbox as BBox;
  if (west >= east || south >= north) {
    return errorResponse(400, {
      code: "VALIDATION",
      message: "bbox jest niepoprawny (west < east, south < north)",
    });
  }

  try {
    const result = await fetchSatelliteImage({
      bbox: [west, south, east, north],
      dateFrom,
      dateTo,
      evalscriptId,
      roadId,
    });

    const saved = await persistSatelliteScan({
      image: result.image,
      roadId,
    });

    return NextResponse.json({
      ok: true,
      cloudBlocked: result.cloudBlocked,
      threshold: result.threshold,
      image: saved,
      message: result.cloudBlocked
        ? `Zachmurzenie ${(saved.cloudCoverage * 100).toFixed(0)}% > próg ${(result.threshold * 100).toFixed(0)}% — analiza AI będzie zablokowana`
        : undefined,
    });
  } catch (error) {
    if (error instanceof SatelliteError) {
      const status =
        error.code === "CONFIG"
          ? 503
          : error.code === "RATE_LIMIT"
            ? 429
            : error.code === "NO_SCENE"
              ? 404
              : 502;
      return errorResponse(status, {
        code: error.code,
        message: error.message,
      });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(500, {
      code: "INTERNAL",
      message,
    });
  }
}
