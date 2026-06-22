// Returns the latest cursor for every other user in the room, re-rendering as
// positions update (at the throttle/interpolation rate, not on every mousemove).

import type { UserId, UserCursor } from "@flock-sdk/core";

export function useCursors(): Record<UserId, UserCursor> {
  return {};
}
