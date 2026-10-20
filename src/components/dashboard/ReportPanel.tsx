"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Download, FileJson, FileText, Loader2, MapPin, X } from "lucide-react";
import { PCI_COLORS, PCI_LABELS } from "@/types/pci";
import {
  DEFECT_LABELS_PL,
  type RoadAnalysisResult,
} from "@/types/analysis";
import {
  buildReportExportPayload,
  type ReportExportPayload,
} from "@/lib/pdf/reportTypes";
import { colorForDefectSeverity } from "@/lib/map/defectGeo";
import { SatelliteEvidence } from "@/components/dashboard/SatelliteEvidence";
import type { BBox } from "@/types/satellite";

export interface ReportViewModel {
  reportId: string;
  roadId: string;
  scanId: string;
  modelId: string;
  createdAt: string;
  provider?: string;
  result: RoadAnalysisResult;
  road?: ReportExportPayload["road"];
  /** Satellite frame used for the analysis (for evidence overlay). */
  evidenceImageUrl?: string | null;
  evidenceBbox?: BBox | null;
  evidenceSourceLabel?: string;
  roadGeometry?: GeoJSON.LineString | GeoJSON.MultiLineString | null;
}

interface ReportPanelProps {
  report: ReportViewModel;
  selectedDefectIndex?: number | null;
  onSelectDefect?: (index: number) => void;
  onClose: () => void;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportPanel({
  report,
  selectedDefectIndex = null,
  onSelectDefect,
  onClose,
}: ReportPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [exporting, setExporting] = useState<"json" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const payload = buildReportExportPayload({
    reportId: report.reportId,
    roadId: report.roadId,
    scanId: report.scanId,
    modelId: report.modelId,
    createdAt: report.createdAt,
    result: report.result,
    provider: report.provider,
    road: report.road,
  });

  const handleExportJson = () => {
    setExportError(null);
    setExporting("json");
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      downloadBlob(
        blob,
        `roadeye-report-${report.reportId.slice(0, 8)}.json`,
      );
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Błąd eksportu JSON",
      );
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setExportError(null);
    setExporting("pdf");
    try {
      const response = await fetch(`/api/reports/${report.reportId}/pdf`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      downloadBlob(
        blob,
        `roadeye-pci-${report.result.pciScore}-${report.reportId.slice(0, 8)}.pdf`,
      );
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Błąd eksportu PDF",
      );
    } finally {
      setExporting(null);
    }
  };

  const body = (
    <ReportBody
      report={report}
      exporting={exporting}
      exportError={exportError}
      selectedDefectIndex={selectedDefectIndex}
      onSelectDefect={onSelectDefect}
      onExportJson={handleExportJson}
      onExportPdf={() => {
        void handleExportPdf();
      }}
      onClose={onClose}
    />
  );

  if (!mounted) {
    return null;
  }

  const mobile = createPortal(
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Zamknij raport"
        className="fixed inset-0 bg-black/35"
        style={{ zIndex: 10020 }}
        onClick={onClose}
      />
      <aside
        className="fixed inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl border border-black/[0.06] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_40px_rgba(0,0,0,0.15)]"
        style={{ zIndex: 10030 }}
      >
        <div className="flex justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-[#d1d5db]" />
        </div>
        {body}
      </aside>
    </div>,
    document.body,
  );

  return (
    <>
      <aside className="hidden h-full w-[380px] shrink-0 flex-col border-l border-black/[0.06] bg-white md:flex">
        {body}
      </aside>
      {mobile}
    </>
  );
}

