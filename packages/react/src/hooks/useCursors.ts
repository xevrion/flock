// Returns the latest cursor for every other user in the room and re-renders as
// they move. Seeds from whatever the room already knows, then keeps in sync via
// the room's cursor events.
//
// When the provider has interpolation enabled (the default), positions are
// smoothed: each received position is fed into an interpolator and the values
// returned here are sampled once per animation frame, so cursors glide between
// the throttled updates instead of jumping. With interpolation off, the raw
// received positions are returned as-is.

import { useContext, useEffect, useRef, useState } from "react";
import { createInterpolator } from "@flock-sdk/core";
import type { UserId, UserCursor } from "@flock-sdk/core";
import { FlockContext } from "../context.js";

export function useCursors(): Record<UserId, UserCursor> {
  const ctx = useContext(FlockContext);
  if (!ctx) throw new Error("useCursors must be used inside a <FlockProvider>");
  const { room, interpolate, interpolationMs } = ctx;

  const [cursors, setCursors] = useState<Record<UserId, UserCursor>>(() =>
    Object.fromEntries(room.getCursors()),
  );

  // Raw subscription path, used when interpolation is disabled. Returns the
  // exact positions the server sent.
  useEffect(() => {
    if (interpolate) return;

    setCursors(Object.fromEntries(room.getCursors()));
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
  }, [room, interpolate]);

  // Interpolated path. The interpolator only tracks positions, so we keep the
  // rest of each cursor (id, metadata, timestamp) alongside it and recombine
  // with the sampled position on every frame.
  const latest = useRef<Map<UserId, UserCursor>>(new Map());

  useEffect(() => {
    if (!interpolate) return;

    const interp = createInterpolator(interpolationMs);
    latest.current = new Map(room.getCursors());
    for (const [userId, cursor] of latest.current) {
      interp.push(userId, cursor.position);
    }

    const offUpdate = room.on("cursor:update", (userId, cursor) => {
      latest.current.set(userId, cursor);
      interp.push(userId, cursor.position);
    });
    const offRemove = room.on("cursor:remove", (userId) => {
      latest.current.delete(userId);
      interp.remove(userId);
    });

    let frame = 0;
    const tick = (): void => {
      const now = Date.now();
      const next: Record<UserId, UserCursor> = {};
      for (const [userId, cursor] of latest.current) {
        const position = interp.sample(userId, now) ?? cursor.position;
        next[userId] = { ...cursor, position };
      }
      setCursors(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      offUpdate();
      offRemove();
    };
  }, [room, interpolate, interpolationMs]);

  return cursors;
}
