"use client";

import type { SurfaceDefect } from "@/types/analysis";
import { DEFECT_LABELS_PL } from "@/types/analysis";
import { colorForDefectSeverity } from "@/lib/map/defectGeo";

interface SatelliteEvidenceProps {
  imageUrl: string;
  defects: SurfaceDefect[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  conditionDescription?: string;
}

export function SatelliteEvidence({
  imageUrl,
  defects,
  selectedIndex,
  onSelect,
  conditionDescription,
}: SatelliteEvidenceProps) {
  const selected =
    selectedIndex !== null ? defects[selectedIndex] : undefined;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-[0.12em] text-[#9ca3af] uppercase">
          Dowód satelitarny
        </h3>
        <span className="text-[10px] text-[#9ca3af]">
          kliknij znacznik na kadrze
        </span>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-black/[0.08] bg-[#0b1220]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Klatka satelitarna z oznaczeniami defektów"
          className="block w-full select-none"
          draggable={false}
        />

        {defects.map((defect, index) => {
          const x = defect.relativeX ?? 0.5;
          const y = defect.relativeY ?? 0.5;
          const active = selectedIndex === index;
          const color = colorForDefectSeverity(defect.severity);
          return (
            <button
              key={`ev-${defect.type}-${index}`}
              type="button"
              title={DEFECT_LABELS_PL[defect.type]}
              onClick={() => onSelect(index)}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-md transition"
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                width: active ? 22 : 16,
                height: active ? 22 : 16,
                backgroundColor: color,
                borderColor: active ? "#fff" : "rgba(0,0,0,0.35)",
                boxShadow: active
                  ? `0 0 0 3px ${color}55, 0 2px 8px rgba(0,0,0,0.45)`
                  : "0 1px 4px rgba(0,0,0,0.4)",
                zIndex: active ? 3 : 2,
              }}
            />
          );
        })}

        {defects.length === 0 ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-[11px] text-white/90">
            Brak oznaczonych defektów na jezdni
          </div>
        ) : null}
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
          Wybierz znacznik, aby zobaczyć uzasadnienie modelu.
        </p>
      )}
    </section>
  );
}
