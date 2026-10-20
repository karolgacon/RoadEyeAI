"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-draw";
import type { BBox } from "@/types/satellite";

interface AoiDrawControlProps {
  onAoiChange: (bbox: BBox | null) => void;
}

export function AoiDrawControl({ onAoiChange }: AoiDrawControlProps) {
  const map = useMap();

  useEffect(() => {
    const featureGroup = new L.FeatureGroup();
    map.addLayer(featureGroup);

    const drawControl = new L.Control.Draw({
      position: "topleft",
      draw: {
        polygon: false,
        polyline: false,
        circle: false,
        marker: false,
        circlemarker: false,
        rectangle: {
          shapeOptions: {
            color: "#10B981",
            weight: 2,
          },
        },
      },
      edit: {
        featureGroup,
        remove: true,
      },
    });

    map.addControl(drawControl);

    const onCreated = (event: L.LeafletEvent) => {
      const created = event as unknown as { layer: L.Layer };
      featureGroup.clearLayers();
      featureGroup.addLayer(created.layer);
      if (created.layer instanceof L.Rectangle) {
        const bounds = created.layer.getBounds();
        onAoiChange([
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ]);
      }
    };

    const onDeleted = () => {
      onAoiChange(null);
    };

    map.on(L.Draw.Event.CREATED, onCreated);
    map.on(L.Draw.Event.DELETED, onDeleted);

    return () => {
      map.off(L.Draw.Event.CREATED, onCreated);
      map.off(L.Draw.Event.DELETED, onDeleted);
      map.removeControl(drawControl);
      map.removeLayer(featureGroup);
    };
  }, [map, onAoiChange]);

  return null;
}
