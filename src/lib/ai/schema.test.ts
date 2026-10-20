import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { roadAnalysisResultSchema } from "@/lib/ai/schema";

describe("roadAnalysisResultSchema", () => {
  it("accepts a valid vision payload", () => {
    const parsed = roadAnalysisResultSchema.parse({
      pciScore: 3,
      surfaceDefects: [
        {
          type: "pothole",
          severity: 4,
          locationHint: "pas prawy",
        },
      ],
      conditionDescription: "Umiarkowane zużycie nawierzchni",
      probableCauses: ["intensywny ruch"],
      recommendations: ["lokalna naprawa"],
      potentialHazards: ["aquaplaning"],
      confidenceScore: 0.72,
    });
    assert.equal(parsed.pciScore, 3);
  });

  it("rejects out-of-range PCI", () => {
    assert.throws(() =>
      roadAnalysisResultSchema.parse({
        pciScore: 9,
        surfaceDefects: [],
        conditionDescription: "x",
        probableCauses: ["a"],
        recommendations: ["b"],
        potentialHazards: ["c"],
        confidenceScore: 0.5,
      }),
    );
  });
});
