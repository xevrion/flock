// Creates the FlockClient, joins the room, and exposes both through context so
// the hooks can use them. Tears the connection down when it unmounts.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FlockClient } from "@xevrion/flock-core";
import type { FlockClientOptions, FlockRoom, RoomOptions } from "@xevrion/flock-core";
import { FlockContext, type FlockContextValue } from "./context.js";

export interface FlockProviderProps extends FlockClientOptions, RoomOptions {
  roomId: string;
  children: ReactNode;
  interpolate?: boolean;
  interpolationMs?: number;
}

export function FlockProvider(props: FlockProviderProps): ReactNode {
  const { roomId, userId, metadata, cursor, children } = props;
  const interpolate = props.interpolate ?? true;
  const interpolationMs = props.interpolationMs ?? 80;

  // Build the client and join the room exactly once for the life of the
  // provider. A ref keeps them stable across re-renders; state makes the first
  // render wait until they exist.
  const ref = useRef<{ client: FlockClient; room: FlockRoom } | null>(null);
  const [conn, setConn] = useState<{ client: FlockClient; room: FlockRoom } | null>(
    null,
  );

  useEffect(() => {
    const client = new FlockClient({
      serverUrl: props.serverUrl,
      apiKey: props.apiKey,
      reconnect: props.reconnect,
    });
    const room = client.joinRoom(roomId, { userId, metadata, cursor });
    const next = { client, room };
    ref.current = next;
    setConn(next);

    return () => {
      client.destroy();
      ref.current = null;
      setConn(null);
    };
    // The connection identity is fixed for a given server/room/user. Changing
    // those should remount the provider, so they are intentionally the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.serverUrl, roomId, userId]);

  // The interpolation settings are render-time presentation options, not part of
  // the connection identity, so toggling them must not tear down the socket.
  const value = useMemo<FlockContextValue | null>(
    () => (conn ? { ...conn, interpolate, interpolationMs } : null),
    [conn, interpolate, interpolationMs],
  );

  if (!value) return null;

  return <FlockContext.Provider value={value}>{children}</FlockContext.Provider>;
}
