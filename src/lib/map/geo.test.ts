import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bboxFromGeoJson,
  parseBboxParam,
} from "@/lib/map/geo";

describe("parseBboxParam", () => {
  it("parses valid west,south,east,north", () => {
    assert.deepEqual(parseBboxParam("14,49,24,54"), [14, 49, 24, 54]);
  });

  it("rejects inverted or incomplete bbox", () => {
    assert.equal(parseBboxParam("24,49,14,54"), null);
    assert.equal(parseBboxParam("1,2,3"), null);
    assert.equal(parseBboxParam(null), null);
  });
});

describe("bboxFromGeoJson", () => {
  it("pads a linestring bbox", () => {
    const bbox = bboxFromGeoJson(
      {
        type: "LineString",
        coordinates: [
          [19.0, 52.0],
          [19.1, 52.05],
        ],
      },
      0.01,
    );
    assert.ok(bbox[0] < 19.0);
    assert.ok(bbox[1] < 52.0);
    assert.ok(bbox[2] > 19.1);
    assert.ok(bbox[3] > 52.05);
  });

  it("expands near-point geometry to min span", () => {
    const bbox = bboxFromGeoJson(
      {
        type: "LineString",
        coordinates: [
          [21.0, 52.2],
          [21.0001, 52.2001],
        ],
      },
      0,
    );
    assert.ok(bbox[2] - bbox[0] >= 0.0099);
    assert.ok(bbox[3] - bbox[1] >= 0.0099);
  });
});
