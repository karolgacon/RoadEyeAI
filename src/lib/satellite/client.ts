import { getAppEnv } from "@/lib/utils/env";
import { getEvalscript } from "@/lib/satellite/evalscript";
import { createMockSatelliteImage } from "@/lib/satellite/mock";
import {
  NoSceneAvailableError,
  RateLimitError,
  SatelliteConfigError,
  SatelliteError,
} from "@/lib/satellite/errors";
import type { SatelliteFetchRequest, SatelliteFetchResult } from "@/lib/satellite/types";
import type { EvalscriptId, SatelliteImageResponse } from "@/types/satellite";
import { randomUUID } from "node:crypto";

function readRequired(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new SatelliteConfigError(`Brak zmiennej środowiskowej ${name}`);
  }
  return value;
}

function hasCopernicusCredentials(): boolean {
  return Boolean(
    process.env.COPERNICUS_CLIENT_ID?.trim() &&
      process.env.COPERNICUS_CLIENT_SECRET?.trim(),
  );
}

async function getCopernicusToken(): Promise<string> {
  const clientId = readRequired("COPERNICUS_CLIENT_ID");
  const clientSecret = readRequired("COPERNICUS_CLIENT_SECRET");
  const tokenUrl =
    process.env.COPERNICUS_TOKEN_URL?.trim() ||
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (response.status === 429) {
    throw new RateLimitError();
  }
  if (!response.ok) {
    throw new SatelliteError(
      "UPSTREAM",
      `OAuth Copernicus nie powiódł się (${response.status})`,
    );
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new SatelliteConfigError("Brak access_token w odpowiedzi Copernicus");
  }
  return json.access_token;
}

async function fetchFromProcessApi(
  request: SatelliteFetchRequest,
): Promise<SatelliteImageResponse> {
  const token = await getCopernicusToken();
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
 */
export async function fetchSatelliteImage(
  request: SatelliteFetchRequest,
): Promise<SatelliteFetchResult> {
  const env = getAppEnv();
  const forcePreview = env.satelliteMockMode;
  const canUseLeo = hasCopernicusCredentials();

  let image: SatelliteImageResponse;

  if (!forcePreview && canUseLeo) {
    try {
      image = await fetchFromProcessApi(request);
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
  };
}

export function isEvalscriptId(value: string): value is EvalscriptId {
  return value === "true-color" || value === "ndvi" || value === "ndmi";
}
