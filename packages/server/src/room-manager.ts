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

export class RoomManager {
  // roomId -> (userId -> client)
  private rooms = new Map<string, Map<string, RoomClient>>();

  joinRoom(
    roomId: string,
    userId: string,
    metadata: UserMetadata,
    socket: WebSocket,
  ): RoomClient {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Map();
      this.rooms.set(roomId, room);
    }
    const client: RoomClient = { userId, metadata, socket, joinedAt: Date.now() };
    room.set(userId, client);
    return client;
  }

  // Removes a user and returns how many people are left in the room.
  leaveRoom(roomId: string, userId: string): number {
    const room = this.rooms.get(roomId);
    if (!room) return 0;
    room.delete(userId);
    if (room.size === 0) {
      this.rooms.delete(roomId);
      return 0;
    }
    return room.size;
  }

  getRoomClients(roomId: string): RoomClient[] {
    const room = this.rooms.get(roomId);
    return room ? [...room.values()] : [];
  }

  getClient(roomId: string, userId: string): RoomClient | undefined {
    return this.rooms.get(roomId)?.get(userId);
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getClientCount(): number {
    let total = 0;
    for (const room of this.rooms.values()) total += room.size;
    return total;
  }
}
