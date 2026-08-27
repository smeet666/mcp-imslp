/**
 * The queue that owes IMSLP a gap between requests.
 *
 * Time is driven by hand here: a test that measured a real clock would pass on
 * a fast machine and fail on a loaded one, and prove nothing either way.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { RateLimiter, sleep } from "../../src/imslp/rateLimiter.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("the order of the queue", () => {
  it("runs tasks one at a time, in the order they were asked for", async () => {
    const limiter = new RateLimiter({ minIntervalMs: 0 });
    const order: number[] = [];

    await Promise.all([
      limiter.schedule(async () => {
        order.push(1);
      }),
      limiter.schedule(async () => {
        order.push(2);
      }),
    ]);

    expect(order).toEqual([1, 2]);
  });

  it("keeps draining after a task fails", async () => {
    const limiter = new RateLimiter({ minIntervalMs: 0 });
    const failed = limiter.schedule(async () => {
      throw new Error("no");
    });

    await expect(failed).rejects.toThrow("no");
    await expect(limiter.schedule(async () => "after")).resolves.toBe("after");
  });
});

describe("the gap between requests", () => {
  it("waits out the interval before claiming the next slot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const limiter = new RateLimiter({ minIntervalMs: 2000 });

    await limiter.beforeRequest();
    let claimed = false;
    const second = limiter.beforeRequest().then(() => {
      claimed = true;
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(claimed).toBe(false);

    await vi.advanceTimersByTimeAsync(1500);
    await second;
    expect(claimed).toBe(true);
  });

  it("claims at once when no request has gone out", async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter({ minIntervalMs: 2000 });

    await limiter.beforeRequest();

    expect(limiter.currentIntervalMs).toBe(2000);
  });

  it("waits no longer than the interval when the clock steps backwards", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:10Z"));
    const limiter = new RateLimiter({ minIntervalMs: 2000 });
    await limiter.beforeRequest();

    // A machine resumed from suspend, or an NTP correction: without a clamp the
    // serial queue would wait for the size of the step.
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const second = limiter.beforeRequest();
    await vi.advanceTimersByTimeAsync(2000);

    await expect(second).resolves.toBeUndefined();
  });
});

describe("what pushback does to the interval", () => {
  it("doubles it, and decays it back as requests succeed", () => {
    const limiter = new RateLimiter({ minIntervalMs: 2000 });

    limiter.penalize();
    expect(limiter.currentIntervalMs).toBe(4000);

    limiter.relax();
    expect(limiter.currentIntervalMs).toBe(3000);

    limiter.relax();
    limiter.relax();
    expect(limiter.currentIntervalMs).toBe(2000);
  });

  it("never grows past the ceiling", () => {
    const limiter = new RateLimiter({ minIntervalMs: 2000, maxIntervalMs: 5000 });

    limiter.penalize();
    limiter.penalize();

    expect(limiter.currentIntervalMs).toBe(5000);
  });

  it("starts pacing a limiter that was pacing at nothing", () => {
    const limiter = new RateLimiter({ minIntervalMs: 0 });

    limiter.penalize();

    expect(limiter.currentIntervalMs).toBe(250);
  });
});

describe("sleep", () => {
  it("resolves once the time has passed", async () => {
    vi.useFakeTimers();
    const waited = sleep(50);

    await vi.advanceTimersByTimeAsync(50);

    await expect(waited).resolves.toBeUndefined();
  });
});
