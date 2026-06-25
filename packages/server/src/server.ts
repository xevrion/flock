// The presence server. Accepts WebSocket connections, routes incoming wire
// messages, and broadcasts updates to the other people in a room.

import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import { Redis } from "ioredis";
import { createHealthServer } from "./health.js";
import { createLogger, type Logger } from "./logger.js";
import { RoomManager } from "./room-manager.js";
import { PresenceStore, parsePresenceKey } from "./presence.js";
import type { ClientMessage, ServerMessage } from "./messages.js";

const DEFAULT_TTL_SECONDS = 30;

export interface FlockServerOptions {
  port?: number;
  redisUrl?: string;
  apiKeys?: string[];
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

export class FlockServer {
  private readonly port: number;
  private readonly log: Logger;
  private readonly rooms = new RoomManager();
  private readonly redisUrl?: string;
  private readonly ttlSeconds: number;
  private http?: Server;
  private wss?: WebSocketServer;
  private sockets = new Map<WebSocket, SocketState>();
  private redis?: Redis;
  private subscriber?: Redis;
  private presence?: PresenceStore;

  constructor(options: FlockServerOptions = {}) {
    this.port = options.port ?? envPort() ?? 8787;
    this.log = createLogger(options.logger ?? true);
    this.redisUrl = options.redisUrl ?? process.env.FLOCK_REDIS_URL;
    this.ttlSeconds =
      options.presence?.ttlSeconds ?? envTtlSeconds() ?? DEFAULT_TTL_SECONDS;
  }

  start(): Promise<void> {
    if (this.redisUrl) {
      this.redis = new Redis(this.redisUrl, { lazyConnect: false });
      this.redis.on("error", (err) => this.log.warn({ err }, "redis error"));
      this.presence = new PresenceStore(this.redis, this.ttlSeconds);
      this.subscribeToExpiry();
      this.log.info("redis presence enabled");
    }

    this.http = createHealthServer();
    this.wss = new WebSocketServer({ server: this.http });

    this.wss.on("connection", (socket) => {
      this.sockets.set(socket, {});
      this.log.info("client connected");

      socket.on("message", (data) => {
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
    await new Promise<void>((resolve) => this.wss?.close(() => resolve()));
    await new Promise<void>((resolve) => this.http?.close(() => resolve()));
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
    this.broadcast(roomId, userId, { type: "user:left", roomId, userId });
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

    // Snapshot of everyone already here, sent back to the new joiner.
    const existing = this.rooms.getRoomClients(roomId).map((c) => ({
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

    this.send(socket, { type: "join:ack", roomId, users: existing });

    // Tell everyone already in the room that someone new showed up.
    this.broadcast(roomId, userId, {
      type: "user:joined",
      roomId,
      userId,
      metadata,
    });
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
    if (!roomId || !userId) return;

    const client = this.rooms.getClient(roomId, userId);
    if (client) client.cursor = position;

    if (this.presence) {
      this.presence
        .setCursor(roomId, userId, position)
        .catch((err) => this.log.warn({ err }, "failed to store cursor"));
    }

    this.broadcast(roomId, userId, {
      type: "cursor:updated",
      roomId,
      userId,
      position,
      timestamp: Date.now(),
    });
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

    this.broadcast(roomId, userId, { type: "cursor:removed", roomId, userId });
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

    this.broadcast(roomId, userId, {
      type: "presence:updated",
      roomId,
      userId,
      metadata,
    });
  }

  private handleClose(socket: WebSocket): void {
    const state = this.sockets.get(socket);
    this.sockets.delete(socket);
    if (!state?.roomId || !state.userId) return;

    const { roomId, userId } = state;
    this.rooms.leaveRoom(roomId, userId);
    this.log.info({ roomId, userId }, "user left");

    if (this.presence) {
      this.presence
        .removePresence(roomId, userId)
        .catch((err) => this.log.warn({ err }, "failed to remove presence"));
    }

    this.broadcast(roomId, userId, { type: "user:left", roomId, userId });
  }

  // Sends a message to everyone in the room except the user it came from.
  private broadcast(roomId: string, exceptUserId: string, msg: ServerMessage): void {
    for (const client of this.rooms.getRoomClients(roomId)) {
      if (client.userId === exceptUserId) continue;
      this.send(client.socket, msg);
    }
  }

  private send(socket: WebSocket, msg: ServerMessage): void {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }
}
