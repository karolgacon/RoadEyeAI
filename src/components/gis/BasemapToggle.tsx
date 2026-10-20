"use client";

export type BasemapId = "osm" | "esri" | "leo";

interface BasemapToggleProps {
  value: BasemapId;
  onChange: (value: BasemapId) => void;
}

const OPTIONS: { id: BasemapId; label: string }[] = [
  { id: "osm", label: "Mapa" },
  { id: "esri", label: "HD" },
  { id: "leo", label: "LEO" },
];

export function BasemapToggle({ value, onChange }: BasemapToggleProps) {
  return (
    <div className="flex h-9 overflow-hidden rounded-xl border border-black/[0.08] bg-[#f4f5f7] p-0.5 text-[12px] font-semibold">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`rounded-[10px] px-2.5 transition sm:px-3 ${
            value === opt.id
              ? "bg-white text-[#111827] shadow-sm"
              : "text-[#6b7280] hover:text-[#111827]"
          }`}
          onClick={() => onChange(opt.id)}
          title={
            opt.id === "leo"
              ? "Sentinel-2 LEO (Copernicus) — najnowsze scany ~45 dni"
              : opt.id === "esri"
                ? "Esri World Imagery — ostra mozaika HD (nie dzienna)"
                : "OpenStreetMap"
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