function ReportBody({
  report,
  exporting,
  exportError,
  selectedDefectIndex,
  onSelectDefect,
  onExportJson,
  onExportPdf,
  onClose,
}: {
  report: ReportViewModel;
  exporting: "json" | "pdf" | null;
  exportError: string | null;
  selectedDefectIndex?: number | null;
  onSelectDefect?: (index: number) => void;
  onExportJson: () => void;
  onExportPdf: () => void;
  onClose: () => void;
}) {
  const { result } = report;
  const title =
    report.road?.ref ?? report.road?.name ?? `PCI ${result.pciScore}`;

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#9ca3af] uppercase">
            Raport AI
            {report.provider ? ` · ${report.provider}` : ""}
          </p>
          <h2 className="mt-0.5 truncate text-[16px] font-semibold tracking-tight text-[#111827]">
            {title}
          </h2>
          <p className="truncate text-[12px] text-[#6b7280]">
            PCI {result.pciScore} — {PCI_LABELS[result.pciScore]}
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

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 text-[13px]">
        <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-[#fafafa] p-3">
          <div
            className="grid h-12 w-12 place-items-center rounded-xl text-lg font-bold text-white"
            style={{ backgroundColor: PCI_COLORS[result.pciScore] }}
          >
            {result.pciScore}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#111827]">
              Pewność {(result.confidenceScore * 100).toFixed(0)}%
            </p>
            <p className="text-[12px] leading-relaxed text-[#6b7280]">
              {result.conditionDescription}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={exporting !== null}
            onClick={onExportJson}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] bg-white text-[12px] font-semibold text-[#111827] transition hover:bg-[#f4f5f7] disabled:opacity-40"
          >
            {exporting === "json" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileJson className="h-3.5 w-3.5" />
            )}
            JSON
          </button>
          <button
            type="button"
            disabled={exporting !== null}
            onClick={onExportPdf}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#111827] text-[12px] font-semibold text-white transition hover:bg-black disabled:opacity-40"
          >
            {exporting === "pdf" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            PDF
          </button>
        </div>

        {exportError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
            {exportError}
          </p>
        ) : null}

        <p className="flex items-center gap-1.5 text-[11px] text-[#9ca3af]">
          <Download className="h-3 w-3" />
          Eksport lokalny — bez zewnętrznego storage
        </p>

        {report.evidenceImageUrl ? (
          <SatelliteEvidence
            imageUrl={report.evidenceImageUrl}
            defects={result.surfaceDefects}
            selectedIndex={selectedDefectIndex ?? null}
            onSelect={(index) => onSelectDefect?.(index)}
            conditionDescription={result.conditionDescription}
            evidenceBbox={report.evidenceBbox}
            roadGeometry={report.roadGeometry}
            sourceLabel={report.evidenceSourceLabel}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-[#d1d5db] px-3 py-2 text-[11px] text-[#9ca3af]">
            Brak klatki satelitarnej przy tym raporcie — uruchom nową analizę,
            aby zobaczyć oznaczenia na obrazie.
          </p>
        )}

        <Section title="Lista defektów (mapa)">
          {result.surfaceDefects.length === 0 ? (
            <p className="text-[#6b7280]">Brak wykrytych anomalii.</p>
          ) : (
            <>
              <p className="mb-2 text-[11px] leading-relaxed text-[#9ca3af]">
                Kliknij pozycję — mapa przybliży uszkodzone miejsce. Kolor =
                waga (czerwony = pilny remont).
              </p>
              <ul className="space-y-1.5">
                {result.surfaceDefects.map((d, index) => {
                  const active = selectedDefectIndex === index;
                  const hasPoint =
                    typeof d.lat === "number" && typeof d.lng === "number";
                  return (
                    <li key={`${d.type}-${d.locationHint}-${index}`}>
                      <button
                        type="button"
                        disabled={!hasPoint || !onSelectDefect}
                        onClick={() => onSelectDefect?.(index)}
                        className={`flex w-full items-start gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
                          active
                            ? "border-[#111827] bg-[#111827] text-white"
                            : "border-transparent bg-[#f4f5f7] text-[#111827] hover:border-black/10"
                        } disabled:cursor-default disabled:opacity-60`}
                      >
                        <span
                          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                          style={{
                            backgroundColor: colorForDefectSeverity(d.severity),
                            color: "#fff",
                          }}
                        >
                          <MapPin className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-semibold">
                            {DEFECT_LABELS_PL[d.type]} · sev {d.severity}
                          </span>
                          <span
                            className={`block text-[11px] ${active ? "text-white/75" : "text-[#6b7280]"}`}
                          >
                            {d.locationHint}
                          </span>
                          {d.evidenceNote ? (
                            <span
                              className={`mt-0.5 block text-[11px] leading-snug ${active ? "text-white/80" : "text-[#4b5563]"}`}
                            >
                              {d.evidenceNote}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Section>

        <Section title="Prawdopodobne przyczyny">
          <BulletList items={result.probableCauses} />
        </Section>
        <Section title="Rekomendacje">
          <BulletList items={result.recommendations} />
        </Section>
        <Section title="Zagrożenia">
          <BulletList items={result.potentialHazards} />
        </Section>

        <dl className="space-y-0 divide-y divide-black/[0.06] rounded-2xl border border-black/[0.06] text-[12px]">
          <MetaRow label="Model" value={report.modelId} />
          <MetaRow
            label="Data"
            value={new Date(report.createdAt).toLocaleString("pl-PL")}
          />
          <MetaRow label="Report ID" value={report.reportId} mono />
        </dl>
      </div>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-[#9ca3af] uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-4 text-[#374151]">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className="text-[#6b7280]">{label}</dt>
      <dd
        className={`truncate text-right font-medium text-[#111827] ${mono ? "font-mono text-[10px]" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
