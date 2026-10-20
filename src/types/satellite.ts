export type SatelliteSource = "copernicus" | "esri" | "mock";
export type SatelliteBand = "RGB" | "NDVI" | "NDMI";
export type EvalscriptId = "true-color" | "ndvi" | "ndmi";

export type BBox = [west: number, south: number, east: number, north: number];

export interface SatelliteImageResponse {
  scanId: string;
  source: SatelliteSource;
  bbox: BBox;
  acquiredAt: string;
  cloudCoverage: number;
  width: number;
  height: number;
  bands: SatelliteBand[];
  imageUrl: string;
  mimeType: "image/png" | "image/jpeg" | "image/svg+xml";
  evalscriptId: EvalscriptId;
}
