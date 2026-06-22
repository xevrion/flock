// Holds the active client and room so the hooks can reach them without prop
// drilling. Null until a FlockProvider wraps the tree.

import { createContext } from "react";
import type { FlockClient, FlockRoom } from "@flock-sdk/core";

export interface FlockContextValue {
  client: FlockClient;
  room: FlockRoom;
}

export const FlockContext = createContext<FlockContextValue | null>(null);
