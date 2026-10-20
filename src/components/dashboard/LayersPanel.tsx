"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { RoadClass } from "@/types/road";
import { PCI_COLORS, PCI_LABELS, type PciScore } from "@/types/pci";

const FILTERS: { id: RoadClass | "all"; label: string }[] = [
  { id: "all", label: "Wszystkie" },
  { id: "motorway", label: "A" },
  { id: "trunk", label: "S" },
  { id: "primary", label: "DK" },
  { id: "secondary", label: "DW" },
];

const SCORES: PciScore[] = [5, 4, 3, 2, 1];

export interface NetworkStats {
  inView: number;
  assessed: number;
  loading: boolean;
}

interface LayersPanelProps {
  stats: NetworkStats;
  classFilter: RoadClass | "all";
  onClassFilterChange: (value: RoadClass | "all") => void;
  aoiActive: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function PanelBody({
  stats,
  classFilter,
  onClassFilterChange,
  aoiActive,
  onPickFilter,
  onClose,
  showClose,
}: {
  stats: NetworkStats;
  classFilter: RoadClass | "all";
  onClassFilterChange: (value: RoadClass | "all") => void;
  aoiActive: boolean;
  onPickFilter?: () => void;
  onClose?: () => void;
  showClose?: boolean;
}) {
  const assessedPct =
    stats.inView === 0 ? 0 : Math.round((stats.assessed / stats.inView) * 100);

  return (
    <>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-black/[0.06] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#9ca3af] uppercase">
            Warstwy
          </p>
          <h2 className="mt-0.5 text-[15px] font-semibold tracking-tight text-[#111827]">
            Sieć drogowa PL
          </h2>
        </div>
        {showClose && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-black/[0.08] text-[#111827] transition hover:bg-[#f4f5f7]"
            aria-label="Zamknij menu"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="W widoku"
            value={stats.loading ? "…" : String(stats.inView)}
          />
          <StatCard label="Z oceną PCI" value={`${assessedPct}%`} />
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-semibold text-[#111827]">Drogi OSM</p>
            <span className="rounded-md bg-[#ecfdf5] px-1.5 py-0.5 text-[10px] font-semibold text-[#047857]">
              ON
            </span>
          </div>
          <p className="text-[12px] leading-relaxed text-[#6b7280]">
            A / S / DK / DW (OSM) · filtr klasy idzie do API · max 2000 w
            viewportcie
          </p>
        </section>

        <section>
          <p className="mb-2 text-[12px] font-semibold text-[#111827]">Klasa</p>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((filter) => {
              const active = classFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => {
                    onClassFilterChange(filter.id);
                    onPickFilter?.();
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition ${
                    active
                      ? "bg-[#111827] text-white"
                      : "bg-[#f4f5f7] text-[#4b5563] hover:bg-[#e5e7eb]"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <p className="mb-2 text-[12px] font-semibold text-[#111827]">
            Legenda PCI
          </p>
          <ul className="space-y-1.5">
            {SCORES.map((score) => (
              <li
                key={score}
                className="flex items-center gap-2 text-[12px] text-[#374151]"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: PCI_COLORS[score] }}
                />
                <span className="w-3 tabular-nums font-medium">{score}</span>
                <span className="text-[#6b7280]">{PCI_LABELS[score]}</span>
              </li>
            ))}
            <li className="flex items-center gap-2 border-t border-black/[0.06] pt-1.5 text-[12px] text-[#6b7280]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#9ca3af]" />
              bez analizy
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-black/[0.06] bg-[#fafafa] p-3">
          <p className="text-[12px] font-semibold text-[#111827]">AOI</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#6b7280]">
            {aoiActive
              ? "Obszar zaznaczony — gotowy pod analizę satelitarną."
              : "Narysuj prostokąt na mapie (narzędzie po lewej stronie mapy)."}
          </p>
        </section>
      </div>
    </>
  );
}

export function LayersPanel({
  stats,
  classFilter,
  onClassFilterChange,
  aoiActive,
  mobileOpen,
  onMobileClose,
}: LayersPanelProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const mobileDrawer =
    mounted &&
    createPortal(
      <div className="lg:hidden">
        <button
          type="button"
          aria-label="Zamknij panel warstw"
          className={`fixed inset-0 bg-black/40 transition-opacity ${
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          style={{ zIndex: 10000 }}
          onClick={onMobileClose}
        />
        <aside
          className={`fixed top-0 bottom-0 left-0 flex w-[min(300px,86vw)] flex-col bg-white shadow-2xl transition-transform duration-200 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{
            zIndex: 10010,
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
          <PanelBody
            stats={stats}
            classFilter={classFilter}
            onClassFilterChange={onClassFilterChange}
            aoiActive={aoiActive}
            onPickFilter={onMobileClose}
            onClose={onMobileClose}
            showClose
          />
          <div className="shrink-0 border-t border-black/[0.06] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onMobileClose}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#111827] text-[13px] font-semibold text-white transition hover:bg-black"
            >
              Zamknij menu
            </button>
          </div>
        </aside>
      </div>,
      document.body,
    );

  return (
    <>
      <aside className="hidden h-full w-[280px] shrink-0 flex-col border-r border-black/[0.06] bg-white lg:flex">
        <PanelBody
          stats={stats}
          classFilter={classFilter}
          onClassFilterChange={onClassFilterChange}
          aoiActive={aoiActive}
        />
      </aside>
      {mobileDrawer}
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-[#fafafa] px-3 py-2.5">
      <p className="text-[10px] font-medium tracking-wide text-[#9ca3af] uppercase">
        {label}
      </p>
      <p className="mt-1 text-[20px] font-semibold tracking-tight text-[#111827] tabular-nums">
        {value}
      </p>
    </div>
  );
}
