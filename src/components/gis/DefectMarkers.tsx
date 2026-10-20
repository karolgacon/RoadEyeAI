"use client";

import { CircleMarker, Popup, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { SurfaceDefect } from "@/types/analysis";
import { DEFECT_LABELS_PL } from "@/types/analysis";
import {
  colorForDefectSeverity,
  defectsWithCoordinates,
} from "@/lib/map/defectGeo";

interface DefectMarkersProps {
  defects: SurfaceDefect[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

function FlyToSelected({
  defects,
  selectedIndex,
}: {
  defects: Array<SurfaceDefect & { lat: number; lng: number }>;
  selectedIndex: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedIndex === null) {
      return;
    }
    const target = defects[selectedIndex];
    if (!target) {
      return;
    }
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), {
      duration: 0.7,
    });
  }, [map, defects, selectedIndex]);

  useEffect(() => {
    if (defects.length === 0) {
      return;
    }
    if (selectedIndex !== null) {
      return;
    }
    if (defects.length === 1) {
      map.flyTo([defects[0].lat, defects[0].lng], 15, { duration: 0.6 });
      return;
    }
    const lats = defects.map((d) => d.lat);
    const lngs = defects.map((d) => d.lng);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      { padding: [48, 48], maxZoom: 16 },
    );
  }, [map, defects, selectedIndex]);

  return null;
}

export function DefectMarkers({
  defects,
  selectedIndex,
  onSelect,
}: DefectMarkersProps) {
  const located = defectsWithCoordinates(defects);

  if (located.length === 0) {
    return null;
  }

  return (
    <>
      <FlyToSelected defects={located} selectedIndex={selectedIndex} />
      {located.map((defect, index) => {
        const selected = selectedIndex === index;
        const color = colorForDefectSeverity(defect.severity);
        const label = DEFECT_LABELS_PL[defect.type];
        return (
          <CircleMarker
            key={`${defect.type}-${defect.lat}-${defect.lng}-${index}`}
            center={[defect.lat, defect.lng]}
            radius={selected ? 12 : 8}
            pathOptions={{
              color: selected ? "#111827" : color,
              fillColor: color,
              fillOpacity: selected ? 0.95 : 0.8,
              weight: selected ? 3 : 2,
            }}
            eventHandlers={{
              click: () => onSelect(index),
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <span className="text-[11px] font-semibold">
                {label} · sev {defect.severity}
              </span>
            </Tooltip>
            <Popup>
              <div className="min-w-[160px] text-[12px]">
                <p className="font-semibold text-[#111827]">{label}</p>
                <p className="mt-0.5 text-[#6b7280]">{defect.locationHint}</p>
                <p className="mt-1 tabular-nums text-[#9ca3af]">
                  sev {defect.severity} · {defect.lat.toFixed(5)},{" "}
                  {defect.lng.toFixed(5)}
                </p>
                {defect.severity >= 4 ? (
                  <p className="mt-1 font-medium text-[#b91c1c]">
                    Priorytet remontu
                  </p>
                ) : null}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
