import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { geocodeDefects, pointAlongRoad } from "@/lib/map/defectGeo";

describe("geocodeDefects", () => {
  it("snaps image coords onto the road when geometry is provided", () => {
    const road: GeoJSON.LineString = {
      type: "LineString",
      coordinates: [
        [20.0, 50.0],
        [21.0, 50.0],
      ],
    };
    const [defect] = geocodeDefects(
      [
        {
          type: "pothole",
          severity: 4,
          locationHint: "test",
          // Deliberately off-road image coords — must be overwritten.
          relativeX: 0.1,
          relativeY: 0.1,
          alongRoad: 0.5,
        },
      ],
      [20, 49.9, 21, 50.1],
      road,
    );
    assert.ok(Math.abs(defect.lng! - 20.5) < 1e-6);
    assert.ok(Math.abs(defect.lat! - 50.0) < 1e-6);
    // Projected onto horizontal road in this bbox → y near middle.
    assert.ok(defect.relativeY! > 0.4 && defect.relativeY! < 0.6);
  });
});

describe("pointAlongRoad", () => {
  it("returns midpoint at t=0.5", () => {
    const p = pointAlongRoad(
      {
        type: "LineString",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      },
      0.5,
    );
    assert.ok(p);
    assert.equal(p.lng, 5);
    assert.equal(p.lat, 0);
  });
});
