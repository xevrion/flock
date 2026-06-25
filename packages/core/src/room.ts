// Per-room state and events. Holds who's present and where their cursors are,
// sends the local user's actions to the server, and fires events as updates
// arrive so the app (or the React hooks) can react.

import type { Connection } from "./connection.js";
import { createThrottle, type Throttled } from "./throttle.js";
import type {
  CursorPosition,
  PresenceUser,
  RoomOptions,
  UserCursor,
  UserId,
  UserMetadata,
  FlockRoom as IFlockRoom,
} from "./types.js";
import type { ServerMessage } from "./messages.js";

type Handler = (...args: unknown[]) => void;

const DEFAULT_CURSOR_THROTTLE_MS = 50;

export class Room implements IFlockRoom {
  readonly roomId: string;

  private readonly userId: UserId;
  private myMetadata: UserMetadata;
  private cursors = new Map<UserId, UserCursor>();
  private presence = new Map<UserId, PresenceUser>();
  private listeners = new Map<string, Set<Handler>>();
  private readonly sendCursor: Throttled<[CursorPosition]>;
  // The server only accepts presence updates once it has processed our join. If
  // the app updates presence before join:ack lands, we hold the patch here and
  // send it the moment the ack arrives.
  private acked = false;
  private pendingPresence?: Partial<UserMetadata>;

  constructor(
    roomId: string,
    options: RoomOptions,
    private readonly connection: Connection,
  ) {
    this.roomId = roomId;
    this.userId = options.userId;
    this.myMetadata = options.metadata ?? {};

    const throttleMs = options.cursor?.throttleMs ?? DEFAULT_CURSOR_THROTTLE_MS;
    this.sendCursor = createThrottle((position: CursorPosition) => {
      this.connection.send({ type: "cursor:move", roomId: this.roomId, position });
    }, throttleMs);
  }

  // Called once the socket is open. Tells the server who we are. Any presence
  // updates made before the ack are held until it arrives.
  join(): void {
    this.acked = false;
    this.connection.send({
      type: "join",
      roomId: this.roomId,
      userId: this.userId,
      metadata: this.myMetadata,
    });
  }

  // Clears the remote view of the room (who's here, where their cursors are)
  // and fires leave events for everyone, so a reconnect starts from a clean
  // slate and the fresh join:ack snapshot rebuilds it. Our own metadata is kept
  // so the re-join restores it.
  resetRemoteState(): void {
    const userIds = [...this.presence.keys()];
    this.presence.clear();
    this.cursors.clear();
    for (const userId of userIds) {
      this.emit("presence:leave", userId);
      this.emit("cursor:remove", userId);
    }
  }

  getCursors(): Map<UserId, UserCursor> {
    return new Map(this.cursors);
  }

  getPresence(): Map<UserId, PresenceUser> {
    return new Map(this.presence);
  }

  getMyPresence(): UserMetadata {
    return { ...this.myMetadata };
  }

  updateCursor(position: CursorPosition): void {
    this.sendCursor(position);
  }

  updatePresence(metadata: Partial<UserMetadata>): void {
    this.myMetadata = { ...this.myMetadata, ...metadata };
    if (!this.acked) {
      // Not joined yet: accumulate the patch and flush it once the ack lands.
      this.pendingPresence = { ...this.pendingPresence, ...metadata };
      return;
    }
    this.connection.send({ type: "presence:update", roomId: this.roomId, metadata });
  }

  leave(): void {
    this.sendCursor.cancel();
    this.connection.send({ type: "leave", roomId: this.roomId });
  }

  on(event: "cursor:update", handler: (userId: UserId, cursor: UserCursor) => void): () => void;
  on(event: "cursor:remove", handler: (userId: UserId) => void): () => void;
  on(event: "presence:join", handler: (userId: UserId, user: PresenceUser) => void): () => void;
  on(event: "presence:leave", handler: (userId: UserId) => void): () => void;
  on(event: "presence:update", handler: (userId: UserId, metadata: UserMetadata) => void): () => void;
  on(event: string, handler: (...args: never[]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as Handler);
    return () => this.off(event, handler as Handler);
  }

  off(event: string, handler: Handler): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) handler(...args);
  }

  // Updates room state based on a message from the server and fires the matching
  // events. The client routes every message for this room here.
  handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "join:ack": {
        this.acked = true;
        // Flush any presence change the app made before we were acked.
        if (this.pendingPresence) {
          const patch = this.pendingPresence;
          this.pendingPresence = undefined;
          this.connection.send({
            type: "presence:update",
            roomId: this.roomId,
            metadata: patch,
          });
        }
        for (const user of msg.users) {
          this.presence.set(user.userId, {
            userId: user.userId,
            metadata: user.metadata,
            joinedAt: Date.now(),
          });
          if (user.cursor) {
            this.cursors.set(user.userId, {
              userId: user.userId,
              position: user.cursor,
              metadata: user.metadata,
              lastUpdatedAt: Date.now(),
            });
          }
        }
        break;
      }
      case "user:joined": {
        const user: PresenceUser = {
          userId: msg.userId,
          metadata: msg.metadata,
          joinedAt: Date.now(),
        };
        this.presence.set(msg.userId, user);
        this.emit("presence:join", msg.userId, user);
        break;
      }
      case "user:left": {
        this.presence.delete(msg.userId);
        this.cursors.delete(msg.userId);
        this.emit("presence:leave", msg.userId);
        this.emit("cursor:remove", msg.userId);
        break;
      }
      case "cursor:updated": {
        const metadata = this.presence.get(msg.userId)?.metadata ?? {};
        const cursor: UserCursor = {
          userId: msg.userId,
          position: msg.position,
          metadata,
          lastUpdatedAt: msg.timestamp,
        };
        this.cursors.set(msg.userId, cursor);
        this.emit("cursor:update", msg.userId, cursor);
        break;
      }
      case "cursor:removed": {
        this.cursors.delete(msg.userId);
        this.emit("cursor:remove", msg.userId);
        break;
      }
      case "presence:updated": {
        const existing = this.presence.get(msg.userId);
        if (existing) {
          existing.metadata = { ...existing.metadata, ...msg.metadata };
          this.emit("presence:update", msg.userId, existing.metadata);
        }
        break;
      }
    }
  }
}
