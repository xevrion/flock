// The presence server. Accepts WebSocket connections, routes incoming wire
// messages, and broadcasts updates to the other people in a room.

import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import { Redis } from "ioredis";
import { createHealthServer } from "./health.js";
import { createLogger, type Logger } from "./logger.js";
import { RoomManager } from "./room-manager.js";
import { PresenceStore, parsePresenceKey } from "./presence.js";
import { PubSub } from "./pubsub.js";
import { Broadcaster } from "./broadcast.js";
import { validateApiKey } from "./api-key.js";
import type { ClientMessage, ServerMessage } from "./messages.js";

const DEFAULT_TTL_SECONDS = 30;
const DEFAULT_MAX_MESSAGES_PER_SECOND = 100;

// Sliding-window rate limiter. Tracks incoming-message timestamps for a socket
// and returns true when the limit is exceeded.
class RateLimiter {
  private readonly limit: number;
  private readonly timestamps: number[] = [];

  constructor(limit: number) {
    this.limit = limit;
  }

  // Returns true if this message would exceed the per-second limit.
  check(now = Date.now()): boolean {
    const windowStart = now - 1000;
    // Drop timestamps older than the 1-second window.
    while (this.timestamps.length > 0 && this.timestamps[0]! <= windowStart) {
      this.timestamps.shift();
    }
    this.timestamps.push(now);
    return this.timestamps.length > this.limit;
  }
}

export interface FlockServerOptions {
  port?: number;
  redisUrl?: string;
  apiKeys?: string[];
  maxMessagesPerSecond?: number;
  presence?: {
    ttlSeconds?: number;
    heartbeatIntervalMs?: number;
  };
  logger?: boolean;
}

