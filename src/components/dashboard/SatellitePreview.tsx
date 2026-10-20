"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Cloud, Satellite, Sparkles, X } from "lucide-react";
import type { SatelliteImageResponse } from "@/types/satellite";

interface SatellitePreviewProps {
  image: SatelliteImageResponse;
  cloudBlocked: boolean;
  threshold: number;
  message?: string;
  analyzingAi?: boolean;
  onAnalyzeAi: () => void;
  onClose: () => void;
}

export function SatellitePreview({
  image,
  cloudBlocked,
  threshold,
  message,
  analyzingAi = false,
  onAnalyzeAi,
  onClose,
}: SatellitePreviewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[10020] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Zamknij podgląd"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-4 py-3">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-[#9ca3af] uppercase">
              <Satellite className="h-3.5 w-3.5" />
              Skan satelitarny
            </p>
            <h2 className="mt-0.5 text-[16px] font-semibold text-[#111827]">
              {image.source === "esri"
                ? "Esri World Imagery — podgląd jezdni"
                : image.source === "mock"
                  ? "Podgląd zastępczy"
                  : "Sentinel-2 L2A"}
            </h2>
            <p className="mt-0.5 text-[11px] text-[#9ca3af]">
              {image.source === "esri"
                ? "Mozaika satelitarna terenu (nie stream LEO na żywo)"
                : "Klatka użyta do analizy AI"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-black/[0.08]"
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <img
            src={image.imageUrl}
            alt="Podgląd skanu satelitarnego"
            className="w-full rounded-xl border border-black/[0.06] bg-[#111827]"
          />

          <dl className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
            <Info label="Evalscript" value={image.evalscriptId} />
            <Info
              label="Zachmurzenie"
              value={`${(image.cloudCoverage * 100).toFixed(0)}%`}
            />
            <Info
              label="Acquired"
              value={new Date(image.acquiredAt).toLocaleDateString("pl-PL")}
            />
            <Info label="Rozmiar" value={`${image.width}×${image.height}`} />
          </dl>

          {cloudBlocked ? (
            <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-950">
              <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                {message ??
                  `Cloud > ${(threshold * 100).toFixed(0)}% — analiza AI Vision zablokowana. Wybierz inny zakres dat.`}
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12.5px] text-emerald-950">
              Scena poniżej progu chmur — możesz uruchomić Gemini Vision.
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-black/[0.06] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={cloudBlocked || analyzingAi}
            onClick={onAnalyzeAi}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#111827] text-[13px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles className="h-4 w-4" />
            {analyzingAi ? "Analizuję Vision…" : "Uruchom analizę AI"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f4f5f7] px-3 py-2">
      <dt className="text-[10px] font-medium tracking-wide text-[#9ca3af] uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-[#111827]">{value}</dd>
    </div>
  );
}
