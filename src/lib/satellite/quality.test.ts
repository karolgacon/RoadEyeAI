import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PNG } from "pngjs";
import {
  assessLeoUsability,
  isCloudScl,
  textureFromLeoPng,
} from "@/lib/satellite/quality";

describe("assessLeoUsability", () => {
  it("marks clear textured scenes as usable", () => {
    const q = assessLeoUsability(0.08, 0.04);
    assert.equal(q.usable, true);
    assert.equal(q.reason, "ok");
  });

  it("rejects cloud above 25%", () => {
    const q = assessLeoUsability(0.35, 0.08);
    assert.equal(q.usable, false);
    assert.equal(q.reason, "clouds");
  });

  it("rejects low ground texture", () => {
    const q = assessLeoUsability(0.05, 0.005);
    assert.equal(q.usable, false);
    assert.equal(q.reason, "blur");
  });
});

describe("textureFromLeoPng", () => {
  it("returns higher texture for varied clear pixels", () => {
    const leo = new PNG({ width: 32, height: 32 });
    const mask = new PNG({ width: 32, height: 32 });
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        const i = (y * 32 + x) << 2;
        const v = (x * 9 + y * 5) % 160;
        leo.data[i] = v;
        leo.data[i + 1] = (v + 30) % 180;
        leo.data[i + 2] = (v + 60) % 180;
        leo.data[i + 3] = 255;
        // Clear (R=0)
        mask.data[i] = 0;
        mask.data[i + 1] = 0;
        mask.data[i + 2] = 0;
        mask.data[i + 3] = 255;
      }
    }
    const score = textureFromLeoPng(PNG.sync.write(leo), PNG.sync.write(mask));
    assert.ok(score > 0.03);
  });

  it("ignores cloudy mask pixels", () => {
    const leo = new PNG({ width: 16, height: 16 });
    const mask = new PNG({ width: 16, height: 16 });
    for (let i = 0; i < leo.data.length; i += 4) {
      leo.data[i] = 40;
      leo.data[i + 1] = 80;
      leo.data[i + 2] = 40;
      leo.data[i + 3] = 255;
      mask.data[i] = 255; // all cloud
      mask.data[i + 1] = 255;
      mask.data[i + 2] = 255;
      mask.data[i + 3] = 255;
    }
    const score = textureFromLeoPng(PNG.sync.write(leo), PNG.sync.write(mask));
    assert.equal(score, 0);
  });
});

describe("isCloudScl", () => {
  it("flags SCL cloud classes", () => {
    assert.equal(isCloudScl(9), true);
    assert.equal(isCloudScl(4), false);
  });
});
