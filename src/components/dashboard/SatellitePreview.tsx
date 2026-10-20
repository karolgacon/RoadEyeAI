"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Cloud, Satellite, Sparkles, X } from "lucide-react";
import type { SatelliteImageResponse } from "@/types/satellite";

interface HdPreview {
  imageUrl: string;
  source: "esri";
}

interface QualityInfo {
  cloudCoverage: number;
  textureScore: number;
  usable: boolean;
  reason: string;
  measuredBy?: string;
}

interface SatellitePreviewProps {
  image: SatelliteImageResponse;
  hdPreview?: HdPreview | null;
  visionSource?: "leo" | "esri";
  quality?: QualityInfo | null;
  cloudBlocked: boolean;
  threshold: number;
  message?: string;
  analyzingAi?: boolean;
  onAnalyzeAi: () => void;
  onClose: () => void;
}

export function SatellitePreview({
  image,
  hdPreview = null,
  visionSource = "leo",
  quality = null,
  cloudBlocked,
  threshold,
  message,
  analyzingAi = false,
  onAnalyzeAi,
  onClose,
}: SatellitePreviewProps) {
  const [mounted, setMounted] = useState(false);
  const showDual = image.source === "copernicus" && Boolean(hdPreview?.imageUrl);
  const aiOnHd = visionSource === "esri" && Boolean(hdPreview?.imageUrl);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const cloudPct = (
    (quality?.cloudCoverage ?? image.cloudCoverage) * 100
  ).toFixed(0);

  return createPortal(
    <div className="fixed inset-0 z-[10020] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Zamknij podgląd"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-4 py-3">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-[#9ca3af] uppercase">
              <Satellite className="h-3.5 w-3.5" />
              Skan satelitarny
            </p>
            <h2 className="mt-0.5 text-[16px] font-semibold text-[#111827]">
              {image.source === "copernicus"
                ? "Sentinel-2 LEO + podgląd HD"
                : image.source === "esri"
                  ? "Esri — podgląd zastępczy"
                  : "Podgląd zastępczy"}
            </h2>
            <p className="mt-0.5 text-[11px] leading-snug text-[#6b7280]">
              {aiOnHd
                ? "LEO nieczytelny (chmury/rozmazanie) — AI przełączy się na HD tylko dla tej analizy."
                : image.source === "copernicus"
                  ? "LEO czytelny — AI analizuje Sentinel-2. HD to tylko podgląd referencyjny."
                  : "Brak kluczy Copernicus — mozaika Esri."}
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
          {showDual ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Frame
                src={hdPreview!.imageUrl}
                alt="Podgląd HD Esri"
                caption={
                  aiOnHd
                    ? "HD (Esri) — źródło analizy AI (fallback)"
                    : "Podgląd HD (Esri) — referencja"
                }
                active={aiOnHd}
              />
              <Frame
                src={image.imageUrl}
                alt="Scena Sentinel-2 LEO"
                caption={
                  aiOnHd
                    ? "LEO Sentinel-2 — odrzucony (jakość)"
                    : "LEO Sentinel-2 — źródło analizy AI"
                }
                active={!aiOnHd}
              />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.imageUrl}
              alt="Podgląd skanu satelitarnego"
              className="w-full rounded-xl border border-black/[0.06] bg-[#111827]"
            />
          )}

          <dl className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
            <Info label="Evalscript" value={image.evalscriptId} />
            <Info
              label="Chmury SCL"
              value={`${cloudPct}%${
                quality?.measuredBy === "scl_stats"
                  ? " · Stats"
                  : quality?.measuredBy === "scl_mask"
                    ? " · mask"
                    : ""
              }`}
            />
            <Info
              label="Tekstura"
              value={
                quality ? quality.textureScore.toFixed(3) : "—"
              }
            />
            <Info
              label="AI bierze"
              value={aiOnHd ? "HD (fallback)" : "LEO"}
            />
          </dl>

          {cloudBlocked ? (
            <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-950">
              <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                {message ??
                  `LEO nieczytelny (chmury > ${(threshold * 100).toFixed(0)}%) i brak HD — analiza zablokowana.`}
              </p>
            </div>
          ) : (
            <div
              className={`mt-3 rounded-xl border px-3 py-2.5 text-[12.5px] ${
                aiOnHd
                  ? "border-amber-200 bg-amber-50 text-amber-950"
                  : "border-emerald-200 bg-emerald-50 text-emerald-950"
              }`}
            >
              {message ??
                (aiOnHd
                  ? "Fallback HD aktywny — możesz uruchomić Gemini Vision."
                  : "LEO poniżej progu chmur/rozmazania — możesz uruchomić Gemini Vision.")}
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
            {analyzingAi
              ? "Analizuję Vision…"
              : aiOnHd
                ? "Uruchom analizę AI (HD)"
                : "Uruchom analizę AI (LEO)"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Frame({
  src,
  alt,
  caption,
  active,
}: {
  src: string;
  alt: string;
  caption: string;
  active?: boolean;
}) {
  return (
    <figure className="space-y-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`aspect-square w-full rounded-xl border bg-[#111827] object-fill ${
          active
            ? "border-[#111827] ring-2 ring-[#111827]/20"
            : "border-black/[0.06] opacity-90"
        }`}
      />
      <figcaption className="text-[10px] leading-snug font-medium text-[#6b7280]">
        {caption}
      </figcaption>
    </figure>
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
