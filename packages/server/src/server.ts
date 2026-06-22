// The presence server. Accepts WebSocket connections, routes incoming wire
// messages, and broadcasts updates to the other people in a room.

import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import { createHealthServer } from "./health.js";
import { createLogger, type Logger } from "./logger.js";
import { RoomManager } from "./room-manager.js";
import type { ClientMessage, ServerMessage } from "./messages.js";

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
  private http?: Server;
  private wss?: WebSocketServer;
  private sockets = new Map<WebSocket, SocketState>();

  constructor(options: FlockServerOptions = {}) {
    this.port = options.port ?? envPort() ?? 8787;
    this.log = createLogger(options.logger ?? true);
  }

  start(): Promise<void> {
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
      case "heartbeat":
        this.send(socket, { type: "heartbeat:ack" });
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

    this.send(socket, { type: "join:ack", roomId, users: existing });

    // Tell everyone already in the room that someone new showed up.
    this.broadcast(roomId, userId, {
      type: "user:joined",
      roomId,
      userId,
      metadata,
    });
  }

  private handleLeave(socket: WebSocket): void {
    this.handleClose(socket);
  }

  private handleCursorMove(socket: WebSocket, position: { x: number; y: number }): void {
    const { roomId, userId } = this.sockets.get(socket) ?? {};
    if (!roomId || !userId) return;

    const client = this.rooms.getClient(roomId, userId);
    if (client) client.cursor = position;

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

    this.broadcast(roomId, userId, { type: "cursor:removed", roomId, userId });
  }

  private handleClose(socket: WebSocket): void {
    const state = this.sockets.get(socket);
    this.sockets.delete(socket);
    if (!state?.roomId || !state.userId) return;

    const { roomId, userId } = state;
    this.rooms.leaveRoom(roomId, userId);
    this.log.info({ roomId, userId }, "user left");

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
