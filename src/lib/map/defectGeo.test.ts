import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { geocodeDefects } from "@/lib/map/defectGeo";

describe("geocodeDefects", () => {
  it("maps relative coordinates into bbox", () => {
    const [defect] = geocodeDefects(
      [
        {
          type: "pothole",
          severity: 4,
          locationHint: "test",
          relativeX: 0.5,
          relativeY: 0.5,
        },
      ],
      [20, 50, 21, 51],
    );
    assert.equal(defect.lng, 20.5);
    assert.equal(defect.lat, 50.5);
  });

  it("keeps explicit lat/lng", () => {
    const [defect] = geocodeDefects(
      [
        {
          type: "erosion",
          severity: 2,
          locationHint: "fixed",
          lat: 52.1,
          lng: 21.0,
        },
      ],
      [20, 50, 21, 51],
    );
    assert.equal(defect.lat, 52.1);
    assert.equal(defect.lng, 21.0);
  });
});
