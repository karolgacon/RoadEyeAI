import type { BBox } from "@/types/satellite";

export const POLAND_CENTER: [number, number] = [52.1, 19.4];
export const POLAND_DEFAULT_ZOOM = 6;

export function parseBboxParam(raw: string | null): BBox | null {
  if (!raw) {
    return null;
  }
  const parts = raw.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }
  const [west, south, east, north] = parts;
  if (west >= east || south >= north) {
    return null;
  }
  if (west < -180 || east > 180 || south < -90 || north > 90) {
    return null;
  }
  return [west, south, east, north];
}

export function bboxToWktPolygon(bbox: BBox): string {
  const [west, south, east, north] = bbox;
  return `POLYGON((${west} ${south},${east} ${south},${east} ${north},${west} ${north},${west} ${south}))`;
}

export function leafletBoundsToBbox(bounds: {
  getWest: () => number;
  getSouth: () => number;
  getEast: () => number;
  getNorth: () => number;
}): BBox {
  return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
}

/** Bounding box around a road geometry, with optional padding in degrees. */
export function bboxFromGeoJson(
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString,
  padDegrees = 0.008,
): BBox {
  const rings: GeoJSON.Position[] =
    geometry.type === "LineString"
      ? geometry.coordinates
      : geometry.coordinates.flat();

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const pos of rings) {
    const lng = pos[0];
    const lat = pos[1];
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }

  if (!Number.isFinite(west)) {
    return [14.05, 49.0, 24.2, 54.9];
  }

  // Degenerate (point-like) segments need a minimum window for satellite fetch.
  const minSpan = 0.01;
  if (east - west < minSpan) {
    const mid = (west + east) / 2;
    west = mid - minSpan / 2;
    east = mid + minSpan / 2;
  }
  if (north - south < minSpan) {
    const mid = (south + north) / 2;
    south = mid - minSpan / 2;
    north = mid + minSpan / 2;
  }

  return [
    Math.max(-180, west - padDegrees),
    Math.max(-90, south - padDegrees),
    Math.min(180, east + padDegrees),
    Math.min(90, north + padDegrees),
  ];
}
