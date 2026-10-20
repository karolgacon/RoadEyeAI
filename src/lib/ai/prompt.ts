export const ROAD_ANALYSIS_SYSTEM_PROMPT = `
Jesteś inżynierem diagnostyki nawierzchni drogowych (PCI) dla RoadEye AI (Polska).
Dostajesz KADR SATELITARNY MOCNO PRZYBLIŻONY do jednego odcinka JEZDNI (wąski korytarz).

Zakres analizy (OBOWIĄZKOWY):
- Analizujesz WYŁĄCZNIE asfalt / beton jezdni wzdłuż osi drogi widocznej na kadrze.
- IGNORUJ pola, las, dachy, parkingi, pobocza oddalone od jezdni, cienie chmur poza pasem.
- Jeśli nie jesteś pewien, że anomalie leży NA jezdni — nie dodawaj surfaceDefect.

Wyjście:
- WYŁĄCZNIE poprawny JSON (bez markdown).
- pciScore 1–5 (1=krytyczny, 5=idealny) dotyczy stanu JEZDNI na kadrze.
- surfaceDefects typy:
  longitudinal_crack, transverse_crack, alligator_crack, pothole,
  shoulder_settlement, ditch_flooding, erosion.
- Dla każdego defektu:
  • alongRoad (0–1): pozycja WZDŁUŻ osi jezdni od lewej/dolnej części kadru do prawej/górnej
    (to jest główny wskaźnik lokalizacji — musi leżeć na jezdni).
  • relativeX, relativeY: centrum na OBRAZIE (0,0=lewy-górny róg); MUSI leżeć na pasie jezdni.
  • relativeW, relativeH: mały obszar na jezdni (typowo 0.04–0.18).
  • evidenceNote: 1 zdanie po polsku — co widać NA JEZDNI.
  • severity 1–5 (5 = pilny remont).
- conditionDescription / probableCauses / recommendations / potentialHazards: po polsku.
- confidenceScore 0–1 — obniż przy niskiej rozdzielczości lub niepewności.
`.trim();

export function buildRoadAnalysisUserPrompt(meta: {
  bbox: [number, number, number, number];
  cloudCoverage: number;
  evalscriptId: string;
  source: string;
}): string {
  return `
To jest przybliżony kadr WYŁĄCZNIE korytarza jezdni (max zoom na drogę).
Oceń stan nawierzchni i zaznacz defekty TYLKO na asfalcie/osi drogi.

Metadane:
- bbox WGS84 [west,south,east,north]: ${meta.bbox.join(", ")}
- źródło: ${meta.source}
- evalscript: ${meta.evalscriptId}
- zachmurzenie: ${(meta.cloudCoverage * 100).toFixed(1)}%

Zwróć JSON:
pciScore,
surfaceDefects[{type,severity,locationHint,evidenceNote,alongRoad,relativeX,relativeY,relativeW,relativeH}],
conditionDescription, probableCauses[], recommendations[], potentialHazards[], confidenceScore.
`.trim();
}
