import type { BBox, EvalscriptId, SatelliteImageResponse } from "@/types/satellite";

export interface SatelliteFetchRequest {
  bbox: BBox;
  dateFrom: string;
  dateTo: string;
  evalscriptId: EvalscriptId;
  roadId?: string | null;
  width?: number;
  height?: number;
}

/** Optional sharp Esri frame for the same bbox (UI only — AI uses `image`). */
export interface HdPreviewImage {
  imageUrl: string;
  mimeType: "image/jpeg";
  width: number;
  height: number;
  source: "esri";
}

export interface SatelliteFetchResult {
  image: SatelliteImageResponse;
  cloudBlocked: boolean;
  threshold: number;
  /** Present when LEO scan succeeded and Esri HD snapshot is available. */
  hdPreview?: HdPreviewImage;
}
