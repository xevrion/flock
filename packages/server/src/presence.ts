// Stores presence in Redis with a TTL that heartbeats keep alive. When the TTL
// lapses (an ungraceful disconnect), expiry notifications drive user eviction.
// Falls back to no Redis at all, in which case the server runs single-instance
// and relies on the in-memory room manager for presence.

import { Redis } from "ioredis";
import type { UserMetadata } from "./messages.js";

function presenceKey(roomId: string, userId: string): string {
  return `flock:presence:${roomId}:${userId}`;
}

function membersKey(roomId: string): string {
  return `flock:room:${roomId}:members`;
}

function cursorKey(roomId: string, userId: string): string {
  return `flock:cursor:${roomId}:${userId}`;
}

// Pulls a roomId and userId back out of an expired presence key so the eviction
// handler knows who to remove. Returns undefined for any key we don't recognize.
export function parsePresenceKey(
  key: string,
): { roomId: string; userId: string } | undefined {
  const prefix = "flock:presence:";
  if (!key.startsWith(prefix)) return undefined;
  const rest = key.slice(prefix.length);
  const sep = rest.indexOf(":");
  if (sep === -1) return undefined;
  return { roomId: rest.slice(0, sep), userId: rest.slice(sep + 1) };
}

export interface RedisPresenceUser {
  userId: string;
  metadata: UserMetadata;
  cursor?: { x: number; y: number };
}

export class PresenceStore {
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: Redis,
    ttlSeconds: number,
  ) {
    this.ttlSeconds = ttlSeconds;
  }

  // Records a user in a room: the presence hash (with TTL), and an entry in the
  // room's member set. The member set has no TTL of its own, expiry of the
  // presence key is what triggers its removal.
  async setPresence(
    roomId: string,
    userId: string,
    metadata: UserMetadata,
  ): Promise<void> {
    const key = presenceKey(roomId, userId);
    await this.redis
      .multi()
      .hset(key, {
        metadata: JSON.stringify(metadata),
        joinedAt: String(Date.now()),
      })
      .expire(key, this.ttlSeconds)
      .sadd(membersKey(roomId), userId)
      .exec();
  }

  // Pushes the TTL on a user's presence (and cursor, if present) back out to the
  // full window. Called on every heartbeat.
  async refreshPresence(roomId: string, userId: string): Promise<void> {
    const pkey = presenceKey(roomId, userId);
    const ckey = cursorKey(roomId, userId);
    await this.redis
      .multi()
      .expire(pkey, this.ttlSeconds)
      .expire(ckey, this.ttlSeconds)
      .sadd(membersKey(roomId), userId)
      .exec();
  }

  // Cleans up a user on a graceful leave: drops the presence and cursor keys and
  // removes them from the member set.
  async removePresence(roomId: string, userId: string): Promise<void> {
    await this.redis
      .multi()
      .del(presenceKey(roomId, userId))
      .del(cursorKey(roomId, userId))
      .srem(membersKey(roomId), userId)
      .exec();
  }

  // Saves the last known cursor position for a user, expiring with the same TTL
  // as their presence so it never outlives them.
  async setCursor(
    roomId: string,
    userId: string,
    position: { x: number; y: number },
  ): Promise<void> {
    const key = cursorKey(roomId, userId);
    await this.redis
      .multi()
      .hset(key, { x: String(position.x), y: String(position.y), timestamp: String(Date.now()) })
      .expire(key, this.ttlSeconds)
      .exec();
  }

  async clearCursor(roomId: string, userId: string): Promise<void> {
    await this.redis.del(cursorKey(roomId, userId));
  }

  // Builds the snapshot a new joiner needs: everyone currently in the room, their
  // metadata, and their last cursor position when one is known. Member entries
  // whose presence key has already expired are skipped (and tidied out of the
  // set) so a stale member never appears in the snapshot.
  async getRoomPresence(roomId: string): Promise<RedisPresenceUser[]> {
    const userIds = await this.redis.smembers(membersKey(roomId));
    const users: RedisPresenceUser[] = [];

    for (const userId of userIds) {
      const data = await this.redis.hgetall(presenceKey(roomId, userId));
      if (!data || Object.keys(data).length === 0) {
        await this.redis.srem(membersKey(roomId), userId);
        continue;
      }

      let metadata: UserMetadata = {};
      if (data.metadata) {
        try {
          metadata = JSON.parse(data.metadata) as UserMetadata;
        } catch {
          metadata = {};
        }
      }

      const user: RedisPresenceUser = { userId, metadata };

      const cursor = await this.redis.hgetall(cursorKey(roomId, userId));
      if (cursor && cursor.x !== undefined && cursor.y !== undefined) {
        user.cursor = { x: Number(cursor.x), y: Number(cursor.y) };
      }

      users.push(user);
    }

    return users;
  }

  // Updates a stored presence hash with a partial metadata patch, merging rather
  // than replacing so fields the patch omits are kept.
  async updateMetadata(
    roomId: string,
    userId: string,
    patch: Partial<UserMetadata>,
  ): Promise<void> {
    const key = presenceKey(roomId, userId);
    const existing = await this.redis.hget(key, "metadata");
    let metadata: UserMetadata = {};
    if (existing) {
      try {
        metadata = JSON.parse(existing) as UserMetadata;
      } catch {
        metadata = {};
      }
    }
    const merged = { ...metadata, ...patch };
    await this.redis.hset(key, "metadata", JSON.stringify(merged));
  }
}
