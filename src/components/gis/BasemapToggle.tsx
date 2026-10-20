"use client";

export type BasemapId = "osm" | "esri";

interface BasemapToggleProps {
  value: BasemapId;
  onChange: (value: BasemapId) => void;
}

export function BasemapToggle({ value, onChange }: BasemapToggleProps) {
  return (
    <div className="flex h-9 overflow-hidden rounded-xl border border-black/[0.08] bg-[#f4f5f7] p-0.5 text-[12px] font-semibold">
      <button
        type="button"
        className={`rounded-[10px] px-3 transition ${
          value === "osm"
            ? "bg-white text-[#111827] shadow-sm"
            : "text-[#6b7280] hover:text-[#111827]"
        }`}
        onClick={() => onChange("osm")}
      >
        Mapa
      </button>
      <button
        type="button"
        className={`rounded-[10px] px-3 transition ${
          value === "esri"
            ? "bg-white text-[#111827] shadow-sm"
            : "text-[#6b7280] hover:text-[#111827]"
        }`}
        onClick={() => onChange("esri")}
      >
        Satelita
      </button>
    </div>
  );
}
