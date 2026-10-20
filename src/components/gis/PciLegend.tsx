import { PCI_COLORS, PCI_LABELS, type PciScore } from "@/types/pci";

const SCORES: PciScore[] = [5, 4, 3, 2, 1];

export function PciLegend() {
  return (
    <div className="re-glass w-[168px] rounded-2xl px-3.5 py-3 text-[12px]">
      <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-[var(--re-muted)] uppercase">
        Skala PCI
      </p>
      <ul className="space-y-1.5">
        {SCORES.map((score) => (
          <li key={score} className="flex items-center gap-2.5 text-[var(--re-ink)]">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: PCI_COLORS[score] }}
            />
            <span className="tabular-nums">{score}</span>
            <span className="text-[var(--re-muted)]">{PCI_LABELS[score]}</span>
          </li>
        ))}
        <li className="flex items-center gap-2.5 border-t border-[var(--re-line)] pt-1.5 text-[var(--re-muted)]">
          <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
          <span>brak analizy</span>
        </li>
      </ul>
    </div>
  );
}
