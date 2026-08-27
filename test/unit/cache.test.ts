/** The in-memory cache: what it keeps, what it drops, and when. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { TtlLruCache } from "../../src/imslp/cache.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("keeping a value", () => {
  it("hands back what was stored", () => {
    const cache = new TtlLruCache<string>(2, 1000);
    cache.set("a", "one");

    expect(cache.get("a")).toBe("one");
    expect(cache.size).toBe(1);
  });

  it("knows nothing of a key nobody stored", () => {
    expect(new TtlLruCache<string>(2, 1000).get("absent")).toBeUndefined();
  });
});

describe("what time does to an entry", () => {
  it("drops one that has expired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const cache = new TtlLruCache<string>(2, 1000);
    cache.set("a", "one");

    vi.setSystemTime(new Date("2026-01-01T00:00:02Z"));

    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});

describe("what room does to an entry", () => {
  it("drops the least recently used one", () => {
    const cache = new TtlLruCache<string>(2, 1000);
    cache.set("a", "one");
    cache.set("b", "two");
    cache.get("a");
    cache.set("c", "three");

    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("one");
  });

  it("keeps nothing when it was given no room, and none when it was given no time", () => {
    const noRoom = new TtlLruCache<string>(0, 1000);
    noRoom.set("a", "one");
    const noTime = new TtlLruCache<string>(2, 0);
    noTime.set("a", "one");

    expect(noRoom.size).toBe(0);
    expect(noTime.size).toBe(0);
  });

  it("empties on request", () => {
    const cache = new TtlLruCache<string>(2, 1000);
    cache.set("a", "one");
    cache.clear();

    expect(cache.size).toBe(0);
  });
});
