import { PNG } from "pngjs";
import type { BBox } from "@/types/satellite";
import { getCopernicusAccessToken } from "@/lib/satellite/token";
import { RateLimitError, SatelliteError } from "@/lib/satellite/errors";

/** SCL cloud / shadow / cirrus / unclassified (L2A). */
const CLOUD_SCL = new Set([3, 7, 8, 9, 10]);

const CLOUD_EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: ["SCL", "B04", "dataMask"],
    output: [
      { id: "cloud", bands: ["c"], sampleType: "FLOAT32" },
      { id: "texture", bands: ["t"], sampleType: "FLOAT32" },
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
  /** Fraction of valid pixels classified as cloud/shadow/cirrus (SCL) or bright-pixel proxy. */
  cloudCoverage: number;
  /** Texture score 0–1-ish — low = flat/blurry/uniform scene. */
  textureScore: number;
  usable: boolean;
  reason: "ok" | "clouds" | "blur" | "stats_failed";
  /** Where cloud/texture numbers came from. */
  measuredBy?: "scl_stats" | "png_heuristic" | "none";
}

export function assessLeoUsability(
  cloudCoverage: number,
  textureScore: number,
  options?: {
    cloudThreshold?: number;
    /** Below this texture the frame is treated as unusable blur/haze. */
    minTexture?: number;
  },
): Omit<LeoQuality, "measuredBy"> {
  // Allow moderate cloud if road structure is still visible (user feedback).
  const cloudThreshold = options?.cloudThreshold ?? 0.55;
  const minTexture = options?.minTexture ?? 0.012;

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

function firstBand(bands: Record<string, unknown> | undefined): unknown {
  if (!bands) {
    return null;
  }
  return (
    bands.c ??
    bands.t ??
    bands.B0 ??
    bands["0"] ??
    Object.values(bands)[0] ??
    null
  );
}

/**
 * Heuristic from the actual LEO PNG we already fetched:
 * bright-pixel share ≈ cloud/haze, luminance std-dev ≈ texture/detail.
 */
export function estimateQualityFromPng(pngBuffer: Buffer): LeoQuality {
  try {
    const png = PNG.sync.read(pngBuffer);
    const { data, width, height } = png;
    const n = width * height;
    if (n < 16) {
      return {
        cloudCoverage: 0,
        textureScore: 1,
        usable: true,
        reason: "ok",
        measuredBy: "png_heuristic",
      };
    }

    let sum = 0;
    let sum2 = 0;
    let bright = 0;
    for (let i = 0; i < data.length; i += 4) {
      const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += y;
      sum2 += y * y;
      // Near-white / saturated haze
      if (y >= 210) {
        bright += 1;
      }
    }

    const mean = sum / n;
    const variance = Math.max(0, sum2 / n - mean * mean);
    const stdNorm = Math.sqrt(variance) / 255;
    const cloudApprox = bright / n;

    const assessed = assessLeoUsability(cloudApprox, stdNorm, {
      // PNG bright-pixel proxy is noisier than SCL — be slightly stricter on clouds,
      // milder on texture (S2 true-color is naturally soft).
      cloudThreshold: 0.62,
      minTexture: 0.01,
    });

    return {
      ...assessed,
      measuredBy: "png_heuristic",
    };
  } catch (error) {
    console.warn(
      "[RoadEye AI] PNG quality heuristic failed:",
      error instanceof Error ? error.message : error,
    );
    // If we have a LEO frame but cannot score it, prefer analyzing LEO over HD.
    return {
      cloudCoverage: 0,
      textureScore: 1,
      usable: true,
      reason: "ok",
      measuredBy: "none",
    };
  }
}

async function measureViaStatsApi(params: {
  bbox: BBox;
  dateFrom: string;
  dateTo: string;
}): Promise<LeoQuality | null> {
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
      resx: 0.0003,
      resy: 0.0003,
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
  const cloudBand = firstBand(outputs?.cloud?.bands);
  const textureBand = firstBand(outputs?.texture?.bands);
  const cloudMean = readStatMean(cloudBand);
  const textureStd = readStatStdev(textureBand);

  if (cloudMean === null || textureStd === null) {
    console.warn(
      "[RoadEye AI] Stats API missing cloud/texture bands:",
      JSON.stringify(outputs)?.slice(0, 400),
    );
    return null;
  }

  const cloudCoverage = Math.min(1, Math.max(0, cloudMean));
  // B04 reflectance std-dev is typically small (0.01–0.1); keep as-is.
  const textureScore = Math.max(0, textureStd);
  return {
    ...assessLeoUsability(cloudCoverage, textureScore),
    measuredBy: "scl_stats",
  };
}

/**
 * Prefer SCL Statistical API; fall back to PNG heuristic on the LEO frame.
 * Never invent "50% / 0.000 → reject" — that was a false gate.
 */
export async function measureLeoQuality(params: {
  bbox: BBox;
  dateFrom: string;
  dateTo: string;
  /** Raw LEO PNG bytes from Process API (preferred fallback). */
  leoPng?: Buffer;
}): Promise<LeoQuality> {
  try {
    const fromStats = await measureViaStatsApi(params);
    if (fromStats) {
      return fromStats;
    }
  } catch (error) {
    console.warn(
      "[RoadEye AI] SCL Stats API failed, using PNG heuristic:",
      error instanceof Error ? error.message : error,
    );
  }

  if (params.leoPng && params.leoPng.byteLength > 100) {
    return estimateQualityFromPng(params.leoPng);
  }

  // No stats and no PNG → assume LEO usable (do not force HD).
  return {
    cloudCoverage: 0,
    textureScore: 1,
    usable: true,
    reason: "ok",
    measuredBy: "none",
  };
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
