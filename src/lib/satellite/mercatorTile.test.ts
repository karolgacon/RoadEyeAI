import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { xyzToBbox } from "@/lib/satellite/mercatorTile";

describe("xyzToBbox", () => {
  it("covers the world at z=0", () => {
    const [west, south, east, north] = xyzToBbox(0, 0, 0);
    assert.equal(west, -180);
    assert.equal(east, 180);
    assert.ok(south < -85);
    assert.ok(north > 85);
  });

  it("splits west/east hemispheres at z=1", () => {
    const [west, , east] = xyzToBbox(1, 0, 0);
    assert.equal(west, -180);
    assert.equal(east, 0);
  });
});
