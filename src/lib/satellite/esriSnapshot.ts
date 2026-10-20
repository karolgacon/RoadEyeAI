import type { BBox } from "@/types/satellite";

/**
 * Free Esri World Imagery export for a WGS84 bbox.
 * Used as a realistic road/street preview when Copernicus mock mode is on
 * (or as visual fallback). Not a LEO stream — recent basemap mosaic.
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
  const width = params.width ?? 768;
  const height = params.height ?? 768;
  const [west, south, east, north] = params.bbox;

  const url = new URL(
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export",
  );
  url.searchParams.set("bbox", `${west},${south},${east},${north}`);
  url.searchParams.set("bboxSR", "4326");
  url.searchParams.set("imageSR", "3857");
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
