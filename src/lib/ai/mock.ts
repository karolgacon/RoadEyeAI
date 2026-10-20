import type { RoadAnalysisResult } from "@/types/analysis";
import type { BBox } from "@/types/satellite";
import { geocodeDefects } from "@/lib/map/defectGeo";

function seedFromBbox(bbox: BBox): number {
  const raw = bbox.map((n) => Math.abs(n * 1000)).join("");
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) {
    h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function createMockRoadAnalysis(params: {
  bbox: BBox;
  cloudCoverage: number;
}): RoadAnalysisResult {
  const seed = seedFromBbox(params.bbox);
  const pciScore = ((seed % 5) + 1) as 1 | 2 | 3 | 4 | 5;
  const confidence = Math.max(
    0.35,
    Math.min(0.92, 0.9 - params.cloudCoverage * 0.8),
  );

  const defectsByPci: Record<
    1 | 2 | 3 | 4 | 5,
    RoadAnalysisResult["surfaceDefects"]
  > = {
    1: [
      {
        type: "alligator_crack",
        severity: 5,
        locationHint: "pas główny, środkowy odcinek",
        relativeX: 0.48,
        relativeY: 0.52,
      },
      {
        type: "pothole",
        severity: 4,
        locationHint: "krawędź prawej jezdni",
        relativeX: 0.72,
        relativeY: 0.4,
      },
    ],
    2: [
      {
        type: "longitudinal_crack",
        severity: 4,
        locationHint: "oś jezdni",
        relativeX: 0.5,
        relativeY: 0.45,
      },
      {
        type: "ditch_flooding",
        severity: 3,
        locationHint: "rów odwadniający po lewej",
        relativeX: 0.22,
        relativeY: 0.55,
      },
    ],
    3: [
      {
        type: "transverse_crack",
        severity: 3,
        locationHint: "strefa hamowania",
        relativeX: 0.55,
        relativeY: 0.35,
      },
    ],
    4: [
      {
        type: "shoulder_settlement",
        severity: 2,
        locationHint: "pobocze prawe",
        relativeX: 0.78,
        relativeY: 0.5,
      },
    ],
    5: [],
  };

  return {
    pciScore,
    surfaceDefects: geocodeDefects(defectsByPci[pciScore], params.bbox),
    conditionDescription:
      pciScore >= 4
        ? "Nawierzchnia wygląda na stabilną; drobne oznaki starzenia bez istotnych ubytków."
        : pciScore === 3
          ? "Stan umiarkowany — widoczne spękania lokalne; warto zaplanować przegląd utrzymaniowy."
          : "Stan zły/krytyczny — wyraźne anomalie nawierzchni i/lub odwodnienia wymagające interwencji.",
    probableCauses:
      pciScore <= 2
        ? [
            "przełom zimowy / zamróz",
            "ograniczona nośność podbudowy",
            "niedrożne odwodnienie",
          ]
        : ["naturalne starzenie warstwy ścieralnej", "obciążenie ruchem"],
    recommendations:
      pciScore <= 2
        ? [
            "lokalna wymiana warstwy ścieralnej",
            "udrożnienie rowów odwadniających",
            "ocena nośności podbudowy",
          ]
        : ["monitoring okresowy", "uszczelnienie rys"],
    potentialHazards:
      pciScore <= 2
        ? ["ryzyko uszkodzenia zawieszenia", "utrata przyczepności przy deszczu"]
        : ["niskie ryzyko operacyjne"],
    confidenceScore: Number(confidence.toFixed(2)),
  };
}
