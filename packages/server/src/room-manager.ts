// Keeps track of which clients are in which room, all in memory. This is what
// the server uses to know who to broadcast a message to.

import type { WebSocket } from "ws";
import type { UserMetadata } from "./messages.js";

export interface RoomClient {
  userId: string;
  metadata: UserMetadata;
  socket: WebSocket;
  joinedAt: number;
  // Last cursor position we saw, so a new joiner can be told where everyone is.
  cursor?: { x: number; y: number };
}

interface RoomMeta {
  clients: Map<string, RoomClient>;
  createdAt: number;
}

export class RoomManager {
  // roomId -> room metadata + clients
  private rooms = new Map<string, RoomMeta>();

  joinRoom(
    roomId: string,
    userId: string,
    metadata: UserMetadata,
    socket: WebSocket,
  ): RoomClient {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = { clients: new Map(), createdAt: Date.now() };
      this.rooms.set(roomId, room);
    }
    const client: RoomClient = { userId, metadata, socket, joinedAt: Date.now() };
    room.clients.set(userId, client);
    return client;
  }

  // Removes a user and returns how many people are left in the room.
  leaveRoom(roomId: string, userId: string): number {
    const room = this.rooms.get(roomId);
    if (!room) return 0;
    room.clients.delete(userId);
    if (room.clients.size === 0) {
      this.rooms.delete(roomId);
      return 0;
    }
    return room.clients.size;
  }

  getRoomClients(roomId: string): RoomClient[] {
    const room = this.rooms.get(roomId);
    return room ? [...room.clients.values()] : [];
  }

  getClient(roomId: string, userId: string): RoomClient | undefined {
    return this.rooms.get(roomId)?.clients.get(userId);
  }

  // Returns all sockets in a room and removes it, for forced closure.
  closeRoom(roomId: string): RoomClient[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    const clients = [...room.clients.values()];
    this.rooms.delete(roomId);
    return clients;
  }

  getAllRooms(): Array<{ roomId: string; createdAt: number; clients: RoomClient[] }> {
    return [...this.rooms.entries()].map(([roomId, room]) => ({
      roomId,
      createdAt: room.createdAt,
      clients: [...room.clients.values()],
    }));
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getClientCount(): number {
    let total = 0;
    for (const room of this.rooms.values()) total += room.clients.size;
    return total;
  }
}
