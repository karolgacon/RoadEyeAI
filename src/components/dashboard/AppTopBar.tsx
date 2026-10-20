"use client";

import { Menu, Search, X } from "lucide-react";
import {
  BasemapToggle,
  type BasemapId,
} from "@/components/gis/BasemapToggle";

interface AppTopBarProps {
  basemap: BasemapId;
  onBasemapChange: (value: BasemapId) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onAnalyzeClick: () => void;
  analyzeEnabled: boolean;
  analyzing?: boolean;
  layersOpen: boolean;
  onToggleLayers: () => void;
}

export function AppTopBar({
  basemap,
  onBasemapChange,
  search,
  onSearchChange,
  onAnalyzeClick,
  analyzeEnabled,
  analyzing = false,
  layersOpen,
  onToggleLayers,
}: AppTopBarProps) {
  return (
    <header className="relative z-[1100] shrink-0 border-b border-black/[0.06] bg-white/95 backdrop-blur-xl">
      <div className="flex h-12 items-center gap-2 px-3 sm:h-14 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={onToggleLayers}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-black/[0.08] text-[#111827] transition hover:bg-[#f4f5f7] lg:hidden"
          aria-label={layersOpen ? "Zamknij panel" : "Otwórz warstwy"}
        >
          {layersOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#111827] text-[12px] font-bold tracking-tight text-white">
            RE
          </div>
          <div className="hidden leading-tight min-[420px]:block">
            <p className="truncate text-[13px] font-semibold tracking-tight text-[#111827]">
              RoadEye AI
            </p>
            <p className="hidden text-[11px] text-[#6b7280] sm:block">
              Network intelligence
            </p>
          </div>
        </div>

        <div className="mx-1 flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-black/[0.08] bg-[#f4f5f7] px-2.5 py-1.5 sm:mx-auto sm:max-w-md sm:px-3">
          <Search className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="S8, DK7, A2…"
            className="w-full min-w-0 bg-transparent text-[13px] text-[#111827] outline-none placeholder:text-[#9ca3af]"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:block">
            <BasemapToggle value={basemap} onChange={onBasemapChange} />
          </div>
          <button
            type="button"
            disabled={!analyzeEnabled || analyzing}
            onClick={onAnalyzeClick}
            className="h-9 rounded-xl bg-[#111827] px-2.5 text-[12px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 sm:px-3.5 sm:text-[13px]"
          >
            {analyzing ? (
              "Pobieram…"
            ) : (
              <>
                <span className="sm:hidden">AOI</span>
                <span className="hidden sm:inline">Analizuj AOI</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-black/[0.04] px-3 py-2 sm:hidden">
        <BasemapToggle value={basemap} onChange={onBasemapChange} />
        <p className="text-[11px] text-[#9ca3af]">
          {analyzeEnabled ? "AOI gotowe" : "Zaznacz obszar na mapie"}
        </p>
      </div>
    </header>
  );
}
