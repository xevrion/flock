// Returns the local user's own metadata plus a setter that publishes partial
// updates to the rest of the room.

import { useCallback, useContext, useState } from "react";
import type { UserMetadata } from "@flock-sdk/core";
import { FlockContext } from "../context.js";

export function useMyPresence(): [UserMetadata, (update: Partial<UserMetadata>) => void] {
  const ctx = useContext(FlockContext);
  if (!ctx) throw new Error("useMyPresence must be used inside a <FlockProvider>");
  const { room } = ctx;

  const [metadata, setMetadata] = useState<UserMetadata>(() => room.getMyPresence());

  const update = useCallback(
    (patch: Partial<UserMetadata>) => {
      room.updatePresence(patch);
      // Reflect the change locally right away so the caller sees it without
      // waiting for a server round trip.
      setMetadata((prev) => ({ ...prev, ...patch }));
    },
    [room],
  );

  return [metadata, update];
}
