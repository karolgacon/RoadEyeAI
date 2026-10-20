"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { RoadSegment } from "@/types/road";

interface SegmentHighlightProps {
  road: RoadSegment | null;
}

export function SegmentHighlight({ road }: SegmentHighlightProps) {
  const map = useMap();
  const lastFittedId = useRef<string | null>(null);

  useEffect(() => {
    if (!road) {
      lastFittedId.current = null;
      return;
    }
    // Fit once per selected road — don't fight user zoom afterwards.
    if (lastFittedId.current === road.id) {
      return;
    }
    lastFittedId.current = road.id;
    const layer = L.geoJSON(road.geometryGeoJson);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.35), { maxZoom: 14, animate: true });
    }
  }, [map, road]);

  return null;
}
