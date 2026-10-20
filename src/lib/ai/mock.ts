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
  roadGeometry?: GeoJSON.LineString | GeoJSON.MultiLineString | null;
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
        evidenceNote:
          "Widoczna siatka spękań na jezdni — typowy sygnał utraty nośności warstwy ścieralnej.",
        relativeX: 0.5,
        relativeY: 0.48,
        alongRoad: 0.5,
      },
      {
        type: "pothole",
        severity: 4,
        locationHint: "krawędź prawej jezdni",
        evidenceNote:
          "Lokalny ubytek przy krawędzi pasa — ryzyko dalszego wykruszania.",
        relativeX: 0.62,
        relativeY: 0.52,
        alongRoad: 0.72,
      },
    ],
    2: [
      {
        type: "longitudinal_crack",
        severity: 4,
        locationHint: "oś jezdni",
        evidenceNote:
          "Rysa podłużna w osi — wskazuje na zmęczenie nawierzchni pod ruchem.",
        relativeX: 0.5,
        relativeY: 0.5,
        alongRoad: 0.4,
      },
      {
        type: "ditch_flooding",
        severity: 3,
        locationHint: "rów przy krawędzi lewej",
        evidenceNote:
          "Zastój wody przy krawędzi drogi — pogarsza odwodnienie i podbudowę.",
        relativeX: 0.28,
        relativeY: 0.55,
        alongRoad: 0.55,
      },
    ],
    3: [
      {
        type: "transverse_crack",
        severity: 3,
        locationHint: "strefa hamowania",
        evidenceNote:
          "Rysa poprzeczna na jezdni — wymaga uszczelnienia, by nie weszła woda.",
        relativeX: 0.52,
        relativeY: 0.45,
        alongRoad: 0.35,
      },
    ],
    4: [
      {
        type: "shoulder_settlement",
        severity: 2,
        locationHint: "pobocze prawe",
        evidenceNote:
          "Lekkie obniżenie pobocza przy krawędzi — monitoring, bez pilnego remontu.",
        relativeX: 0.7,
        relativeY: 0.5,
        alongRoad: 0.65,
      },
    ],
    5: [],
  };

  return {
    pciScore,
    surfaceDefects: geocodeDefects(
      defectsByPci[pciScore],
      params.bbox,
      params.roadGeometry,
    ),
    conditionDescription:
      pciScore >= 4
        ? "Nawierzchnia wygląda na stabilną; drobne oznaki starzenia bez istotnych ubytków."
        : pciScore === 3
          ? "Stan umiarkowany — widoczne spękania lokalne na jezdni; warto zaplanować przegląd utrzymaniowy."
          : "Stan zły/krytyczny — wyraźne anomalie nawierzchni jezdni wymagające interwencji.",
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
