"use client";

import { useCallback, useState } from "react";
import type { RoadSegment } from "@/types/road";

export function useRoadSelection() {
  const [selectedRoad, setSelectedRoad] = useState<RoadSegment | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedRoad(null);
  }, []);

  return { selectedRoad, setSelectedRoad, clearSelection };
}
