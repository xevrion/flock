// Creates the FlockClient, joins the room, and exposes both through context so
// the hooks can use them. Tears the connection down when it unmounts.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FlockClient } from "@flock-sdk/core";
import type { FlockClientOptions, RoomOptions } from "@flock-sdk/core";
import { FlockContext, type FlockContextValue } from "./context.js";

export interface FlockProviderProps extends FlockClientOptions, RoomOptions {
  roomId: string;
  children: ReactNode;
  interpolate?: boolean;
  interpolationMs?: number;
}

export function FlockProvider(props: FlockProviderProps): ReactNode {
  const { roomId, userId, metadata, cursor, children } = props;

  // Build the client and join the room exactly once for the life of the
  // provider. A ref keeps them stable across re-renders; state makes the first
  // render wait until they exist.
  const ref = useRef<FlockContextValue | null>(null);
  const [value, setValue] = useState<FlockContextValue | null>(null);

  useEffect(() => {
    const client = new FlockClient({
      serverUrl: props.serverUrl,
      apiKey: props.apiKey,
      reconnect: props.reconnect,
    });
    const room = client.joinRoom(roomId, { userId, metadata, cursor });
    const next = { client, room };
    ref.current = next;
    setValue(next);

    return () => {
      client.destroy();
      ref.current = null;
      setValue(null);
    };
    // The connection identity is fixed for a given server/room/user. Changing
    // those should remount the provider, so they are intentionally the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.serverUrl, roomId, userId]);

  if (!value) return null;

  return <FlockContext.Provider value={value}>{children}</FlockContext.Provider>;
}
