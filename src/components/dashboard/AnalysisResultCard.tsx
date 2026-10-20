"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { PCI_COLORS, PCI_LABELS } from "@/types/pci";
import type { RoadAnalysisResult } from "@/types/analysis";

interface AnalysisResultCardProps {
  result: RoadAnalysisResult;
  provider: string;
  modelId: string;
  onClose: () => void;
}

export function AnalysisResultCard({
  result,
  provider,
  modelId,
  onClose,
}: AnalysisResultCardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10030] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Zamknij"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[#9ca3af] uppercase">
              Raport AI · {provider}
            </p>
            <h2 className="text-[16px] font-semibold text-[#111827]">
              PCI {result.pciScore} — {PCI_LABELS[result.pciScore]}
            </h2>
            <p className="text-[11px] text-[#9ca3af]">{modelId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-black/[0.08]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-[13px]">
          <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-[#fafafa] p-3">
            <div
              className="grid h-12 w-12 place-items-center rounded-xl text-lg font-bold text-white"
              style={{ backgroundColor: PCI_COLORS[result.pciScore] }}
            >
              {result.pciScore}
            </div>
            <div>
              <p className="font-semibold text-[#111827]">
                Pewność {(result.confidenceScore * 100).toFixed(0)}%
              </p>
              <p className="text-[12px] text-[#6b7280]">
                {result.conditionDescription}
              </p>
            </div>
          </div>

          <Section title="Defekty">
            {result.surfaceDefects.length === 0 ? (
              <p className="text-[#6b7280]">Brak wykrytych anomalii.</p>
            ) : (
              <ul className="space-y-1.5">
                {result.surfaceDefects.map((d) => (
                  <li
                    key={`${d.type}-${d.locationHint}`}
                    className="rounded-lg bg-[#f4f5f7] px-2.5 py-2"
                  >
                    <span className="font-medium">{d.type}</span> · sev{" "}
                    {d.severity}
                    <span className="block text-[12px] text-[#6b7280]">
                      {d.locationHint}
                    </span>
                  </li>
                ))}
              </ul>
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
        </div>
      </div>
    </div>,
    document.body,
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
