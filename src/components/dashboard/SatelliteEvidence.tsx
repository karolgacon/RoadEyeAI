"use client";

import { useMemo } from "react";
import type { SurfaceDefect } from "@/types/analysis";
import { DEFECT_LABELS_PL } from "@/types/analysis";
import type { BBox } from "@/types/satellite";
import { colorForDefectSeverity } from "@/lib/map/defectGeo";

interface SatelliteEvidenceProps {
  imageUrl: string;
  defects: SurfaceDefect[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  conditionDescription?: string;
  /** Analysis AOI in WGS84 — used to project road onto the frame. */
  evidenceBbox?: BBox | null;
  roadGeometry?: GeoJSON.LineString | GeoJSON.MultiLineString | null;
  sourceLabel?: string;
}

function projectToFrame(
  lng: number,
  lat: number,
  bbox: BBox,
): { x: number; y: number } {
  const [west, south, east, north] = bbox;
  const x = (lng - west) / (east - west);
  const y = (north - lat) / (north - south);
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
}

function roadPolylinePoints(
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString,
  bbox: BBox,
): string {
  const rings =
    geometry.type === "LineString"
      ? [geometry.coordinates]
      : geometry.coordinates;
  const parts: string[] = [];
  for (const ring of rings) {
    const pts = ring.map(([lng, lat]) => {
      const p = projectToFrame(lng, lat, bbox);
      return `${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`;
    });
    if (pts.length >= 2) {
      parts.push(pts.join(" "));
    }
  }
  return parts.join(" ");
}

export function SatelliteEvidence({
  imageUrl,
  defects,
  selectedIndex,
  onSelect,
  conditionDescription,
  evidenceBbox,
  roadGeometry,
  sourceLabel = "Esri World Imagery",
}: SatelliteEvidenceProps) {
  const selected =
    selectedIndex !== null ? defects[selectedIndex] : undefined;

  const roadPoints = useMemo(() => {
    if (!evidenceBbox || !roadGeometry) {
      return null;
    }
    return roadPolylinePoints(roadGeometry, evidenceBbox);
  }, [evidenceBbox, roadGeometry]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-[0.12em] text-[#9ca3af] uppercase">
          Widok satelitarny jezdni
        </h3>
        <span className="truncate text-[10px] text-[#9ca3af]">
          {sourceLabel}
        </span>
      </div>

      <div className="relative aspect-square overflow-hidden rounded-xl border border-black/[0.08] bg-[#0b1220]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Klatka satelitarna odcinka drogi"
          className="absolute inset-0 h-full w-full object-cover select-none"
          draggable={false}
        />

        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {/* Full AOI taken into analysis */}
          <rect
            x="1.2"
            y="1.2"
            width="97.6"
            height="97.6"
            fill="none"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="0.7"
            strokeDasharray="2.2 1.4"
          />
          <rect
            x="1.2"
            y="1.2"
            width="97.6"
            height="97.6"
            fill="rgba(17,24,39,0.08)"
          />

          {roadPoints ? (
            <polyline
              points={roadPoints}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.95"
            />
          ) : null}

          {defects.map((defect, index) => {
            const cx = (defect.relativeX ?? 0.5) * 100;
            const cy = (defect.relativeY ?? 0.5) * 100;
            const w = (defect.relativeW ?? 0.1) * 100;
            const h = (defect.relativeH ?? 0.08) * 100;
            const active = selectedIndex === index;
            const color = colorForDefectSeverity(defect.severity);
            return (
              <g key={`shape-${defect.type}-${index}`}>
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={w / 2}
                  ry={h / 2}
                  fill={`${color}33`}
                  stroke={active ? "#ffffff" : color}
                  strokeWidth={active ? 1.1 : 0.7}
                  className="cursor-pointer"
                  onClick={() => onSelect(index)}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={active ? 1.6 : 1.15}
                  fill={color}
                  stroke="#111827"
                  strokeWidth="0.35"
                  className="cursor-pointer"
                  onClick={() => onSelect(index)}
                />
              </g>
            );
          })}
        </svg>

        <div className="pointer-events-none absolute top-2 left-2 rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium text-white">
          Korytarz jezdni (max zoom) — biała ramka
        </div>
        <div className="pointer-events-none absolute right-2 bottom-2 flex flex-col items-end gap-1 text-[10px] text-white">
          <span className="rounded-md bg-black/55 px-2 py-0.5">
            żółta = oś jezdni (jedyny obszar analizy)
          </span>
          <span className="rounded-md bg-black/55 px-2 py-0.5">
            elipsy = defekty snapowane do jezdni
          </span>
        </div>
      </div>

      {selected ? (
        <div className="rounded-xl border border-black/[0.06] bg-[#fafafa] px-3 py-2.5">
          <p className="text-[12px] font-semibold text-[#111827]">
            {DEFECT_LABELS_PL[selected.type]} · sev {selected.severity}
            {selected.severity >= 4 ? " · do naprawy" : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-[#6b7280]">
            {selected.locationHint}
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[#374151]">
            {selected.evidenceNote ??
              "Model wskazał ten fragment jezdni jako anomalię nawierzchni."}
          </p>
        </div>
      ) : conditionDescription ? (
        <p className="text-[12px] leading-relaxed text-[#6b7280]">
          {conditionDescription}
        </p>
      ) : (
        <p className="text-[11px] text-[#9ca3af]">
          Kliknij elipsę na kadrze, aby zobaczyć uzasadnienie klasyfikacji.
        </p>
      )}
    </section>
  );
}
