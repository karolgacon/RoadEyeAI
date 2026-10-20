import { PCI_COLORS, type PciScore } from "@/types/pci";

export function colorForPci(score: PciScore | null | undefined): string {
  if (score === null || score === undefined) {
    return "#64748B";
  }
  return PCI_COLORS[score];
}
