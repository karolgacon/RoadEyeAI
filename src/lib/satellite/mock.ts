import { randomUUID } from "node:crypto";
import type { BBox, EvalscriptId, SatelliteImageResponse } from "@/types/satellite";
import { fetchEsriWorldImagerySnapshot } from "@/lib/satellite/esriSnapshot";

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function cloudFromSeed(seed: number): number {
  // Keep mock cloud low so AI analysis is usually allowed while demoing imagery.
  return 0.04 + ((seed % 120) / 1000);
}

function fallbackSvg(params: {
  bbox: BBox;
  evalscriptId: EvalscriptId;
  cloudCoverage: number;
  width: number;
  height: number;
}): string {
  const [west, south, east, north] = params.bbox;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${params.width}" height="${params.height}" viewBox="0 0 ${params.width} ${params.height}">
  <rect width="100%" height="100%" fill="#3f4a3a"/>
  <text x="24" y="40" fill="#fff" font-family="sans-serif" font-size="16" font-weight="700">RoadEye · brak klatki Esri</text>
  <text x="24" y="64" fill="#d1d5db" font-family="monospace" font-size="12">${west.toFixed(4)},${south.toFixed(4)} → ${east.toFixed(4)},${north.toFixed(4)}</text>
  <text x="24" y="86" fill="#9ca3af" font-family="sans-serif" font-size="12">${params.evalscriptId} · cloud ${(params.cloudCoverage * 100).toFixed(0)}%</text>
</svg>`;
}

export async function createMockSatelliteImage(params: {
  bbox: BBox;
  dateFrom: string;
  dateTo: string;
  evalscriptId: EvalscriptId;
  width?: number;
  height?: number;
}): Promise<SatelliteImageResponse> {
  // Higher pixel density for tight road corridors (~900 m).
  const width = params.width ?? 1024;
  const height = params.height ?? 1024;
  const seed = hashSeed(
    `${params.bbox.join(",")}|${params.dateFrom}|${params.dateTo}|${params.evalscriptId}`,
  );
  const cloudCoverage = cloudFromSeed(seed);

  let imageUrl: string;
  let mimeType: SatelliteImageResponse["mimeType"] = "image/jpeg";
  let source: SatelliteImageResponse["source"] = "esri";

  try {
    const shot = await fetchEsriWorldImagerySnapshot({
      bbox: params.bbox,
      width,
      height,
    });
    imageUrl = shot.imageUrl;
    mimeType = shot.mimeType;
  } catch (error) {
    console.warn(
      "[RoadEye AI] Esri snapshot failed, SVG fallback:",
      error instanceof Error ? error.message : error,
    );
    const svg = fallbackSvg({
      bbox: params.bbox,
      evalscriptId: params.evalscriptId,
      cloudCoverage,
      width,
      height,
    });
    imageUrl = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
    mimeType = "image/svg+xml";
    source = "mock";
  }

  return {
    scanId: randomUUID(),
    source,
    bbox: params.bbox,
    acquiredAt: new Date(
      Date.parse(params.dateTo) - (seed % 7) * 24 * 60 * 60 * 1000,
    ).toISOString(),
    cloudCoverage,
    width,
    height,
    bands:
      params.evalscriptId === "true-color"
        ? ["RGB"]
        : params.evalscriptId === "ndvi"
          ? ["NDVI"]
          : ["NDMI"],
    imageUrl,
    mimeType,
    evalscriptId: params.evalscriptId,
  };
}
