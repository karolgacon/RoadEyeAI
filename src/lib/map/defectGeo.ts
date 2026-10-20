import type { SurfaceDefect } from "@/types/analysis";
import type { BBox } from "@/types/satellite";
import { PCI_COLORS } from "@/types/pci";

/** Higher defect severity = worse damage → map to PCI color (1 red … 5 green inverted). */
export function colorForDefectSeverity(severity: 1 | 2 | 3 | 4 | 5): string {
  const inverted = (6 - severity) as 1 | 2 | 3 | 4 | 5;
  return PCI_COLORS[inverted];
}

export function geocodeDefects(
  defects: SurfaceDefect[],
  bbox: BBox,
): SurfaceDefect[] {
  const [west, south, east, north] = bbox;
  const width = east - west;
  const height = north - south;

  return defects.map((defect, index) => {
    if (
      typeof defect.lat === "number" &&
      typeof defect.lng === "number" &&
      Number.isFinite(defect.lat) &&
      Number.isFinite(defect.lng)
    ) {
      return defect;
    }

    let x = defect.relativeX;
    let y = defect.relativeY;

    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      // Deterministic spread when model omits coordinates.
      x = 0.18 + ((index * 0.23) % 0.64);
      y = 0.22 + ((index * 0.19) % 0.56);
    }

    x = Math.min(0.95, Math.max(0.05, x));
    y = Math.min(0.95, Math.max(0.05, y));

    return {
      ...defect,
      relativeX: x,
      relativeY: y,
      lng: west + x * width,
      lat: south + y * height,
    };
  });
}

export function defectsWithCoordinates(
  defects: SurfaceDefect[],
): Array<SurfaceDefect & { lat: number; lng: number }> {
  return defects.filter(
    (d): d is SurfaceDefect & { lat: number; lng: number } =>
      typeof d.lat === "number" &&
      typeof d.lng === "number" &&
      Number.isFinite(d.lat) &&
      Number.isFinite(d.lng),
  );
}
