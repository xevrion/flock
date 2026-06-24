// Holds the active client and room so the hooks can reach them without prop
// drilling. Null until a FlockProvider wraps the tree.

import { createContext } from "react";
import type { FlockClient, FlockRoom } from "@flock-sdk/core";

export interface FlockContextValue {
  client: FlockClient;
  room: FlockRoom;
  // Whether useCursors should smooth remote cursor motion between updates.
  interpolate: boolean;
  // How long, in milliseconds, each move is spread over when interpolating.
  interpolationMs: number;
}

export const FlockContext = createContext<FlockContextValue | null>(null);
