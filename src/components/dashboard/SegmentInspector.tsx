"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Satellite, X } from "lucide-react";
import type { RoadSegment } from "@/types/road";
import { PCI_COLORS, PCI_LABELS } from "@/types/pci";
import { colorForPci } from "@/lib/map/pciColors";

interface SegmentInspectorProps {
  road: RoadSegment;
  onClose: () => void;
  analyzing?: boolean;
  loadingReport?: boolean;
  onAnalyze: () => void;
  onViewReport?: () => void;
}

function InspectorBody({
  road,
  onClose,
  analyzing = false,
  loadingReport = false,
  onAnalyze,
  onViewReport,
}: {
  road: RoadSegment;
  onClose: () => void;
  analyzing?: boolean;
  loadingReport?: boolean;
  onAnalyze: () => void;
  onViewReport?: () => void;
}) {
  const hasPci = road.latestPci !== null;

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-4 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#9ca3af] uppercase">
            Odcinek
          </p>
          <h2 className="mt-0.5 truncate text-[18px] font-semibold tracking-tight text-[#111827]">
            {road.ref ?? "Bez numeru"}
          </h2>
          <p className="mt-0.5 truncate text-[13px] text-[#6b7280]">
            {road.name ?? "Brak nazwy w OSM"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#6b7280] transition hover:bg-[#f4f5f7]"
          aria-label="Zamknij"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
        <div className="flex items-center gap-4 rounded-2xl border border-black/[0.06] bg-[#fafafa] p-4">
          <div
            className="grid h-14 w-14 place-items-center rounded-2xl text-lg font-bold text-white"
            style={{ backgroundColor: colorForPci(road.latestPci) }}
          >
            {road.latestPci ?? "—"}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#6b7280]">
              Pavement Condition
            </p>
            <p className="text-[15px] font-semibold text-[#111827]">
              {hasPci && road.latestPci
                ? PCI_LABELS[road.latestPci]
                : "Nieprzeanalizowany"}
            </p>
            <p className="mt-0.5 text-[12px] text-[#9ca3af]">
              {hasPci
                ? "Ocena z pipeline’u AI"
                : "Czeka na skan Sentinel-2 + Gemini"}
            </p>
          </div>
        </div>

        {hasPci && road.latestPci ? (
          <div className="flex gap-1">
            {([1, 2, 3, 4, 5] as const).map((score) => (
              <div
                key={score}
                className="h-1.5 flex-1 rounded-full"
                style={{
                  backgroundColor:
                    score <= road.latestPci!
                      ? PCI_COLORS[road.latestPci!]
                      : "#e5e7eb",
                }}
              />
            ))}
          </div>
        ) : null}

        <dl className="space-y-0 divide-y divide-black/[0.06] rounded-2xl border border-black/[0.06]">
          <Row label="Klasa OSM" value={road.roadClass} />
          <Row label="Referencja" value={road.ref ?? "—"} />
          <Row label="OSM ID" value={road.osmId ?? "—"} mono />
          <Row
            label="Ostatnia analiza"
            value={
              road.latestAnalyzedAt
                ? new Date(road.latestAnalyzedAt).toLocaleString("pl-PL")
                : "—"
            }
          />
        </dl>

        <div className="rounded-2xl border border-dashed border-[#d1d5db] bg-[#fcfcfd] px-4 py-5 text-center">
          <p className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-[#111827]">
            <Satellite className="h-3.5 w-3.5" />
            Analiza odcinka
          </p>
          <p className="mx-auto mt-1 max-w-[260px] text-[12px] leading-relaxed text-[#6b7280]">
            Pobiera klatkę Sentinel-2 wokół tego odcinka, potem możesz uruchomić
            ocenę Gemini Vision.
          </p>
          <button
            type="button"
            disabled={analyzing}
            onClick={onAnalyze}
            className="mt-3 flex h-10 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 text-[12px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Pobieram skan…
              </>
            ) : (
              "Uruchom analizę"
            )}
          </button>
          {hasPci && onViewReport ? (
            <button
              type="button"
              disabled={loadingReport}
              onClick={onViewReport}
              className="mt-2 flex h-10 w-full max-w-xs items-center justify-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 text-[12px] font-semibold text-[#111827] transition hover:bg-[#f4f5f7] disabled:opacity-40"
            >
              {loadingReport ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Ładuję raport…
                </>
              ) : (
                "Zobacz raport + eksport"
              )}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function SegmentInspector({
  road,
  onClose,
  analyzing = false,
  loadingReport = false,
  onAnalyze,
  onViewReport,
}: SegmentInspectorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mobileSheet =
    mounted &&
    createPortal(
      <div className="md:hidden">
        <button
          type="button"
          aria-label="Zamknij szczegóły odcinka"
          className="fixed inset-0 bg-black/30"
          style={{ zIndex: 10000 }}
          onClick={onClose}
        />
        <aside
          className="fixed inset-x-0 bottom-0 flex max-h-[75dvh] flex-col rounded-t-2xl border border-black/[0.06] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_40px_rgba(0,0,0,0.15)]"
          style={{ zIndex: 10010 }}
        >
          <div className="flex justify-center pt-2">
            <span className="h-1 w-10 rounded-full bg-[#d1d5db]" />
          </div>
          <InspectorBody
            road={road}
            onClose={onClose}
            analyzing={analyzing}
            loadingReport={loadingReport}
            onAnalyze={onAnalyze}
            onViewReport={onViewReport}
          />
        </aside>
      </div>,
      document.body,
    );

  return (
    <>
      <aside className="hidden h-full w-[340px] shrink-0 flex-col border-l border-black/[0.06] bg-white md:flex">
        <InspectorBody
          road={road}
          onClose={onClose}
          analyzing={analyzing}
          loadingReport={loadingReport}
          onAnalyze={onAnalyze}
          onViewReport={onViewReport}
        />
      </aside>
      {mobileSheet}
    </>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]">
      <dt className="shrink-0 text-[#6b7280]">{label}</dt>
      <dd
        className={`truncate text-right font-medium text-[#111827] ${mono ? "font-mono text-[11px]" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
