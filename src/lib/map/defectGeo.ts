import type { SurfaceDefect } from "@/types/analysis";
import type { BBox } from "@/types/satellite";
import { PCI_COLORS } from "@/types/pci";
import { projectLngLatToImage } from "@/lib/map/roadWindow";

/** Higher defect severity = worse damage → redder color. */
export function colorForDefectSeverity(severity: 1 | 2 | 3 | 4 | 5): string {
  const inverted = (6 - severity) as 1 | 2 | 3 | 4 | 5;
  return PCI_COLORS[inverted];
}

type RoadGeom = GeoJSON.LineString | GeoJSON.MultiLineString;

function flattenCoordinates(geometry: RoadGeom): GeoJSON.Position[] {
  if (geometry.type === "LineString") {
    return geometry.coordinates;
  }
  return geometry.coordinates.flat();
}

function segmentLength(a: GeoJSON.Position, b: GeoJSON.Position): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.hypot(dx, dy);
}

/** Point at fraction t∈[0,1] along a road polyline (in WGS84 degrees). */
export function pointAlongRoad(
  geometry: RoadGeom,
  t: number,
): { lng: number; lat: number } | null {
  const coords = flattenCoordinates(geometry);
  if (coords.length < 2) {
    return null;
  }

  const clamped = Math.min(1, Math.max(0, t));
  let total = 0;
  const lengths: number[] = [];
  for (let i = 0; i < coords.length - 1; i += 1) {
    const len = segmentLength(coords[i], coords[i + 1]);
    lengths.push(len);
    total += len;
  }
  if (total <= 0) {
    return { lng: coords[0][0], lat: coords[0][1] };
  }

  let remaining = clamped * total;
  for (let i = 0; i < lengths.length; i += 1) {
    const len = lengths[i];
    if (remaining <= len || i === lengths.length - 1) {
      const ratio = len === 0 ? 0 : remaining / len;
      const a = coords[i];
      const b = coords[i + 1];
      return {
        lng: a[0] + (b[0] - a[0]) * ratio,
        lat: a[1] + (b[1] - a[1]) * ratio,
      };
    }
    remaining -= len;
  }

  const last = coords[coords.length - 1];
  return { lng: last[0], lat: last[1] };
}

/**
 * Place defects on the carriageway.
 * When road geometry is present, lat/lng AND image relativeX/Y are forced
 * onto the road (alongRoad), so overlays never sit in fields.
 */
export function geocodeDefects(
  defects: SurfaceDefect[],
  bbox: BBox,
  roadGeometry?: RoadGeom | null,
): SurfaceDefect[] {
  const [west, south, east, north] = bbox;
  const width = east - west;
  const height = north - south;

  return defects.map((defect, index) => {
    let along = defect.alongRoad;
    if (typeof along !== "number" || !Number.isFinite(along)) {
      along = 0.2 + ((index * 0.25) % 0.6);
    }
    along = Math.min(0.95, Math.max(0.05, along));

    let lng: number;
    let lat: number;
    let x: number;
    let y: number;

    if (roadGeometry) {
      const onRoad = pointAlongRoad(roadGeometry, along);
      if (onRoad) {
        lng = onRoad.lng;
        lat = onRoad.lat;
        const projected = projectLngLatToImage(lng, lat, bbox);
        x = projected.x;
        y = projected.y;
      } else {
        x = 0.5;
        y = 0.5;
        lng = west + 0.5 * width;
        lat = south + 0.5 * height;
      }
    } else {
      let rx = defect.relativeX;
      let ry = defect.relativeY;
      if (
        typeof rx !== "number" ||
        typeof ry !== "number" ||
        !Number.isFinite(rx) ||
        !Number.isFinite(ry)
      ) {
        rx = 0.35 + ((index * 0.18) % 0.35);
        ry = 0.45 + ((index * 0.1) % 0.2);
      }
      x = Math.min(0.95, Math.max(0.05, rx));
      y = Math.min(0.95, Math.max(0.05, ry));
      lng = west + x * width;
      lat = north - y * height;
    }

    // Keep ellipses tight on the carriageway at high zoom.
    const baseSize = 0.04 + defect.severity * 0.008;
    const relativeW =
      typeof defect.relativeW === "number" && Number.isFinite(defect.relativeW)
        ? Math.min(0.22, Math.max(0.03, defect.relativeW))
        : baseSize * 1.4;
    const relativeH =
      typeof defect.relativeH === "number" && Number.isFinite(defect.relativeH)
        ? Math.min(0.16, Math.max(0.03, defect.relativeH))
        : baseSize;

    return {
      ...defect,
      relativeX: x,
      relativeY: y,
      alongRoad: along,
      relativeW,
      relativeH,
      lng,
      lat,
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
