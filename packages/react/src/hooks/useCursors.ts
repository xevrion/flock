// Returns the latest cursor for every other user in the room and re-renders as
// they move. Seeds from whatever the room already knows, then keeps in sync via
// the room's cursor events.

import { useContext, useEffect, useState } from "react";
import type { UserId, UserCursor } from "@flock-sdk/core";
import { FlockContext } from "../context.js";

export function useCursors(): Record<UserId, UserCursor> {
  const ctx = useContext(FlockContext);
  if (!ctx) throw new Error("useCursors must be used inside a <FlockProvider>");
  const { room } = ctx;

  const [cursors, setCursors] = useState<Record<UserId, UserCursor>>(() =>
    Object.fromEntries(room.getCursors()),
  );

  useEffect(() => {
    const offUpdate = room.on("cursor:update", (userId, cursor) => {
      setCursors((prev) => ({ ...prev, [userId]: cursor }));
    });
    const offRemove = room.on("cursor:remove", (userId) => {
      setCursors((prev) => {
        if (!(userId in prev)) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });
    return () => {
      offUpdate();
      offRemove();
    };
  }, [room]);

  return cursors;
}
