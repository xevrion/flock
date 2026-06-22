// Escape hatch that exposes the raw FlockRoom for advanced use cases the hooks
// don't cover.

import type { FlockRoom } from "@flock-sdk/core";

export function useRoom(): FlockRoom {
  throw new Error("useRoom is not implemented yet");
}
