// Smooths remote cursor motion by interpolating between the last known position
// and the newly received one, so cursors glide instead of teleporting between
// throttled updates.

import type { CursorPosition } from "./types.js";

export function interpolateCursor(
  from: CursorPosition,
  to: CursorPosition,
  t: number,
): CursorPosition {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}
