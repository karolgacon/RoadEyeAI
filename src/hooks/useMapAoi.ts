"use client";

import { useCallback, useState } from "react";
import type { BBox } from "@/types/satellite";

export function useMapAoi() {
  const [aoi, setAoi] = useState<BBox | null>(null);

  const clearAoi = useCallback(() => {
    setAoi(null);
  }, []);

  return { aoi, setAoi, clearAoi };
}
