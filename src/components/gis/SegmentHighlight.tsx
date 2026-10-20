"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { RoadSegment } from "@/types/road";

interface SegmentHighlightProps {
  road: RoadSegment | null;
}

export function SegmentHighlight({ road }: SegmentHighlightProps) {
  const map = useMap();

  useEffect(() => {
    if (!road) {
      return;
    }
    const layer = L.geoJSON(road.geometryGeoJson);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.35), { maxZoom: 14, animate: true });
    }
  }, [map, road]);

  return null;
}