// Reads FLOCK_PORT from the environment, returning undefined if it's missing or
// not a valid number so the default can take over.
function envPort(): number | undefined {
  const raw = process.env.FLOCK_PORT;
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

// Reads the presence TTL from the environment, falling back to the default if
// it's missing or not a positive number.
function envTtlSeconds(): number | undefined {
  const raw = process.env.FLOCK_PRESENCE_TTL_SECONDS;
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// We hang a little bit of state off each socket so we know, on disconnect,
// which user in which room just went away.
interface SocketState {
  roomId?: string;
  userId?: string;
}

// How many cursor moves we'll hold for a socket that hasn't sent its join yet,
// and how long we'll keep them before giving up on the join arriving.
const MAX_BUFFERED_CURSOR_MOVES = 3;
const CURSOR_BUFFER_TTL_MS = 500;

// A cursor move that arrived before the join did, plus the timer that drops it
// if the join never shows up.
interface BufferedCursor {
  positions: Array<{ x: number; y: number }>;
  timer: ReturnType<typeof setTimeout>;
}

export class FlockServer {
  private readonly port: number;
  private readonly log: Logger;
  private readonly rooms = new RoomManager();
  private readonly redisUrl?: string;
  private readonly ttlSeconds: number;
  private readonly apiKeys?: string[];
  private readonly maxMessagesPerSecond: number;
  private http?: Server;
  private wss?: WebSocketServer;
  private readonly instanceId = randomUUID();
  private sockets = new Map<WebSocket, SocketState>();
  // Cursor moves that landed before a socket's join, held until the join
  // arrives (then replayed) or until they age out.
  private pendingCursors = new Map<WebSocket, BufferedCursor>();
  private rateLimiters = new Map<WebSocket, RateLimiter>();
  private redis?: Redis;
  private subscriber?: Redis;
  private presence?: PresenceStore;
  private pubsub?: PubSub;
  private broadcaster!: Broadcaster;

  constructor(options: FlockServerOptions = {}) {
    this.port = options.port ?? envPort() ?? 8787;
    this.log = createLogger(options.logger ?? true);
    this.redisUrl = options.redisUrl ?? process.env.FLOCK_REDIS_URL;
    this.ttlSeconds =
      options.presence?.ttlSeconds ?? envTtlSeconds() ?? DEFAULT_TTL_SECONDS;
    this.apiKeys = options.apiKeys ?? process.env.FLOCK_API_KEYS?.split(",").map((k) => k.trim()).filter(Boolean);
    const envMaxMps = process.env.FLOCK_MAX_MESSAGES_PER_SECOND;
    this.maxMessagesPerSecond = options.maxMessagesPerSecond ?? (envMaxMps ? Number(envMaxMps) : DEFAULT_MAX_MESSAGES_PER_SECOND);
  }

  start(): Promise<void> {
    if (this.redisUrl) {
      this.redis = new Redis(this.redisUrl, { lazyConnect: false });
      this.redis.on("error", (err) => this.log.warn({ err }, "redis error"));
      this.presence = new PresenceStore(this.redis, this.ttlSeconds);
      this.pubsub = new PubSub(this.redis, this.instanceId);
      this.pubsub.setRemoteHandler((roomId, msg) => {
        this.broadcaster.sendFromRemote(roomId, msg);
      });
      this.subscribeToExpiry();
      this.log.info({ instanceId: this.instanceId }, "redis presence and pub/sub enabled");
    }

    this.broadcaster = new Broadcaster(this.rooms, this.pubsub);

    this.http = createHealthServer();
    this.wss = new WebSocketServer({ server: this.http });

    this.wss.on("connection", (socket) => {
      this.sockets.set(socket, {});
      this.rateLimiters.set(socket, new RateLimiter(this.maxMessagesPerSecond));
      this.log.info("client connected");

      socket.on("message", (data) => {
        const limiter = this.rateLimiters.get(socket);
        if (limiter && limiter.check()) {
          this.log.warn("rate limit exceeded, closing connection");
          this.send(socket, {
            type: "error",
            code: "RATE_LIMITED",
            message: "too many messages, slow down",
          });
          socket.close();
          return;
        }

        let msg: ClientMessage;
        try {
          msg = JSON.parse(data.toString()) as ClientMessage;
        } catch {
          this.log.warn("received invalid JSON");
          return;
        }
        this.handleMessage(socket, msg);
      });

      socket.on("close", () => this.handleClose(socket));
      socket.on("error", (err) => this.log.warn({ err }, "socket error"));
    });

    return new Promise((resolve) => {
      this.http!.listen(this.port, () => {
        this.log.info({ port: this.port }, "flock server listening");
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const socket of this.sockets.keys()) socket.close();
    this.sockets.clear();
    this.rateLimiters.clear();
    for (const pending of this.pendingCursors.values()) clearTimeout(pending.timer);
    this.pendingCursors.clear();
    await new Promise<void>((resolve) => this.wss?.close(() => resolve()));
    await new Promise<void>((resolve) => this.http?.close(() => resolve()));
    if (this.pubsub) {
      await this.pubsub.close();
      this.pubsub = undefined;
    }
    if (this.subscriber) {
      this.subscriber.disconnect();
      this.subscriber = undefined;
    }
    if (this.redis) {
      this.redis.disconnect();
      this.redis = undefined;
      this.presence = undefined;
    }
  }

  // Listens for Redis expired-key events on a dedicated connection (a connection
  // in subscribe mode can't run normal commands). When a presence key lapses
  // without a heartbeat, the user disconnected ungracefully and we evict them.
  private subscribeToExpiry(): void {
    const db = this.redis?.options.db ?? 0;
    const channel = `__keyevent@${db}__:expired`;

    this.subscriber = this.redis!.duplicate();
    this.subscriber.on("error", (err) =>
      this.log.warn({ err }, "redis subscriber error"),
    );
    this.subscriber.subscribe(channel, (err) => {
      if (err) this.log.warn({ err }, "failed to subscribe to expiry events");
    });
    this.subscriber.on("message", (_channel, key) => {
      const parsed = parsePresenceKey(key);
      if (parsed) {
        this.handleExpiredPresence(parsed.roomId, parsed.userId);
      }
    });
  }

  // Drops an evicted user from the room's member set, clears their cursor, and
  // tells everyone still connected to this instance that they left.
  private handleExpiredPresence(roomId: string, userId: string): void {
    this.log.info({ roomId, userId }, "presence expired, evicting user");

    if (this.presence) {
      this.presence
        .removePresence(roomId, userId)
        .catch((err) => this.log.warn({ err }, "failed to clean up expired presence"));
    }

    this.rooms.leaveRoom(roomId, userId);
    // Use a dummy socket for the sender since the user is no longer connected.
    // Expired-presence evictions only need to reach local sockets; cross-instance
    // evictions are handled by each instance receiving its own keyspace event.
    void this.broadcaster.broadcast(roomId, userId, { type: "user:left", roomId, userId }, {} as never);
  }

  getRoomCount(): number {
    return this.rooms.getRoomCount();
  }

  getClientCount(): number {
    return this.rooms.getClientCount();
  }

  private handleMessage(socket: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case "join":
        this.handleJoin(socket, msg);
        break;
      case "leave":
        this.handleLeave(socket);
        break;
      case "cursor:move":
        this.handleCursorMove(socket, msg.position);
        break;
      case "cursor:leave":
        this.handleCursorLeave(socket);
        break;
      case "presence:update":
        this.handlePresenceUpdate(socket, msg.metadata);
        break;
      case "heartbeat":
        this.handleHeartbeat(socket);
        break;
      default:
        this.log.warn({ type: (msg as { type: string }).type }, "unknown message type");
    }
  }

  private handleJoin(
    socket: WebSocket,
    msg: Extract<ClientMessage, { type: "join" }>,
  ): void {
    const { roomId, userId, metadata } = msg;

    if (!validateApiKey(msg.apiKey, this.apiKeys)) {
      this.log.warn({ userId }, "rejected join: invalid api key");
      this.send(socket, {
        type: "error",
        code: "INVALID_API_KEY",
        message: "invalid or missing api key",
      });
      socket.close();
      return;
    }

    // If this userId is already in the room on a different socket (a duplicate
    // tab or a refresh that beat the old socket's close), evict the old one
    // first: close its socket and tell the room it left, then treat this as a
    // clean re-join. We drop the old socket's state so its own close event
    // becomes a no-op and doesn't fire a second user:left.
    const existingClient = this.rooms.getClient(roomId, userId);
    if (existingClient && existingClient.socket !== socket) {
      const oldSocket = existingClient.socket;
      this.sockets.delete(oldSocket);
      this.log.info({ roomId, userId }, "duplicate join, evicting old connection");
      void this.broadcaster.broadcast(roomId, userId, { type: "user:left", roomId, userId }, oldSocket);
      oldSocket.close();
    }

    // Snapshot of everyone already here, sent back to the new joiner.
    const existing = this.rooms
      .getRoomClients(roomId)
      .filter((c) => c.userId !== userId)
      .map((c) => ({
        userId: c.userId,
        metadata: c.metadata,
        cursor: c.cursor,
      }));

    this.rooms.joinRoom(roomId, userId, metadata, socket);
    this.sockets.set(socket, { roomId, userId });
    this.log.info({ roomId, userId }, "user joined");

    if (this.presence) {
      this.presence
        .setPresence(roomId, userId, metadata)
        .catch((err) => this.log.warn({ err }, "failed to set presence"));
    }

    // Subscribe this instance to the room's pub/sub channel now that it has a
    // local client. Safe to call if already subscribed.
    if (this.pubsub) {
      this.pubsub
        .subscribeRoom(roomId)
        .catch((err) => this.log.warn({ err }, "failed to subscribe room to pubsub"));
    }

    this.send(socket, { type: "join:ack", roomId, users: existing });

    // Tell everyone already in the room (including other instances) that someone new showed up.
    void this.broadcaster.broadcast(roomId, userId, {
      type: "user:joined",
      roomId,
      userId,
      metadata,
    }, socket);

    // Replay any cursor moves that arrived on this socket before the join did.
    this.flushPendingCursors(socket);
  }

  // Sends any cursor moves that were buffered for a socket while it was waiting
  // to join, then clears the buffer.
  private flushPendingCursors(socket: WebSocket): void {
    const pending = this.pendingCursors.get(socket);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingCursors.delete(socket);
    for (const position of pending.positions) {
      this.handleCursorMove(socket, position);
    }
  }

  // Holds a cursor move for a socket that hasn't joined yet. We keep at most a
  // few of the most recent positions and drop the whole buffer if the join
  // doesn't arrive in time.
  private bufferCursorMove(socket: WebSocket, position: { x: number; y: number }): void {
    let pending = this.pendingCursors.get(socket);
    if (!pending) {
      const timer = setTimeout(() => {
        this.pendingCursors.delete(socket);
      }, CURSOR_BUFFER_TTL_MS);
      pending = { positions: [], timer };
      this.pendingCursors.set(socket, pending);
    }
    pending.positions.push(position);
    if (pending.positions.length > MAX_BUFFERED_CURSOR_MOVES) {
      pending.positions.shift();
    }
  }

  // Keeps a user's presence alive in Redis and acknowledges so the client knows
  // the server is still there.
  private handleHeartbeat(socket: WebSocket): void {
    const { roomId, userId } = this.sockets.get(socket) ?? {};
    if (this.presence && roomId && userId) {
      this.presence
        .refreshPresence(roomId, userId)
        .catch((err) => this.log.warn({ err }, "failed to refresh presence"));
    }
    this.send(socket, { type: "heartbeat:ack" });
  }

  private handleLeave(socket: WebSocket): void {
    this.handleClose(socket);
  }

  private handleCursorMove(socket: WebSocket, position: { x: number; y: number }): void {
    const { roomId, userId } = this.sockets.get(socket) ?? {};
    if (!roomId || !userId) {
      // The cursor beat the join over the wire. Hold a few moves so we don't
      // lose the user's position in that race, and replay them once they join.
      this.bufferCursorMove(socket, position);
      return;
    }

    const client = this.rooms.getClient(roomId, userId);
    if (client) client.cursor = position;

    if (this.presence) {
      this.presence
        .setCursor(roomId, userId, position)
        .catch((err) => this.log.warn({ err }, "failed to store cursor"));
    }

    void this.broadcaster.broadcast(roomId, userId, {
      type: "cursor:updated",
      roomId,
      userId,
      position,
      timestamp: Date.now(),
    }, socket);
  }

  private handleCursorLeave(socket: WebSocket): void {
    const { roomId, userId } = this.sockets.get(socket) ?? {};
    if (!roomId || !userId) return;

    const client = this.rooms.getClient(roomId, userId);
    if (client) client.cursor = undefined;

    if (this.presence) {
      this.presence
        .clearCursor(roomId, userId)
        .catch((err) => this.log.warn({ err }, "failed to clear cursor"));
    }

    void this.broadcaster.broadcast(roomId, userId, { type: "cursor:removed", roomId, userId }, socket);
  }

  // Merges a partial metadata patch into the user's stored presence and tells
  // the rest of the room about it. Keeps the in-memory copy in sync so a later
  // join:ack snapshot carries the updated metadata too.
  private handlePresenceUpdate(
    socket: WebSocket,
    metadata: Record<string, unknown>,
  ): void {
    const { roomId, userId } = this.sockets.get(socket) ?? {};
    if (!roomId || !userId) return;

    const client = this.rooms.getClient(roomId, userId);
    if (client) client.metadata = { ...client.metadata, ...metadata };

    if (this.presence) {
      this.presence
        .updateMetadata(roomId, userId, metadata)
        .catch((err) => this.log.warn({ err }, "failed to update presence metadata"));
    }

    void this.broadcaster.broadcast(roomId, userId, {
      type: "presence:updated",
      roomId,
      userId,
      metadata,
    }, socket);
  }

  private handleClose(socket: WebSocket): void {
    this.rateLimiters.delete(socket);

    const pending = this.pendingCursors.get(socket);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingCursors.delete(socket);
    }

    const state = this.sockets.get(socket);
    this.sockets.delete(socket);
    if (!state?.roomId || !state.userId) return;

    const { roomId, userId } = state;

    // If a newer socket for this same user has already taken over the room slot
    // (a duplicate tab, a refresh, or a reconnect that beat this close), this is
    // a stale socket closing. Leave the live user in place and stay quiet.
    const current = this.rooms.getClient(roomId, userId);
    if (current && current.socket !== socket) {
      this.log.info({ roomId, userId }, "stale socket closed, keeping live user");
      return;
    }

    const remaining = this.rooms.leaveRoom(roomId, userId);
    this.log.info({ roomId, userId }, "user left");

    if (this.presence) {
      this.presence
        .removePresence(roomId, userId)
        .catch((err) => this.log.warn({ err }, "failed to remove presence"));
    }

    void this.broadcaster.broadcast(roomId, userId, { type: "user:left", roomId, userId }, socket);

    // When the last local client leaves this room, stop listening on its
    // pub/sub channel so we don't accumulate stale subscriptions.
    if (remaining === 0 && this.pubsub) {
      this.pubsub
        .unsubscribeRoom(roomId)
        .catch((err) => this.log.warn({ err }, "failed to unsubscribe room from pubsub"));
    }
  }

  private send(socket: WebSocket, msg: ServerMessage): void {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }
}
