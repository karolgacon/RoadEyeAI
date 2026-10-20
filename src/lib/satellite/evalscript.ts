import type { EvalscriptId } from "@/types/satellite";

const TRUE_COLOR = `
//VERSION=3
function setup() {
  return {
    input: ["B04", "B03", "B02", "dataMask"],
    output: { bands: 4 }
  };
}
function evaluatePixel(sample) {
  // Mild gain for readability — does not invent spatial detail.
  const g = 2.5;
  return [
    Math.min(1, g * sample.B04),
    Math.min(1, g * sample.B03),
    Math.min(1, g * sample.B02),
    sample.dataMask
  ];
}
`.trim();

const NDVI = `
//VERSION=3
function setup() {
  return {
    input: ["B08", "B04", "dataMask"],
    output: { bands: 4 }
  };
}
function evaluatePixel(sample) {
  const ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04 + 1e-6);
  const v = Math.max(0, Math.min(1, (ndvi + 1) / 2));
  return [0.1, v, 0.2, sample.dataMask];
}
`.trim();

const NDMI = `
//VERSION=3
function setup() {
  return {
    input: ["B08", "B11", "dataMask"],
    output: { bands: 4 }
  };
}
function evaluatePixel(sample) {
  const ndmi = (sample.B08 - sample.B11) / (sample.B08 + sample.B11 + 1e-6);
  const v = Math.max(0, Math.min(1, (ndmi + 1) / 2));
  return [0.15, 0.35, v, sample.dataMask];
}
`.trim();

export function getEvalscript(id: EvalscriptId): string {
  switch (id) {
    case "true-color":
      return TRUE_COLOR;
    case "ndvi":
      return NDVI;
    case "ndmi":
      return NDMI;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
