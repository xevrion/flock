import { describe, expect, it } from "vitest";
import { createInterpolator, interpolateCursor } from "../src/interpolate.js";

describe("interpolateCursor", () => {
  it("returns the start position at t=0", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 1, y: 1 };
    expect(interpolateCursor(from, to, 0)).toEqual({ x: 0, y: 0 });
  });

  it("returns the end position at t=1", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 1, y: 1 };
    expect(interpolateCursor(from, to, 1)).toEqual({ x: 1, y: 1 });
  });

  it("returns the midpoint at t=0.5", () => {
    const from = { x: 0.2, y: 0.4 };
    const to = { x: 0.8, y: 0.6 };
    expect(interpolateCursor(from, to, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("createInterpolator", () => {
  it("returns undefined for a user it has never seen", () => {
    const interp = createInterpolator(80);
    expect(interp.sample("nobody", 0)).toBeUndefined();
  });

  it("parks a user at their first position", () => {
    const interp = createInterpolator(80);
    interp.push("a", { x: 0.5, y: 0.5 }, 0);
    expect(interp.sample("a", 0)).toEqual({ x: 0.5, y: 0.5 });
    // No new target, so it stays put even after the window elapses.
    expect(interp.sample("a", 200)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("glides from the old position to the new one over the window", () => {
    const interp = createInterpolator(80);
    interp.push("a", { x: 0, y: 0 }, 0);
    interp.push("a", { x: 1, y: 1 }, 0);

    expect(interp.sample("a", 0)).toEqual({ x: 0, y: 0 });
    expect(interp.sample("a", 40)).toEqual({ x: 0.5, y: 0.5 });
    expect(interp.sample("a", 80)).toEqual({ x: 1, y: 1 });
  });

  it("clamps past the end of the window", () => {
    const interp = createInterpolator(80);
    interp.push("a", { x: 0, y: 0 }, 0);
    interp.push("a", { x: 1, y: 1 }, 0);
    expect(interp.sample("a", 1000)).toEqual({ x: 1, y: 1 });
  });

  it("starts a new glide from wherever the cursor currently is", () => {
    const interp = createInterpolator(80);
    interp.push("a", { x: 0, y: 0 }, 0);
    interp.push("a", { x: 1, y: 0 }, 0);

    // Halfway through the first glide, a new target arrives.
    const mid = interp.sample("a", 40);
    expect(mid).toEqual({ x: 0.5, y: 0 });
    interp.push("a", { x: 0.5, y: 1 }, 40);

    // The second glide should start from the midpoint, not snap back to 0.
    expect(interp.sample("a", 40)).toEqual({ x: 0.5, y: 0 });
    expect(interp.sample("a", 80)).toEqual({ x: 0.5, y: 0.5 });
    expect(interp.sample("a", 120)).toEqual({ x: 0.5, y: 1 });
  });

  it("tracks multiple users independently", () => {
    const interp = createInterpolator(80);
    interp.push("a", { x: 0, y: 0 }, 0);
    interp.push("a", { x: 1, y: 1 }, 0);
    interp.push("b", { x: 0.2, y: 0.2 }, 0);

    expect(interp.sample("a", 40)).toEqual({ x: 0.5, y: 0.5 });
    expect(interp.sample("b", 40)).toEqual({ x: 0.2, y: 0.2 });
  });

  it("forgets a user after remove()", () => {
    const interp = createInterpolator(80);
    interp.push("a", { x: 0.5, y: 0.5 }, 0);
    interp.remove("a");
    expect(interp.sample("a", 0)).toBeUndefined();
  });

  it("snaps immediately when the window is zero", () => {
    const interp = createInterpolator(0);
    interp.push("a", { x: 0, y: 0 }, 0);
    interp.push("a", { x: 1, y: 1 }, 0);
    expect(interp.sample("a", 0)).toEqual({ x: 1, y: 1 });
  });
});
