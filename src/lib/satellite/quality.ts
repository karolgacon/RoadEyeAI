import type { BBox } from "@/types/satellite";
import { getCopernicusAccessToken } from "@/lib/satellite/token";
import { RateLimitError, SatelliteError } from "@/lib/satellite/errors";

/** SCL cloud / shadow / cirrus classes (L2A). */
const CLOUD_SCL = new Set([3, 7, 8, 9, 10]);

const CLOUD_EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: ["SCL", "B04", "dataMask"],
    output: [
      { id: "cloud", bands: 1, sampleType: "FLOAT32" },
      { id: "texture", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(sample) {
  const scl = sample.SCL;
  const cloudy = (scl === 3 || scl === 7 || scl === 8 || scl === 9 || scl === 10) ? 1 : 0;
  return {
    cloud: [cloudy],
    texture: [sample.B04],
    dataMask: [sample.dataMask]
  };
}
`.trim();

export interface LeoQuality {
  /** Fraction of valid pixels classified as cloud/shadow/cirrus (SCL). */
  cloudCoverage: number;
  /** Std-dev of B04 among valid pixels — low = flat/blurry/uniform scene. */
  textureScore: number;
  usable: boolean;
  reason: "ok" | "clouds" | "blur" | "stats_failed";
}

export function assessLeoUsability(
  cloudCoverage: number,
  textureScore: number,
  options?: {
    cloudThreshold?: number;
    /** Below this B04 std-dev the frame is treated as unusable blur/haze. */
    minTexture?: number;
  },
): LeoQuality {
  const cloudThreshold = options?.cloudThreshold ?? 0.35;
  const minTexture = options?.minTexture ?? 0.018;

  if (cloudCoverage > cloudThreshold) {
    return {
      cloudCoverage,
      textureScore,
      usable: false,
      reason: "clouds",
    };
  }
  if (textureScore < minTexture) {
    return {
      cloudCoverage,
      textureScore,
      usable: false,
      reason: "blur",
    };
  }
  return {
    cloudCoverage,
    textureScore,
    usable: true,
    reason: "ok",
  };
}

function readStatMean(band: unknown): number | null {
  if (!band || typeof band !== "object") {
    return null;
  }
  const stats = (band as { stats?: { mean?: number; stDev?: number } }).stats;
  if (!stats || typeof stats.mean !== "number" || Number.isNaN(stats.mean)) {
    return null;
  }
  return stats.mean;
}

function readStatStdev(band: unknown): number | null {
  if (!band || typeof band !== "object") {
    return null;
  }
  const stats = (band as { stats?: { stDev?: number } }).stats;
  if (!stats || typeof stats.stDev !== "number" || Number.isNaN(stats.stDev)) {
    return null;
  }
  return stats.stDev;
}

/**
 * Real SCL cloud fraction + B04 texture via CDSE Statistical API
 * for the same mosaic window used by Process API.
 */
export async function measureLeoQuality(params: {
  bbox: BBox;
  dateFrom: string;
  dateTo: string;
}): Promise<LeoQuality> {
  try {
    const token = await getCopernicusAccessToken();
    const statsUrl =
      process.env.COPERNICUS_STATS_API_URL?.trim() ||
      "https://sh.dataspace.copernicus.eu/api/v1/statistics";
    const [west, south, east, north] = params.bbox;

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
                from: `${params.dateFrom}T00:00:00Z`,
                to: `${params.dateTo}T23:59:59Z`,
              },
              maxCloudCoverage: 100,
              mosaickingOrder: "leastCC",
            },
          },
        ],
      },
      aggregation: {
        timeRange: {
          from: `${params.dateFrom}T00:00:00Z`,
          to: `${params.dateTo}T23:59:59Z`,
        },
        aggregationInterval: { of: "P365D" },
        evalscript: CLOUD_EVALSCRIPT,
        resx: 0.0002,
        resy: 0.0002,
      },
      calculations: {
        default: {},
      },
    };

    const response = await fetch(statsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45_000),
    });

    if (response.status === 429) {
      throw new RateLimitError();
    }
    if (!response.ok) {
      const text = await response.text();
      throw new SatelliteError(
        "UPSTREAM",
        `Stats API ${response.status}: ${text.slice(0, 160)}`,
      );
    }

    const json = (await response.json()) as {
      data?: Array<{
        outputs?: {
          cloud?: { bands?: Record<string, unknown> };
          texture?: { bands?: Record<string, unknown> };
        };
      }>;
    };

    const outputs = json.data?.[0]?.outputs;
    const cloudBand =
      outputs?.cloud?.bands?.B0 ??
      outputs?.cloud?.bands?.["0"] ??
      Object.values(outputs?.cloud?.bands ?? {})[0];
    const textureBand =
      outputs?.texture?.bands?.B0 ??
      outputs?.texture?.bands?.["0"] ??
      Object.values(outputs?.texture?.bands ?? {})[0];

    const cloudMean = readStatMean(cloudBand);
    const textureStd = readStatStdev(textureBand);

    if (cloudMean === null || textureStd === null) {
      console.warn("[RoadEye AI] Stats API missing cloud/texture bands", json);
      return {
        cloudCoverage: 0.5,
        textureScore: 0,
        usable: false,
        reason: "stats_failed",
      };
    }

    const cloudCoverage = Math.min(1, Math.max(0, cloudMean));
    const textureScore = Math.max(0, textureStd);
    return assessLeoUsability(cloudCoverage, textureScore);
  } catch (error) {
    console.warn(
      "[RoadEye AI] LEO quality measurement failed:",
      error instanceof Error ? error.message : error,
    );
    return {
      cloudCoverage: 0.5,
      textureScore: 0,
      usable: false,
      reason: "stats_failed",
    };
  }
}

export function qualityReasonPl(reason: LeoQuality["reason"]): string {
  switch (reason) {
    case "clouds":
      return "LEO zbyt zachmurzony (SCL)";
    case "blur":
      return "LEO zbyt jednolity / rozmazany";
    case "stats_failed":
      return "Nie udało się zmierzyć jakości LEO";
    default:
      return "LEO nadaje się do analizy";
  }
}

/** Exported for unit tests — SCL cloud class set. */
export function isCloudScl(scl: number): boolean {
  return CLOUD_SCL.has(scl);
}
