"use client";

import { CircleMarker, Popup, Tooltip, useMap } from "react-leaflet";
import { useEffect, useRef } from "react";
import type { SurfaceDefect } from "@/types/analysis";
import { DEFECT_LABELS_PL } from "@/types/analysis";
import {
  colorForDefectSeverity,
  defectsWithCoordinates,
} from "@/lib/map/defectGeo";

interface DefectMarkersProps {
  defects: SurfaceDefect[];
  selectedIndex: number | null;
  fitKey?: string;
  onSelect: (index: number) => void;
}

function CameraForDefects({
  defects,
  selectedIndex,
  fitKey,
}: {
  defects: Array<SurfaceDefect & { lat: number; lng: number }>;
  selectedIndex: number | null;
  fitKey?: string;
}) {
  const map = useMap();
  const fittedKey = useRef<string | null>(null);
  const lastSelected = useRef<number | null>(null);

  // One-time gentle fit when a report opens — never re-locks zoom afterwards.
  useEffect(() => {
    const key = fitKey ?? "default";
    if (defects.length === 0) {
      return;
    }
    if (fittedKey.current === key) {
      return;
    }
    fittedKey.current = key;

    if (defects.length === 1) {
      map.setView([defects[0].lat, defects[0].lng], 14, { animate: true });
      return;
    }
    const lats = defects.map((d) => d.lat);
    const lngs = defects.map((d) => d.lng);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      { padding: [56, 56], maxZoom: 15, animate: true },
    );
  }, [map, defects, fitKey]);

  // Pan to selection without forcing high zoom (allows zoom-out afterwards).
  useEffect(() => {
    if (selectedIndex === null) {
      lastSelected.current = null;
      return;
    }
    if (lastSelected.current === selectedIndex) {
      return;
    }
    lastSelected.current = selectedIndex;
    const target = defects[selectedIndex];
    if (!target) {
      return;
    }
    const nextZoom = Math.min(Math.max(map.getZoom(), 13), 16);
    map.panTo([target.lat, target.lng], { animate: true });
    if (map.getZoom() < 13) {
      map.setZoom(nextZoom, { animate: true });
    }
  }, [map, defects, selectedIndex]);

  return null;
}

export function DefectMarkers({
  defects,
  selectedIndex,
  fitKey,
  onSelect,
}: DefectMarkersProps) {
  const located = defectsWithCoordinates(defects);

  if (located.length === 0) {
    return null;
  }

  return (
    <>
      <CameraForDefects
        defects={located}
        selectedIndex={selectedIndex}
        fitKey={fitKey}
      />
      {located.map((defect, index) => {
        const selected = selectedIndex === index;
        const color = colorForDefectSeverity(defect.severity);
        const label = DEFECT_LABELS_PL[defect.type];
        return (
          <CircleMarker
            key={`${defect.type}-${defect.lat}-${defect.lng}-${index}`}
            center={[defect.lat, defect.lng]}
            radius={selected ? 11 : 7}
            pathOptions={{
              color: selected ? "#111827" : color,
              fillColor: color,
              fillOpacity: selected ? 0.95 : 0.85,
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
              <div className="min-w-[180px] text-[12px]">
                <p className="font-semibold text-[#111827]">{label}</p>
                <p className="mt-0.5 text-[#6b7280]">{defect.locationHint}</p>
                {defect.evidenceNote ? (
                  <p className="mt-1 text-[#374151]">{defect.evidenceNote}</p>
                ) : null}
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
