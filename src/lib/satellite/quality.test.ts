import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PNG } from "pngjs";
import {
  assessLeoUsability,
  estimateQualityFromPng,
  isCloudScl,
} from "@/lib/satellite/quality";

describe("assessLeoUsability", () => {
  it("marks clear textured scenes as usable", () => {
    const q = assessLeoUsability(0.1, 0.05);
    assert.equal(q.usable, true);
    assert.equal(q.reason, "ok");
  });

  it("allows moderate cloud when texture is present", () => {
    const q = assessLeoUsability(0.45, 0.04);
    assert.equal(q.usable, true);
    assert.equal(q.reason, "ok");
  });

  it("rejects heavy cloud cover", () => {
    const q = assessLeoUsability(0.7, 0.08);
    assert.equal(q.usable, false);
    assert.equal(q.reason, "clouds");
  });

  it("rejects flat/blurry texture even with low cloud", () => {
    const q = assessLeoUsability(0.05, 0.002);
    assert.equal(q.usable, false);
    assert.equal(q.reason, "blur");
  });
});

describe("estimateQualityFromPng", () => {
  it("treats a varied non-white image as usable", () => {
    const png = new PNG({ width: 32, height: 32 });
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        const i = (y * 32 + x) << 2;
        const v = (x * 7 + y * 13) % 180;
        png.data[i] = v;
        png.data[i + 1] = (v + 40) % 200;
        png.data[i + 2] = (v + 80) % 200;
        png.data[i + 3] = 255;
      }
    }
    const q = estimateQualityFromPng(PNG.sync.write(png));
    assert.equal(q.usable, true);
    assert.equal(q.measuredBy, "png_heuristic");
    assert.ok(q.textureScore > 0.01);
  });

  it("rejects a near-white flat frame as cloudy/blurry", () => {
    const png = new PNG({ width: 16, height: 16 });
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = 245;
      png.data[i + 1] = 245;
      png.data[i + 2] = 248;
      png.data[i + 3] = 255;
    }
    const q = estimateQualityFromPng(PNG.sync.write(png));
    assert.equal(q.usable, false);
  });
});

describe("isCloudScl", () => {
  it("flags SCL cloud classes", () => {
    assert.equal(isCloudScl(8), true);
    assert.equal(isCloudScl(4), false);
  });
});
