import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { roadAnalysisWindow } from "@/lib/map/roadWindow";

describe("roadAnalysisWindow", () => {
  it("builds a tight square corridor around a short road", () => {
    const { bbox, lengthM } = roadAnalysisWindow(
      {
        type: "LineString",
        coordinates: [
          [21.0, 52.2],
          [21.004, 52.2],
        ],
      },
      { maxLengthM: 900, corridorHalfWidthM: 40 },
    );
    const [west, south, east, north] = bbox;
    assert.ok(east - west < 0.013);
    assert.ok(north - south < 0.013);
    assert.ok(Math.abs(east - west - (north - south)) < 1e-9);
    assert.ok(lengthM < 500);
  });
});
