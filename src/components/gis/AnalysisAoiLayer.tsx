"use client";

import { Rectangle } from "react-leaflet";
import type { BBox } from "@/types/satellite";

interface AnalysisAoiLayerProps {
  bbox: BBox | null | undefined;
}

export function AnalysisAoiLayer({ bbox }: AnalysisAoiLayerProps) {
  if (!bbox) {
    return null;
  }
  const [west, south, east, north] = bbox;
  return (
    <Rectangle
      bounds={[
        [south, west],
        [north, east],
      ]}
      pathOptions={{
        color: "#ffffff",
        weight: 2,
        dashArray: "6 4",
        fillColor: "#fbbf24",
        fillOpacity: 0.08,
      }}
    />
  );
}
