import type { BBox } from "@/types/satellite";

type RoadGeom = GeoJSON.LineString | GeoJSON.MultiLineString;

function flatten(geometry: RoadGeom): GeoJSON.Position[] {
  return geometry.type === "LineString"
    ? geometry.coordinates
    : geometry.coordinates.flat();
}

function haversineM(a: GeoJSON.Position, b: GeoJSON.Position): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function polylineLengthM(coords: GeoJSON.Position[]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    total += haversineM(coords[i], coords[i + 1]);
  }
  return total;
}

/** Extract a contiguous window of ~maxLengthM centered on the polyline. */
export function clipRoadCenterWindow(
  geometry: RoadGeom,
  maxLengthM = 900,
): GeoJSON.LineString {
  const coords = flatten(geometry);
  if (coords.length < 2) {
    return {
      type: "LineString",
      coordinates: coords.length ? coords : [[19.4, 52.1], [19.41, 52.1]],
    };
  }

  const total = polylineLengthM(coords);
  if (total <= maxLengthM) {
    return { type: "LineString", coordinates: coords };
  }

  const startDist = (total - maxLengthM) / 2;
  const endDist = startDist + maxLengthM;
  const out: GeoJSON.Position[] = [];
  let walked = 0;

  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i];
    const b = coords[i + 1];
    const seg = haversineM(a, b);
    const segStart = walked;
    const segEnd = walked + seg;

    if (segEnd >= startDist && segStart <= endDist) {
      if (segStart < startDist && seg > 0) {
        const t = (startDist - segStart) / seg;
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      } else if (out.length === 0) {
        out.push(a);
      }
      if (segEnd > endDist && seg > 0) {
        const t = (endDist - segStart) / seg;
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        break;
      } else {
        out.push(b);
      }
    }
    walked = segEnd;
  }

  if (out.length < 2) {
    const mid = coords[Math.floor(coords.length / 2)];
    return {
      type: "LineString",
      coordinates: [
        [mid[0] - 0.002, mid[1]],
        [mid[0] + 0.002, mid[1]],
      ],
    };
  }

  return { type: "LineString", coordinates: out };
}

/**
 * Tight corridor bbox for max zoom on the carriageway.
 * ~±corridorHalfWidthM around the (optionally clipped) road segment.
 */
export function roadAnalysisWindow(
  geometry: RoadGeom,
  options?: {
    maxLengthM?: number;
    corridorHalfWidthM?: number;
  },
): { bbox: BBox; geometry: GeoJSON.LineString; lengthM: number } {
  const maxLengthM = options?.maxLengthM ?? 900;
  const halfWidthM = options?.corridorHalfWidthM ?? 40;
  const clipped = clipRoadCenterWindow(geometry, maxLengthM);
  const coords = clipped.coordinates;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  let midLat = 0;
  for (const [lng, lat] of coords) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    midLat += lat;
  }
  midLat /= coords.length;

  const padLat = halfWidthM / 111_320;
  const padLng = halfWidthM / (111_320 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180)));

  // Keep nearly square frame for max detail on Esri export.
  let w = east - west + 2 * padLng;
  let h = north - south + 2 * padLat;
  const minSpan = 0.0018; // ~200 m
  const maxSpan = 0.012; // ~1.3 km — avoid country-scale crops
  w = Math.min(maxSpan, Math.max(minSpan, w));
  h = Math.min(maxSpan, Math.max(minSpan, h));
  const side = Math.max(w, h);
  const cx = (west + east) / 2;
  const cy = (south + north) / 2;

  const bbox: BBox = [
    cx - side / 2,
    cy - side / 2,
    cx + side / 2,
    cy + side / 2,
  ];

  return {
    bbox,
    geometry: clipped,
    lengthM: polylineLengthM(coords),
  };
}

export function projectLngLatToImage(
  lng: number,
  lat: number,
  bbox: BBox,
): { x: number; y: number } {
  const [west, south, east, north] = bbox;
  return {
    x: Math.min(0.98, Math.max(0.02, (lng - west) / (east - west))),
    y: Math.min(0.98, Math.max(0.02, (north - lat) / (north - south))),
  };
}
