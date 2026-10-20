import { getPgPool } from "@/lib/db/pg";
import { createAdminSupabaseClient } from "@/lib/db/client";
import type { SatelliteImageResponse } from "@/types/satellite";
import { bboxToWktPolygon } from "@/lib/map/geo";

async function uploadImageIfPossible(
  scanId: string,
  image: SatelliteImageResponse,
): Promise<string> {
  // data: URLs stay inline (mock / small payloads)
  if (image.imageUrl.startsWith("data:")) {
    return image.imageUrl;
  }

  try {
    const admin = createAdminSupabaseClient();
    const bytes = await fetch(image.imageUrl).then((r) => r.arrayBuffer());
    const path = `scans/${scanId}.png`;
    const { error } = await admin.storage
      .from("satellite-images")
      .upload(path, bytes, {
        contentType: image.mimeType,
        upsert: true,
      });
    if (error) {
      return image.imageUrl;
    }
    const { data } = admin.storage.from("satellite-images").getPublicUrl(path);
    return data.publicUrl || path;
  } catch {
    return image.imageUrl;
  }
}

export async function persistSatelliteScan(params: {
  image: SatelliteImageResponse;
  roadId?: string | null;
}): Promise<SatelliteImageResponse> {
  const pool = getPgPool();
  const imagePath = await uploadImageIfPossible(params.image.scanId, params.image);
  const wkt = bboxToWktPolygon(params.image.bbox);

  await pool.query(
    `
    INSERT INTO satellite_scans (
      id, road_id, source, bbox, acquired_at, cloud_coverage,
      image_path, bands, evalscript_id, meta
    )
    VALUES (
      $1, $2, $3,
      ST_GeomFromText($4, 4326),
      $5, $6, $7, $8, $9, $10::jsonb
    )
    ON CONFLICT (id) DO NOTHING
    `,
    [
      params.image.scanId,
      params.roadId ?? null,
      params.image.source,
      wkt,
      params.image.acquiredAt,
      params.image.cloudCoverage,
      imagePath,
      params.image.bands,
      params.image.evalscriptId,
      JSON.stringify({
        width: params.image.width,
        height: params.image.height,
        mimeType: params.image.mimeType,
      }),
    ],
  );

  return {
    ...params.image,
    imageUrl: imagePath,
  };
}

export async function getSatelliteScanById(
  id: string,
): Promise<SatelliteImageResponse | null> {
  const pool = getPgPool();
  const result = await pool.query<{
    id: string;
    source: "copernicus" | "mock";
    acquired_at: Date;
    cloud_coverage: number;
    image_path: string;
    bands: string[];
    evalscript_id: "true-color" | "ndvi" | "ndmi";
    meta: {
      width?: number;
      height?: number;
      mimeType?: "image/png" | "image/jpeg" | "image/svg+xml";
    };
    west: number;
    south: number;
    east: number;
    north: number;
  }>(
    `
    SELECT
      id, source, acquired_at, cloud_coverage, image_path, bands, evalscript_id, meta,
      ST_XMin(bbox) AS west,
      ST_YMin(bbox) AS south,
      ST_XMax(bbox) AS east,
      ST_YMax(bbox) AS north
    FROM satellite_scans
    WHERE id = $1
    LIMIT 1
    `,
    [id],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    scanId: row.id,
    source: row.source,
    bbox: [row.west, row.south, row.east, row.north],
    acquiredAt: row.acquired_at.toISOString(),
    cloudCoverage: row.cloud_coverage,
    width: row.meta?.width ?? 512,
    height: row.meta?.height ?? 512,
    bands: row.bands as SatelliteImageResponse["bands"],
    imageUrl: row.image_path,
    mimeType: row.meta?.mimeType ?? "image/png",
    evalscriptId: row.evalscript_id,
  };
}
