import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assessLeoUsability, isCloudScl } from "@/lib/satellite/quality";

describe("assessLeoUsability", () => {
  it("marks clear textured scenes as usable", () => {
    const q = assessLeoUsability(0.1, 0.05);
    assert.equal(q.usable, true);
    assert.equal(q.reason, "ok");
  });

  it("rejects heavy cloud cover", () => {
    const q = assessLeoUsability(0.6, 0.08);
    assert.equal(q.usable, false);
    assert.equal(q.reason, "clouds");
  });

  it("rejects flat/blurry texture even with low cloud", () => {
    const q = assessLeoUsability(0.05, 0.005);
    assert.equal(q.usable, false);
    assert.equal(q.reason, "blur");
  });
});

describe("isCloudScl", () => {
  it("flags SCL cloud classes", () => {
    assert.equal(isCloudScl(8), true);
    assert.equal(isCloudScl(4), false);
  });
});
