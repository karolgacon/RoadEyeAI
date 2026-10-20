import { PNG } from "pngjs";
import type { BBox } from "@/types/satellite";
import { getCopernicusAccessToken } from "@/lib/satellite/token";
import { RateLimitError, SatelliteError } from "@/lib/satellite/errors";
import {
  dataUrlToBuffer,
  decodeRaster,
  laplacianSharpness,
  upsampleFactor,
} from "@/lib/satellite/sharpness";

/** SCL: cloud shadow, cloud medium/high, thin cirrus, unclassified. */
const CLOUD_SCL = new Set([3, 7, 8, 9, 10]);

const STATS_EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["SCL", "B04", "dataMask"]
    }],
    output: [
      { id: "cloud", bands: 1, sampleType: "FLOAT32" },
      { id: "clearB04", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
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
    dataMask: [valid]
  };
}
`.trim();

const TEXTURE_EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["SCL", "B04", "dataMask"]
    }],
    output: [
      { id: "clearB04", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
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
  /** Legacy field: clear-pixel spectral/luminance variance (not sharpness). */
  textureScore: number;
  /** Laplacian edge energy 0–~1 on LEO frame. */
  sharpness?: number;
  /** LEO sharpness / HD sharpness when HD available. */
  sharpnessRatio?: number;
  /** How many times native S2 (~10 m) was stretched into the LEO canvas. */
  upsample?: number;
  usable: boolean;
  reason: "ok" | "clouds" | "blur" | "soft" | "upsampled" | "stats_failed";
  measuredBy?: "scl_stats" | "scl_mask" | "none";
}

/**
 * Vision gates tuned for Sentinel-2 reality (~10 m):
 * clear but soft LEO (highway/fields visible) should pass; white-out /
 * mush with almost no edges vs HD should still fall back.
 */
const MIN_LEO_SHARPNESS = 0.002;
/** LEO vs HD edge energy — S2 is naturally much softer than Esri. */
const MIN_SHARPNESS_RATIO = 0.05;
/** ~2.5 km corridor → ~1024 px is often ~3–4× native; allow that. */
const MAX_UPSAMPLE = 4.5;
const MAX_CLOUD = 0.25;

export function assessVisionReadiness(params: {
  cloudCoverage: number;
  textureScore: number;
  sharpness: number;
  sharpnessRatio: number | null;
  upsample: number;
}): Omit<LeoQuality, "measuredBy"> {
  const {
    cloudCoverage,
    textureScore,
    sharpness,
    sharpnessRatio,
    upsample,
  } = params;

  if (cloudCoverage > MAX_CLOUD) {
    return {
      cloudCoverage,
      textureScore,
      sharpness,
      sharpnessRatio: sharpnessRatio ?? undefined,
      upsample,
      usable: false,
      reason: "clouds",
    };
  }
  if (upsample > MAX_UPSAMPLE) {
    return {
      cloudCoverage,
      textureScore,
      sharpness,
      sharpnessRatio: sharpnessRatio ?? undefined,
      upsample,
      usable: false,
      reason: "upsampled",
    };
  }
  if (sharpness < MIN_LEO_SHARPNESS) {
    return {
      cloudCoverage,
      textureScore,
      sharpness,
      sharpnessRatio: sharpnessRatio ?? undefined,
      upsample,
      usable: false,
      reason: "soft",
    };
  }
  if (sharpnessRatio !== null && sharpnessRatio < MIN_SHARPNESS_RATIO) {
    return {
      cloudCoverage,
      textureScore,
      sharpness,
      sharpnessRatio,
      upsample,
      usable: false,
      reason: "soft",
    };
  }

  return {
    cloudCoverage,
    textureScore,
    sharpness,
    sharpnessRatio: sharpnessRatio ?? undefined,
    upsample,
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
      aggregationInterval: { of: "P120D" },
      lastIntervalBehavior: "SHORTEN",
      evalscript: params.evalscript,
      resx: 0.00015,
      resy: 0.00015,
    },
  };
}

async function postStatistics(token: string, payload: unknown): Promise<unknown> {
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
  let best: Record<string, unknown> | null = null;
  let bestCloud = Infinity;
  for (const row of data) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const outputs = (row as { outputs?: Record<string, { bands?: Record<string, unknown> }> })
      .outputs;
    const mean = readStatMean(firstBand(outputs?.cloud?.bands));
    const score = mean ?? 1;
    if (score < bestCloud) {
      bestCloud = score;
      best = row as Record<string, unknown>;
    }
  }
  return best ?? (data[0] as Record<string, unknown>);
}

async function fetchSclCloudAndTexture(params: {
  bbox: BBox;
  dateFrom: string;
  dateTo: string;
}): Promise<{ cloudCoverage: number; textureScore: number; measuredBy: "scl_stats" | "scl_mask" } | null> {
  try {
    const token = await getCopernicusAccessToken();
    const [cloudJson, textureJson] = await Promise.all([
      postStatistics(
        token,
        buildStatsPayload({ ...params, evalscript: STATS_EVALSCRIPT }),
      ) as Promise<{ data?: unknown[] }>,
      postStatistics(
        token,
        buildStatsPayload({ ...params, evalscript: TEXTURE_EVALSCRIPT }),
      ) as Promise<{ data?: unknown[] }>,
    ]);

    const cloudInterval = pickBestInterval(cloudJson.data ?? []);
    const textureInterval = pickBestInterval(textureJson.data ?? []);
    if (cloudInterval) {
      const cloudOutputs = cloudInterval.outputs as
        | Record<string, { bands?: Record<string, unknown> }>
        | undefined;
      const textureOutputs = (textureInterval?.outputs ?? cloudOutputs) as
        | Record<string, { bands?: Record<string, unknown> }>
        | undefined;
      const cloudMean = readStatMean(firstBand(cloudOutputs?.cloud?.bands));
      const textureStd = readStatStdev(firstBand(textureOutputs?.clearB04?.bands));
      if (cloudMean !== null) {
        return {
          cloudCoverage: Math.min(1, Math.max(0, cloudMean)),
          textureScore: textureStd === null ? 0 : Math.max(0, textureStd),
          measuredBy: "scl_stats",
        };
      }
    }
  } catch (error) {
    console.warn(
      "[RoadEye AI] Stats API failed:",
      error instanceof Error ? error.message : error,
    );
  }

  const scl = await measureCloudViaSclMask(params);
  if (!scl) {
    return null;
  }
  return {
    cloudCoverage: scl.cloudCoverage,
    textureScore: 0,
    measuredBy: "scl_mask",
  };
}

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
        responses: [{ identifier: "default", format: { type: "image/png" } }],
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
      console.warn("[RoadEye AI] SCL mask HTTP", response.status);
      return null;
    }

    const pngBuffer = Buffer.from(await response.arrayBuffer());
    const png = PNG.sync.read(pngBuffer);
    let cloud = 0;
    let valid = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      if (png.data[i + 3] < 128) {
        continue;
      }
      valid += 1;
      if (png.data[i] > 127) {
        cloud += 1;
      }
    }
    if (valid < 16) {
      return null;
    }
    return { cloudCoverage: cloud / valid, pngBuffer };
  } catch (error) {
    console.warn(
      "[RoadEye AI] SCL mask failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Full Vision readiness check:
 * SCL clouds (Stats → mask) + Laplacian sharpness + HD ratio + upsample factor.
 */
export async function measureLeoQuality(params: {
  bbox: BBox;
  dateFrom: string;
  dateTo: string;
  leoPng?: Buffer;
  /** Esri HD data-URL or raw JPEG — used for relative sharpness. */
  hdImageUrl?: string;
  imageWidth?: number;
}): Promise<LeoQuality> {
  const imageWidth = params.imageWidth ?? 1024;
  const upsample = upsampleFactor(params.bbox, imageWidth);

  let cloudCoverage = 1;
  let textureScore = 0;
  let measuredBy: LeoQuality["measuredBy"] = "none";

  const scl = await fetchSclCloudAndTexture(params);
  if (scl) {
    cloudCoverage = scl.cloudCoverage;
    textureScore = scl.textureScore;
    measuredBy = scl.measuredBy;
  } else {
    return {
      cloudCoverage: 1,
      textureScore: 0,
      sharpness: 0,
      upsample,
      usable: false,
      reason: "stats_failed",
      measuredBy: "none",
    };
  }

  if (!params.leoPng || params.leoPng.byteLength < 100) {
    return {
      cloudCoverage,
      textureScore,
      sharpness: 0,
      upsample,
      usable: false,
      reason: "soft",
      measuredBy,
    };
  }

  let sharpness = 0;
  try {
    sharpness = laplacianSharpness(decodeRaster(params.leoPng));
  } catch (error) {
    console.warn(
      "[RoadEye AI] LEO sharpness decode failed:",
      error instanceof Error ? error.message : error,
    );
  }

  let sharpnessRatio: number | null = null;
  if (params.hdImageUrl) {
    try {
      const hdBuf = dataUrlToBuffer(params.hdImageUrl);
      if (hdBuf) {
        const hdSharp = laplacianSharpness(decodeRaster(hdBuf));
        if (hdSharp > 1e-6) {
          sharpnessRatio = sharpness / hdSharp;
        }
      }
    } catch (error) {
      console.warn(
        "[RoadEye AI] HD sharpness compare failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    ...assessVisionReadiness({
      cloudCoverage,
      textureScore,
      sharpness,
      sharpnessRatio,
      upsample,
    }),
    measuredBy,
  };
}

export function qualityReasonPl(reason: LeoQuality["reason"]): string {
  switch (reason) {
    case "clouds":
      return "LEO zbyt zachmurzony (SCL)";
    case "blur":
      return "LEO zbyt jednolity spektralnie";
    case "soft":
      return "LEO zbyt miękki / rozmazany (ostrość)";
    case "upsampled":
      return "LEO zbyt mocno powiększony względem natywnych 10 m";
    case "stats_failed":
      return "Brak wiarygodnego pomiaru SCL — fallback HD";
    default:
      return "LEO nadaje się do analizy Vision";
  }
}

export function isCloudScl(scl: number): boolean {
  return CLOUD_SCL.has(scl);
}
