import { randomUUID } from "node:crypto";
import type { BBox, EvalscriptId, SatelliteImageResponse } from "@/types/satellite";

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function cloudFromSeed(seed: number): number {
  // Deterministic 5%–45% so UI can demo cloud_blocked sometimes
  return 0.05 + ((seed % 400) / 1000);
}

function svgForScene(params: {
  bbox: BBox;
  evalscriptId: EvalscriptId;
  cloudCoverage: number;
  width: number;
  height: number;
}): string {
  const [west, south, east, north] = params.bbox;
  const hue =
    params.evalscriptId === "ndvi"
      ? 140
      : params.evalscriptId === "ndmi"
        ? 210
        : 95;
  const cloudOpacity = Math.min(0.75, params.cloudCoverage * 1.4);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${params.width}" height="${params.height}" viewBox="0 0 ${params.width} ${params.height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 35% 28%)"/>
      <stop offset="55%" stop-color="hsl(${hue + 20} 28% 38%)"/>
      <stop offset="100%" stop-color="hsl(${hue - 10} 22% 22%)"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <path d="M40 ${params.height * 0.55} C ${params.width * 0.3} ${params.height * 0.4}, ${params.width * 0.55} ${params.height * 0.7}, ${params.width - 40} ${params.height * 0.48}"
        fill="none" stroke="#d1d5db" stroke-width="10" stroke-linecap="round" opacity="0.85"/>
  <path d="M50 ${params.height * 0.58} C ${params.width * 0.32} ${params.height * 0.43}, ${params.width * 0.57} ${params.height * 0.73}, ${params.width - 50} ${params.height * 0.51}"
        fill="none" stroke="#9ca3af" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
  <circle cx="${params.width * 0.22}" cy="${params.height * 0.25}" r="${40 + cloudOpacity * 50}" fill="#ffffff" opacity="${cloudOpacity}"/>
  <circle cx="${params.width * 0.35}" cy="${params.height * 0.22}" r="${30 + cloudOpacity * 40}" fill="#f8fafc" opacity="${cloudOpacity * 0.9}"/>
  <circle cx="${params.width * 0.7}" cy="${params.height * 0.3}" r="${35 + cloudOpacity * 45}" fill="#ffffff" opacity="${cloudOpacity * 0.85}"/>
  <rect x="16" y="16" width="220" height="74" rx="10" fill="rgba(0,0,0,0.45)"/>
  <text x="28" y="40" fill="#fff" font-family="ui-sans-serif,system-ui" font-size="14" font-weight="700">RoadEye AI · MOCK</text>
  <text x="28" y="60" fill="#d1d5db" font-family="ui-monospace,monospace" font-size="11">${params.evalscriptId} · cloud ${(params.cloudCoverage * 100).toFixed(0)}%</text>
  <text x="28" y="78" fill="#9ca3af" font-family="ui-monospace,monospace" font-size="10">${west.toFixed(3)},${south.toFixed(3)} → ${east.toFixed(3)},${north.toFixed(3)}</text>
</svg>`;
}

export function createMockSatelliteImage(params: {
  bbox: BBox;
  dateFrom: string;
  dateTo: string;
  evalscriptId: EvalscriptId;
  width?: number;
  height?: number;
}): SatelliteImageResponse {
  const width = params.width ?? 512;
  const height = params.height ?? 512;
  const seed = hashSeed(
    `${params.bbox.join(",")}|${params.dateFrom}|${params.dateTo}|${params.evalscriptId}`,
  );
  const cloudCoverage = cloudFromSeed(seed);
  const svg = svgForScene({
    bbox: params.bbox,
    evalscriptId: params.evalscriptId,
    cloudCoverage,
    width,
    height,
  });
  const imageUrl = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

  return {
    scanId: randomUUID(),
    source: "mock",
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
    mimeType: "image/svg+xml",
    evalscriptId: params.evalscriptId,
  };
}
