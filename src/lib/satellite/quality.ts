import { PNG } from "pngjs";
import type { BBox } from "@/types/satellite";
import { getCopernicusAccessToken } from "@/lib/satellite/token";
import { RateLimitError, SatelliteError } from "@/lib/satellite/errors";

/** SCL: cloud shadow, cloud medium/high, thin cirrus, unclassified. */
const CLOUD_SCL = new Set([3, 7, 8, 9, 10]);

/**
 * Stats API evalscript (CDSE format).
 * - `cloud` mean over valid pixels = true cloud fraction (0–1)
 * - `clearB04` only on non-cloud pixels (dataMask excludes clouds) for texture
 *
 * Note: Statistical API uses a single dataMask output. We run two aggregations
 * conceptually by encoding clear-only samples: clearB04 is NaN-equivalent via
 * dataMask=0 on clouds — so stDev of clearB04 is texture of clear ground.
 */
const STATS_EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["SCL", "B04", "dataMask"]
    }],
    output: [
      {
        id: "cloud",
        bands: 1,
        sampleType: "FLOAT32"
      },
      {
        id: "clearB04",
        bands: 1,
        sampleType: "FLOAT32"
      },
      {
        id: "dataMask",
        bands: 1
      }
    ]
  };
}
function evaluatePixel(samples) {
  const scl = samples.SCL;
  const isCloud = (scl === 3 || scl === 7 || scl === 8 || scl === 9 || scl === 10);
  const valid = samples.dataMask;
  return {
    cloud: [isCloud ? 1 : 0],
    clearB04: [samples.B04],
    // Exclude nodata AND clouds from clearB04 stats; cloud band still uses valid-only
    // via a trick: we need cloud mean over all valid pixels.
    // Statistical API applies one dataMask to all outputs — so we keep valid pixels
    // and accept clearB04 includes cloudy B04 values. Texture uses a second request.
    dataMask: [valid]
  };
}
`.trim();

/** Texture-only: mask out clouds so stDev reflects ground structure. */
const TEXTURE_EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["SCL", "B04", "dataMask"]
    }],
    output: [
      {
        id: "clearB04",
        bands: 1,
        sampleType: "FLOAT32"
      },
      {
        id: "dataMask",
        bands: 1
      }
    ]
  };
}
function evaluatePixel(samples) {
  const scl = samples.SCL;
  const isCloud = (scl === 3 || scl === 7 || scl === 8 || scl === 9 || scl === 10);
  const keep = samples.dataMask && !isCloud ? 1 : 0;
  return {
    clearB04: [samples.B04],
    dataMask: [keep]
  };
}
`.trim();

