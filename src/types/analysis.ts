import type { PciScore } from "@/types/pci";

export type SurfaceDefectType =
  | "longitudinal_crack"
  | "transverse_crack"
  | "alligator_crack"
  | "pothole"
  | "shoulder_settlement"
  | "ditch_flooding"
  | "erosion";

export interface SurfaceDefect {
  type: SurfaceDefectType;
  severity: 1 | 2 | 3 | 4 | 5;
  locationHint: string;
  /** WGS84 — punkt na mapie (wypełniane po analizie). */
  lat?: number;
  lng?: number;
  /** Pozycja względna w klatce AOI: 0=zachód/południe, 1=wschód/północ. */
  relativeX?: number;
  relativeY?: number;
}

export interface RoadAnalysisResult {
  pciScore: PciScore;
  surfaceDefects: SurfaceDefect[];
  conditionDescription: string;
  probableCauses: string[];
  recommendations: string[];
  potentialHazards: string[];
  confidenceScore: number;
}

export type ApiErrorCode =
  | "CONFIG"
  | "CLOUD_BLOCKED"
  | "NO_SCENE"
  | "RATE_LIMIT"
  | "VALIDATION"
  | "UPSTREAM"
  | "INTERNAL";

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

export const DEFECT_LABELS_PL: Record<SurfaceDefectType, string> = {
  longitudinal_crack: "Rysa podłużna",
  transverse_crack: "Rysa poprzeczna",
  alligator_crack: "Siatka spękań",
  pothole: "Wybój / ubytek",
  shoulder_settlement: "Osiadanie pobocza",
  ditch_flooding: "Zalanie rowu",
  erosion: "Erozja",
};
