import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createThrottle } from "../src/throttle.js";

describe("createThrottle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs the first call immediately", () => {
    const fn = vi.fn();
    const throttled = createThrottle(fn, 50);
    throttled(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(1);
  });

  it("collapses 100 rapid calls into at most 3 over 100ms at 50ms throttle", () => {
    const fn = vi.fn();
    const throttled = createThrottle(fn, 50);

    // Fire 100 calls spread across 100ms, one every millisecond.
    for (let i = 0; i < 100; i++) {
      throttled(i);
      vi.advanceTimersByTime(1);
    }
    // Let any trailing timer fire.
    vi.advanceTimersByTime(50);

    expect(fn.mock.calls.length).toBeLessThanOrEqual(3);
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("always sends the most recent value, never a stale one", () => {
    const fn = vi.fn();
    const throttled = createThrottle(fn, 50);

    throttled("a"); // runs now
    throttled("b");
    throttled("c"); // c is the latest pending value
    vi.advanceTimersByTime(50);

    expect(fn).toHaveBeenLastCalledWith("c");
  });

  it("cancel() drops a pending trailing call", () => {
    const fn = vi.fn();
    const throttled = createThrottle(fn, 50);

    throttled(1); // runs now
    throttled(2); // pending
    throttled.cancel();
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
