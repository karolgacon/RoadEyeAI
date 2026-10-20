import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PNG } from "pngjs";
import {
  assessVisionReadiness,
  isCloudScl,
} from "@/lib/satellite/quality";
import {
  decodeRaster,
  laplacianSharpness,
  upsampleFactor,
} from "@/lib/satellite/sharpness";

describe("assessVisionReadiness", () => {
  it("accepts clear sharp LEO close to HD", () => {
    const q = assessVisionReadiness({
      cloudCoverage: 0.05,
      textureScore: 0.05,
      sharpness: 0.05,
      sharpnessRatio: 0.4,
      upsample: 1.5,
    });
    assert.equal(q.usable, true);
    assert.equal(q.reason, "ok");
  });

  it("rejects cloudy LEO", () => {
    const q = assessVisionReadiness({
      cloudCoverage: 0.4,
      textureScore: 0.1,
      sharpness: 0.08,
      sharpnessRatio: 0.5,
      upsample: 1.2,
    });
    assert.equal(q.usable, false);
    assert.equal(q.reason, "clouds");
  });

  it("allows typical soft-but-clear S2 corridor (~3.8×, ~7% HD)", () => {
    const q = assessVisionReadiness({
      cloudCoverage: 0,
      textureScore: 0.065,
      sharpness: 0.003,
      sharpnessRatio: 0.07,
      upsample: 3.8,
    });
    assert.equal(q.usable, true);
    assert.equal(q.reason, "ok");
  });

  it("rejects mush with almost no edges vs HD", () => {
    const q = assessVisionReadiness({
      cloudCoverage: 0,
      textureScore: 0.02,
      sharpness: 0.0005,
      sharpnessRatio: 0.02,
      upsample: 2.0,
    });
    assert.equal(q.usable, false);
    assert.equal(q.reason, "soft");
  });

  it("rejects extreme upsample beyond corridor zoom", () => {
    const q = assessVisionReadiness({
      cloudCoverage: 0,
      textureScore: 0.1,
      sharpness: 0.05,
      sharpnessRatio: 0.5,
      upsample: 6.0,
    });
    assert.equal(q.usable, false);
    assert.equal(q.reason, "upsampled");
  });
});

describe("laplacianSharpness", () => {
  it("scores a hard-edged image higher than a flat one", () => {
    const sharp = new PNG({ width: 64, height: 64 });
    const soft = new PNG({ width: 64, height: 64 });
    for (let y = 0; y < 64; y += 1) {
      for (let x = 0; x < 64; x += 1) {
        const i = (y * 64 + x) << 2;
        const edge = x < 32 ? 20 : 220;
        sharp.data[i] = edge;
        sharp.data[i + 1] = edge;
        sharp.data[i + 2] = edge;
        sharp.data[i + 3] = 255;
        soft.data[i] = 120;
        soft.data[i + 1] = 120;
        soft.data[i + 2] = 120;
        soft.data[i + 3] = 255;
      }
    }
    const sSharp = laplacianSharpness(decodeRaster(PNG.sync.write(sharp)));
    const sSoft = laplacianSharpness(decodeRaster(PNG.sync.write(soft)));
    assert.ok(sSharp > sSoft * 5);
  });
});

describe("upsampleFactor", () => {
  it("computes upsample for ~2.5–3 km bbox at 1024px", () => {
    const f = upsampleFactor([21.0, 52.2, 21.03, 52.23], 1024);
    assert.ok(f > 2.5 && f < 5.5);
  });
});

describe("isCloudScl", () => {
  it("flags SCL cloud classes", () => {
    assert.equal(isCloudScl(9), true);
    assert.equal(isCloudScl(4), false);
  });
});
