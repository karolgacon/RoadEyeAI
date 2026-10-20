import type { BBox } from "@/types/satellite";

/**
 * Esri World Imagery export in EPSG:4326 so pixel axes match our
 * linear WGS84 overlays (OSM road centerline / defect ellipses).
 * Fallback preview only — not a LEO acquisition.
 */
export async function fetchEsriWorldImagerySnapshot(params: {
  bbox: BBox;
  width?: number;
  height?: number;
}): Promise<{
  imageUrl: string;
  mimeType: "image/jpeg";
  width: number;
  height: number;
}> {
  const width = params.width ?? 1024;
  const height = params.height ?? 1024;
  const [west, south, east, north] = params.bbox;

  const url = new URL(
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export",
  );
  url.searchParams.set("bbox", `${west},${south},${east},${north}`);
  url.searchParams.set("bboxSR", "4326");
  // MUST be 4326 — 3857 warps the frame vs our lat/lng polyline overlay.
  url.searchParams.set("imageSR", "4326");
  url.searchParams.set("size", `${width},${height}`);
  url.searchParams.set("format", "jpg");
  url.searchParams.set("f", "image");
  url.searchParams.set("transparent", "false");

  const response = await fetch(url, {
    headers: { Accept: "image/jpeg" },
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw new Error(`Esri imagery HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 800) {
    throw new Error("Esri imagery payload too small");
  }

  return {
    imageUrl: `data:image/jpeg;base64,${buffer.toString("base64")}`,
    mimeType: "image/jpeg",
    width,
    height,
  };
}
