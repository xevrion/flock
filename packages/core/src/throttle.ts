// Cursor helpers: rate-limit how often positions are sent, and convert raw
// pixel coordinates into 0 to 1 viewport-relative values so cursors line up
// across different screen sizes.

import type { CursorPosition } from "./types.js";

export function normalizeCursorPosition(
  rawX: number,
  rawY: number,
  viewportWidth: number,
  viewportHeight: number,
): CursorPosition {
  return {
    x: viewportWidth === 0 ? 0 : rawX / viewportWidth,
    y: viewportHeight === 0 ? 0 : rawY / viewportHeight,
  };
}

// Wraps a function so it runs at most once per `intervalMs`. The first call goes
// through immediately, and if more calls come in during the cooldown only the
// last one is kept and fired when the interval is up. This keeps cursor traffic
// to a steady rate (e.g. 20 messages/sec at 50ms) no matter how fast the mouse
// moves, while never dropping the most recent position.
export interface Throttled<Args extends unknown[]> {
  (...args: Args): void;
  cancel(): void;
}

export function createThrottle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  intervalMs: number,
): Throttled<Args> {
  let lastRun = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingArgs: Args | undefined;

  const throttled = (...args: Args): void => {
    const now = Date.now();
    const elapsed = now - lastRun;

    if (elapsed >= intervalMs) {
      // Enough time has passed, run right away.
      lastRun = now;
      fn(...args);
      return;
    }

    // Still cooling down. Remember the latest args and schedule a trailing run.
    pendingArgs = args;
    if (timer === undefined) {
      timer = setTimeout(() => {
        lastRun = Date.now();
        timer = undefined;
        if (pendingArgs) {
          const next = pendingArgs;
          pendingArgs = undefined;
          fn(...next);
        }
      }, intervalMs - elapsed);
    }
  };

  throttled.cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    pendingArgs = undefined;
  };

  return throttled;
}
