import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { upsampleFactor } from "@/lib/satellite/sharpness";

describe("upsampleFactor", () => {
  it("is ~1 when canvas matches native 10 m sampling", () => {
    // 1 km span ≈ 100 native pixels
    const mid = 52.2;
    const dLat = 1000 / 111_320;
    const dLng = 1000 / (111_320 * Math.cos((mid * Math.PI) / 180));
    const f = upsampleFactor([21, mid, 21 + dLng, mid + dLat], 100);
    assert.ok(f > 0.7 && f < 1.4);
  });
});
