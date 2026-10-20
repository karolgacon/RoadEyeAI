import { getAppEnv } from "@/lib/utils/env";
import { getEvalscript } from "@/lib/satellite/evalscript";
import { createMockSatelliteImage } from "@/lib/satellite/mock";
import { fetchEsriWorldImagerySnapshot } from "@/lib/satellite/esriSnapshot";
import {
  NoSceneAvailableError,
  RateLimitError,
  SatelliteError,
} from "@/lib/satellite/errors";
import {
  getCopernicusAccessToken,
  hasCopernicusCredentials,
} from "@/lib/satellite/token";
import type {
  HdPreviewImage,
  SatelliteFetchRequest,
  SatelliteFetchResult,
} from "@/lib/satellite/types";
import type { EvalscriptId, SatelliteImageResponse } from "@/types/satellite";
import { randomUUID } from "node:crypto";

async function fetchHdPreview(bbox: SatelliteFetchRequest["bbox"]): Promise<
  HdPreviewImage | undefined
> {
  try {
    const shot = await fetchEsriWorldImagerySnapshot({
      bbox,
      width: 1024,
      height: 1024,
    });
    return {
      imageUrl: shot.imageUrl,
      mimeType: shot.mimeType,
      width: shot.width,
      height: shot.height,
      source: "esri",
    };
  } catch (error) {
    console.warn(
      "[RoadEye AI] Esri HD preview failed:",
      error instanceof Error ? error.message : error,
    );
    return undefined;
  }
}

async function fetchFromProcessApi(
  request: SatelliteFetchRequest,
): Promise<SatelliteImageResponse> {
  const token = await getCopernicusAccessToken();
  const processUrl =
    process.env.COPERNICUS_PROCESS_API_URL?.trim() ||
    "https://sh.dataspace.copernicus.eu/api/v1/process";

  const width = request.width ?? 1024;
  const height = request.height ?? 1024;
  const [west, south, east, north] = request.bbox;

  const payload = {
    input: {
      bounds: {
        bbox: [west, south, east, north],
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from: `${request.dateFrom}T00:00:00Z`,
              to: `${request.dateTo}T23:59:59Z`,
            },
            maxCloudCoverage: 80,
          },
          processing: {
            upsampling: "BICUBIC",
            downsampling: "BICUBIC",
          },
        },
      ],
    },
    output: {
      width,
      height,
      responses: [
        {
          identifier: "default",
          format: { type: "image/png" },
        },
      ],
    },
    evalscript: getEvalscript(request.evalscriptId),
  };

  const response = await fetch(processUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  });

  if (response.status === 429) {
    throw new RateLimitError();
  }
  if (response.status === 400 || response.status === 404) {
    throw new NoSceneAvailableError();
  }
  if (!response.ok) {
    const text = await response.text();
    throw new SatelliteError(
      "UPSTREAM",
      `Process API error ${response.status}: ${text.slice(0, 180)}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const imageUrl = `data:image/png;base64,${buffer.toString("base64")}`;

  return {
    scanId: randomUUID(),
    source: "copernicus",
    bbox: request.bbox,
    acquiredAt: new Date(`${request.dateTo}T12:00:00Z`).toISOString(),
    cloudCoverage: 0.12,
    width,
    height,
    bands:
      request.evalscriptId === "true-color"
        ? ["RGB"]
        : request.evalscriptId === "ndvi"
          ? ["NDVI"]
          : ["NDMI"],
    imageUrl,
    mimeType: "image/png",
    evalscriptId: request.evalscriptId,
  };
}

/**
 * Prefer real Sentinel-2 LEO (Copernicus) when credentials exist and mock is off.
 * Otherwise Esri basemap preview (aligned to EPSG:4326 for OSM overlays).
 * When LEO succeeds, also attach an Esri HD frame for the same bbox (UI only).
 */
export async function fetchSatelliteImage(
  request: SatelliteFetchRequest,
): Promise<SatelliteFetchResult> {
  const env = getAppEnv();
  const forcePreview = env.satelliteMockMode;
  const canUseLeo = hasCopernicusCredentials();

  let image: SatelliteImageResponse;
  let hdPreview: HdPreviewImage | undefined;

  if (!forcePreview && canUseLeo) {
    try {
      const [leo, hd] = await Promise.all([
        fetchFromProcessApi(request),
        fetchHdPreview(request.bbox),
      ]);
      image = leo;
      hdPreview = hd;
    } catch (error) {
      console.warn(
        "[RoadEye AI] Sentinel-2/CDSE failed, falling back to Esri preview:",
        error instanceof Error ? error.message : error,
      );
      image = await createMockSatelliteImage({
        bbox: request.bbox,
        dateFrom: request.dateFrom,
        dateTo: request.dateTo,
        evalscriptId: request.evalscriptId,
        width: request.width,
        height: request.height,
      });
    }
  } else {
    if (!forcePreview && !canUseLeo) {
      console.warn(
        "[RoadEye AI] Brak COPERNICUS_CLIENT_ID/SECRET — używam Esri (nie LEO).",
      );
    }
    image = await createMockSatelliteImage({
      bbox: request.bbox,
      dateFrom: request.dateFrom,
      dateTo: request.dateTo,
      evalscriptId: request.evalscriptId,
      width: request.width,
      height: request.height,
    });
  }

  const cloudBlocked = image.cloudCoverage > env.cloudCoverageThreshold;

  return {
    image,
    cloudBlocked,
    threshold: env.cloudCoverageThreshold,
    hdPreview,
  };
}

export function isEvalscriptId(value: string): value is EvalscriptId {
  return value === "true-color" || value === "ndvi" || value === "ndmi";
}
