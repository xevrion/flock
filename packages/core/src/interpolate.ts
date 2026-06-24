// Smooths remote cursor motion by interpolating between the last known position
// and the newly received one, so cursors glide instead of teleporting between
// throttled updates.

import type { CursorPosition, UserId } from "./types.js";

export function interpolateCursor(
  from: CursorPosition,
  to: CursorPosition,
  t: number,
): CursorPosition {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

// Per-user motion state. We remember where the cursor was when the latest target
// arrived (`from`), where it's heading (`target`), and when that target was set,
// so each render frame can work out how far along the glide we are.
interface UserMotion {
  from: CursorPosition;
  target: CursorPosition;
  startedAt: number;
}

export interface Interpolator {
  // Records a freshly received position for a user. Whatever the cursor was
  // showing at this moment becomes the new starting point, and it begins gliding
  // toward `position` over the configured window.
  push(userId: UserId, position: CursorPosition, now?: number): void;

  // Returns the position to draw for a user on the current frame. Call this every
  // animation frame. Returns undefined if the user has no recorded position yet.
  sample(userId: UserId, now?: number): CursorPosition | undefined;

  // Drops a user's motion state, e.g. when they leave the room.
  remove(userId: UserId): void;
}

// Builds an interpolator that spreads each received cursor move over `windowMs`
// milliseconds. Designed to be driven by requestAnimationFrame: push positions
// as they arrive off the wire, sample once per frame to get a smooth value.
export function createInterpolator(windowMs: number): Interpolator {
  const motions = new Map<UserId, UserMotion>();

  const progress = (m: UserMotion, now: number): number => {
    if (windowMs <= 0) return 1;
    const t = (now - m.startedAt) / windowMs;
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t;
  };

  return {
    push(userId, position, now = Date.now()): void {
      const existing = motions.get(userId);
      if (existing === undefined) {
        // First sighting of this user. Start them parked at the given position.
        motions.set(userId, { from: position, target: position, startedAt: now });
        return;
      }
      // Glide from wherever the cursor visually is right now toward the new spot.
      const current = interpolateCursor(
        existing.from,
        existing.target,
        progress(existing, now),
      );
      motions.set(userId, { from: current, target: position, startedAt: now });
    },

    sample(userId, now = Date.now()): CursorPosition | undefined {
      const m = motions.get(userId);
      if (m === undefined) return undefined;
      return interpolateCursor(m.from, m.target, progress(m, now));
    },

    remove(userId): void {
      motions.delete(userId);
    },
  };
}