/** Process API: SCL cloud mask for the same mosaic as the LEO true-color frame. */
const SCL_MASK_EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: ["SCL", "dataMask"],
    output: { bands: 4 }
  };
}
function evaluatePixel(sample) {
  const scl = sample.SCL;
  const cloud = (scl === 3 || scl === 7 || scl === 8 || scl === 9 || scl === 10) ? 1 : 0;
  const valid = sample.dataMask;
  return [cloud, cloud, cloud, valid];
}
`.trim();

export interface LeoQuality {
  cloudCoverage: number;
  textureScore: number;
  usable: boolean;
  reason: "ok" | "clouds" | "blur" | "stats_failed";
  measuredBy?: "scl_stats" | "scl_mask" | "none";
}

/** Strict gates for Vision on LEO — HD only when these fail. */
export function assessLeoUsability(
  cloudCoverage: number,
  textureScore: number,
  options?: {
    cloudThreshold?: number;
    minTexture?: number;
  },
): Omit<LeoQuality, "measuredBy"> {
  // ~25% SCL cloud/shadow/cirrus → road mostly obscured for Vision.
  const cloudThreshold = options?.cloudThreshold ?? 0.25;
  // B04 reflectance stDev on clear pixels; soft S2 still usually > 0.02.
  const minTexture = options?.minTexture ?? 0.02;

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
  const stats = (band as { stats?: { mean?: number } }).stats;
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
  return bands.B0 ?? bands["0"] ?? Object.values(bands)[0] ?? null;
}

function statsUrls(): string[] {
  const configured = process.env.COPERNICUS_STATS_API_URL?.trim();
  const defaults = [
    "https://sh.dataspace.copernicus.eu/api/v1/statistics",
    "https://sh.dataspace.copernicus.eu/statistics/v1",
  ];
  if (configured) {
    return [configured, ...defaults.filter((u) => u !== configured)];
  }
  return defaults;
}

function buildStatsPayload(params: {
  bbox: BBox;
  dateFrom: string;
  dateTo: string;
  evalscript: string;
}) {
  const [west, south, east, north] = params.bbox;
  return {
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
      // One interval covering the whole window (avoid SKIP of remainder).
      aggregationInterval: { of: "P120D" },
      lastIntervalBehavior: "SHORTEN",
      evalscript: params.evalscript,
      // ~10–20 m in WGS84 at PL latitudes
      resx: 0.00015,
      resy: 0.00015,
    },
  };
}

async function postStatistics(
  token: string,
  payload: unknown,
): Promise<unknown> {
  let lastError: Error | null = null;
  for (const url of statsUrls()) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(50_000),
    });

    if (response.status === 429) {
      throw new RateLimitError();
    }
    if (response.ok) {
      return response.json();
    }
    const text = await response.text();
    lastError = new SatelliteError(
      "UPSTREAM",
      `Stats API ${response.status} @ ${url}: ${text.slice(0, 200)}`,
    );
    // Try alternate URL on 404/405.
    if (response.status !== 404 && response.status !== 405) {
      throw lastError;
    }
  }
  throw lastError ?? new SatelliteError("UPSTREAM", "Stats API unavailable");
}

function pickBestInterval(data: unknown[]): Record<string, unknown> | null {
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }
  // Prefer interval with lowest cloud mean when multiple exist.
  let best: Record<string, unknown> | null = null;
  let bestCloud = Infinity;
  for (const row of data) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const outputs = (row as { outputs?: Record<string, { bands?: Record<string, unknown> }> })
      .outputs;
    const cloudBand = firstBand(outputs?.cloud?.bands);
    const mean = readStatMean(cloudBand);
    const score = mean ?? 1;
    if (score < bestCloud) {
      bestCloud = score;
      best = row as Record<string, unknown>;
    }
  }
  return best ?? (data[0] as Record<string, unknown>);
}

async function measureViaStatsApi(params: {
  bbox: BBox;
  dateFrom: string;
  dateTo: string;
}): Promise<LeoQuality | null> {
  const token = await getCopernicusAccessToken();

  const cloudPayload = buildStatsPayload({
    ...params,
    evalscript: STATS_EVALSCRIPT,
  });
  const texturePayload = buildStatsPayload({
    ...params,
    evalscript: TEXTURE_EVALSCRIPT,
  });

  const [cloudJson, textureJson] = await Promise.all([
    postStatistics(token, cloudPayload) as Promise<{
      data?: unknown[];
      status?: string;
    }>,
    postStatistics(token, texturePayload) as Promise<{
      data?: unknown[];
      status?: string;
    }>,
  ]);

  const cloudInterval = pickBestInterval(cloudJson.data ?? []);
  const textureInterval = pickBestInterval(textureJson.data ?? []);
  if (!cloudInterval) {
    console.warn("[RoadEye AI] Stats API empty data:", JSON.stringify(cloudJson).slice(0, 500));
    return null;
  }

  const cloudOutputs = cloudInterval.outputs as
    | Record<string, { bands?: Record<string, unknown> }>
    | undefined;
  const textureOutputs = (textureInterval?.outputs ?? cloudOutputs) as
    | Record<string, { bands?: Record<string, unknown> }>
    | undefined;

  const cloudMean = readStatMean(firstBand(cloudOutputs?.cloud?.bands));
  const textureStd = readStatStdev(firstBand(textureOutputs?.clearB04?.bands));

  if (cloudMean === null) {
    console.warn(
      "[RoadEye AI] Stats API missing cloud mean:",
      JSON.stringify(cloudOutputs)?.slice(0, 400),
    );
    return null;
  }

  const cloudCoverage = Math.min(1, Math.max(0, cloudMean));
  // If texture missing, treat as unknown (0) → blur gate fails → HD (conservative).
  const textureScore = textureStd === null ? 0 : Math.max(0, textureStd);

  return {
    ...assessLeoUsability(cloudCoverage, textureScore),
    measuredBy: "scl_stats",
  };
}

/**
 * SCL cloud fraction from Process API for the same mosaic window as LEO true-color.
 */
export async function measureCloudViaSclMask(params: {
  bbox: BBox;
  dateFrom: string;
  dateTo: string;
  width?: number;
  height?: number;
}): Promise<{ cloudCoverage: number; pngBuffer: Buffer } | null> {
  try {
    const token = await getCopernicusAccessToken();
    const processUrl =
      process.env.COPERNICUS_PROCESS_API_URL?.trim() ||
      "https://sh.dataspace.copernicus.eu/api/v1/process";
    const width = params.width ?? 256;
    const height = params.height ?? 256;
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
      evalscript: SCL_MASK_EVALSCRIPT,
    };

    const response = await fetch(processUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "image/png",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      console.warn(
        "[RoadEye AI] SCL mask Process API HTTP",
        response.status,
        (await response.text()).slice(0, 160),
      );
      return null;
    }

    const pngBuffer = Buffer.from(await response.arrayBuffer());
    const png = PNG.sync.read(pngBuffer);
    let cloud = 0;
    let valid = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      const a = png.data[i + 3];
      if (a < 128) {
        continue;
      }
      valid += 1;
      // Cloud encoded in R (and G/B) as 0 or ~255
      if (png.data[i] > 127) {
        cloud += 1;
      }
    }
    if (valid < 16) {
      return null;
    }
    return {
      cloudCoverage: cloud / valid,
      pngBuffer,
    };
  } catch (error) {
    console.warn(
      "[RoadEye AI] SCL mask failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Texture from LEO true-color PNG, excluding SCL-cloud pixels when mask provided.
 */
export function textureFromLeoPng(
  leoPng: Buffer,
  sclMaskPng?: Buffer,
): number {
  const leo = PNG.sync.read(leoPng);
  let mask: PNG | null = null;
  if (sclMaskPng) {
    try {
      mask = PNG.sync.read(sclMaskPng);
    } catch {
      mask = null;
    }
  }

  const values: number[] = [];
  const n = leo.width * leo.height;
  for (let p = 0; p < n; p += 1) {
    const i = p << 2;
    if (mask && mask.width === leo.width && mask.height === leo.height) {
      // Skip cloudy / invalid in SCL mask
      if (mask.data[i + 3] < 128 || mask.data[i] > 127) {
        continue;
      }
    }
    const y =
      0.299 * leo.data[i] + 0.587 * leo.data[i + 1] + 0.114 * leo.data[i + 2];
    values.push(y / 255);
  }
  if (values.length < 32) {
    return 0;
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  let varSum = 0;
  for (const v of values) {
    varSum += (v - mean) ** 2;
  }
  return Math.sqrt(varSum / values.length);
}

/**
 * Rigorous LEO quality:
 * 1) CDSE Statistical API (SCL cloud + clear-pixel B04 texture)
 * 2) else Process API SCL mask + texture from LEO PNG excluding clouds
 * 3) else fail closed → HD fallback (do not guess with RGB brightness)
 */
export async function measureLeoQuality(params: {
  bbox: BBox;
  dateFrom: string;
  dateTo: string;
  leoPng?: Buffer;
}): Promise<LeoQuality> {
  try {
    const fromStats = await measureViaStatsApi(params);
    if (fromStats) {
      return fromStats;
    }
  } catch (error) {
    console.warn(
      "[RoadEye AI] Stats API failed, trying SCL Process mask:",
      error instanceof Error ? error.message : error,
    );
  }

  const scl = await measureCloudViaSclMask({
    bbox: params.bbox,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });

  if (scl && params.leoPng) {
    const textureScore = textureFromLeoPng(params.leoPng, scl.pngBuffer);
    return {
      ...assessLeoUsability(scl.cloudCoverage, textureScore, {
        // Mask path: luminance texture is 0–1 normalized, similar scale to mild B04 std.
        cloudThreshold: 0.25,
        minTexture: 0.035,
      }),
      measuredBy: "scl_mask",
    };
  }

  if (scl) {
    // Have cloud % but no LEO bytes — gate on clouds only; require low cloud.
    const usable = scl.cloudCoverage <= 0.25;
    return {
      cloudCoverage: scl.cloudCoverage,
      textureScore: usable ? 1 : 0,
      usable,
      reason: usable ? "ok" : "clouds",
      measuredBy: "scl_mask",
    };
  }

  // Fail closed: without real SCL we must not claim LEO is OK.
  return {
    cloudCoverage: 1,
    textureScore: 0,
    usable: false,
    reason: "stats_failed",
    measuredBy: "none",
  };
}

export function qualityReasonPl(reason: LeoQuality["reason"]): string {
  switch (reason) {
    case "clouds":
      return "LEO zbyt zachmurzony (SCL)";
    case "blur":
      return "LEO zbyt jednolity / rozmazany (brak tekstury gruntu)";
    case "stats_failed":
      return "Brak wiarygodnego pomiaru SCL — fallback HD";
    default:
      return "LEO nadaje się do analizy (SCL OK)";
  }
}

export function isCloudScl(scl: number): boolean {
  return CLOUD_SCL.has(scl);
}
