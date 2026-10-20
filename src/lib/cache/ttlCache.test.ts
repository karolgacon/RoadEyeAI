import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TtlCache } from "@/lib/cache/ttlCache";

describe("TtlCache", () => {
  it("stores and returns values within TTL", () => {
    const cache = new TtlCache<string>(60_000);
    cache.set("a", "one");
    assert.equal(cache.get("a"), "one");
  });

  it("evicts expired entries", async () => {
    const cache = new TtlCache<string>(20);
    cache.set("a", "one");
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(cache.get("a"), undefined);
  });
});
