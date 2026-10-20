import { NextResponse } from "next/server";
import { getEvalscript } from "@/lib/satellite/evalscript";
import { fetchEsriWorldImagerySnapshot } from "@/lib/satellite/esriSnapshot";
import {
  hasCopernicusCredentials,
  getCopernicusAccessToken,
} from "@/lib/satellite/token";
import { isoDateDaysAgo, xyzToBbox } from "@/lib/satellite/mercatorTile";
import { getAppEnv } from "@/lib/utils/env";
import {
  checkRateLimit,
  clientIpFromRequest,
} from "@/lib/http/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

const TILE_SIZE = 256;
const MIN_Z = 6;
const MAX_Z = 15;

function parseTileParam(value: string, max: number): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) {
    return null;
  }
  return n;
}

async function fetchLeoTile(bbox: ReturnType<typeof xyzToBbox>): Promise<Buffer> {
  const token = await getCopernicusAccessToken();
  const processUrl =
    process.env.COPERNICUS_PROCESS_API_URL?.trim() ||
    "https://sh.dataspace.copernicus.eu/api/v1/process";
  const [west, south, east, north] = bbox;

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
              from: `${isoDateDaysAgo(45)}T00:00:00Z`,
              to: `${isoDateDaysAgo(0)}T23:59:59Z`,
            },
            maxCloudCoverage: 60,
          },
          processing: {
            upsampling: "BICUBIC",
            downsampling: "BICUBIC",
          },
        },
      ],
    },
    output: {
      width: TILE_SIZE,
      height: TILE_SIZE,
      responses: [
        {
          identifier: "default",
          format: { type: "image/png" },
        },
      ],
    },
    evalscript: getEvalscript("true-color"),
  };

  const response = await fetch(processUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Process API tile HTTP ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function fetchEsriTile(bbox: ReturnType<typeof xyzToBbox>): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const shot = await fetchEsriWorldImagerySnapshot({
    bbox,
    width: TILE_SIZE,
    height: TILE_SIZE,
  });
  const base64 = shot.imageUrl.replace(/^data:image\/\w+;base64,/, "");
  return {
    buffer: Buffer.from(base64, "base64"),
    contentType: shot.mimeType,
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const ip = clientIpFromRequest(request);
  const limit = checkRateLimit({
    key: `basemap:${ip}`,
    limit: 180,
    windowMs: 60_000,
  });
  if (!limit.ok) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSec) },
    });
  }

  const { z: zRaw, x: xRaw, y: yRaw } = await context.params;
  const z = parseTileParam(zRaw, 22);
  if (z === null || z < MIN_Z || z > MAX_Z) {
    return new NextResponse("Invalid zoom", { status: 400 });
  }
  const maxIndex = 2 ** z - 1;
  const x = parseTileParam(xRaw, maxIndex);
  const y = parseTileParam(yRaw.replace(/\.png$/i, ""), maxIndex);
  if (x === null || y === null) {
    return new NextResponse("Invalid tile", { status: 400 });
  }

  const bbox = xyzToBbox(z, x, y);
  const env = getAppEnv();
  const canLeo =
    !env.satelliteMockMode && hasCopernicusCredentials();

  try {
    if (canLeo) {
      try {
        const png = await fetchLeoTile(bbox);
        return new NextResponse(new Uint8Array(png), {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
            "X-RoadEye-Basemap": "sentinel-2-leo",
          },
        });
      } catch (error) {
        console.warn(
          "[RoadEye AI] LEO basemap tile failed, Esri fallback:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    const esri = await fetchEsriTile(bbox);
    return new NextResponse(new Uint8Array(esri.buffer), {
      status: 200,
      headers: {
        "Content-Type": esri.contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
        "X-RoadEye-Basemap": "esri-fallback",
      },
    });
  } catch (error) {
    console.error(
      "[RoadEye AI] Basemap tile error:",
      error instanceof Error ? error.message : error,
    );
    return new NextResponse("Basemap unavailable", { status: 502 });
  }
}
