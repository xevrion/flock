// Returns everyone currently present in the room except the local user, and
// re-renders as people join and leave.

import { useContext, useEffect, useState } from "react";
import type { PresenceUser } from "@xevrion/flock-core";
import { FlockContext } from "../context.js";

export function usePresence(): PresenceUser[] {
  const ctx = useContext(FlockContext);
  if (!ctx) throw new Error("usePresence must be used inside a <FlockProvider>");
  const { room } = ctx;

  const [users, setUsers] = useState<PresenceUser[]>(() => [...room.getPresence().values()]);

  useEffect(() => {
    const offJoin = room.on("presence:join", (userId, user) => {
      setUsers((prev) => [...prev.filter((u) => u.userId !== userId), user]);
    });
    const offLeave = room.on("presence:leave", (userId) => {
      setUsers((prev) => prev.filter((u) => u.userId !== userId));
    });
    // A presence update changes only the fields in the patch. Merge it into the
    // existing metadata so untouched fields (name, color, etc.) are preserved.
    const offUpdate = room.on("presence:update", (userId, metadata) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.userId === userId
            ? { ...u, metadata: { ...u.metadata, ...metadata } }
            : u,
        ),
      );
    });
    return () => {
      offJoin();
      offLeave();
      offUpdate();
    };
  }, [room]);

  return users;
}
