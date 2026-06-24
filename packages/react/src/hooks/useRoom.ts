// Escape hatch that returns the raw FlockRoom for advanced use the other hooks
// don't cover (custom event handling, imperative calls).

import { useContext } from "react";
import type { FlockRoom } from "@flock-sdk/core";
import { FlockContext } from "../context.js";

export function useRoom(): FlockRoom {
  const ctx = useContext(FlockContext);
  if (!ctx) throw new Error("useRoom must be used inside a <FlockProvider>");
  return ctx.room;
}
