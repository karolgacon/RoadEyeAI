import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { geocodeDefects, pointAlongRoad } from "@/lib/map/defectGeo";

describe("geocodeDefects", () => {
  it("maps image coords into north-up bbox without road", () => {
    const [defect] = geocodeDefects(
      [
        {
          type: "pothole",
          severity: 4,
          locationHint: "test",
          relativeX: 0.5,
          relativeY: 0.25,
        },
      ],
      [20, 50, 21, 51],
    );
    assert.equal(defect.lng, 20.5);
    assert.equal(defect.lat, 50.75);
  });

  it("snaps to road geometry via alongRoad", () => {
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
          type: "erosion",
          severity: 2,
          locationHint: "on road",
          relativeX: 0.9,
          relativeY: 0.9,
          alongRoad: 0.25,
        },
      ],
      [20, 50, 21, 51],
      road,
    );
    assert.ok(Math.abs(defect.lng! - 20.25) < 1e-9);
    assert.ok(Math.abs(defect.lat! - 50.0) < 1e-9);
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
