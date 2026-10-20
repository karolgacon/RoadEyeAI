import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { roadAnalysisWindow } from "@/lib/map/roadWindow";

describe("roadAnalysisWindow", () => {
  it("builds a square corridor around a short road", () => {
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
    assert.ok(east - west < 0.031);
    assert.ok(north - south < 0.031);
    assert.ok(Math.abs(east - west - (north - south)) < 1e-9);
    assert.ok(lengthM < 500);
  });

  it("allows ~2.5 km LEO windows without clamping below maxSpan", () => {
    const { bbox } = roadAnalysisWindow(
      {
        type: "LineString",
        coordinates: [
          [21.0, 52.2],
          [21.025, 52.2],
        ],
      },
      { maxLengthM: 2500, corridorHalfWidthM: 120 },
    );
    const [west, , east] = bbox;
    assert.ok(east - west > 0.015);
    assert.ok(east - west <= 0.03 + 1e-9);
  });
});
