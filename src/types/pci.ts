export type PciScore = 1 | 2 | 3 | 4 | 5;

export const PCI_LABELS: Record<PciScore, string> = {
  1: "Krytyczny",
  2: "Zły",
  3: "Umiarkowany",
  4: "Dobry",
  5: "Idealny",
};

export const PCI_COLORS: Record<PciScore, string> = {
  1: "#DC2626",
  2: "#F97316",
  3: "#EAB308",
  4: "#84CC16",
  5: "#16A34A",
};

export function isPciScore(value: number): value is PciScore {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}
