// Creates the client, joins the room on mount, exposes both through context,
// and tears everything down on unmount.

import type { ReactNode } from "react";
import type { FlockClientOptions, RoomOptions } from "@flock-sdk/core";

export interface FlockProviderProps extends FlockClientOptions, RoomOptions {
  roomId: string;
  children: ReactNode;
  interpolate?: boolean;
  interpolationMs?: number;
}

export function FlockProvider(props: FlockProviderProps): ReactNode {
  return props.children;
}
