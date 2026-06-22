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
