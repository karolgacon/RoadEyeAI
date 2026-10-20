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

export interface SatelliteFetchResult {
  image: SatelliteImageResponse;
  cloudBlocked: boolean;
  threshold: number;
}
