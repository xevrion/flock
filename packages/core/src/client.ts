// The handle an app creates once. Owns the single WebSocket connection and hands
// out a Room for each room the app joins. Routes incoming messages to the room
// they belong to.

import { Connection } from "./connection.js";
import { Room } from "./room.js";
import type {
  ConnectionStatus,
  FlockClientOptions,
  FlockRoom,
  RoomOptions,
} from "./types.js";

export class FlockClient {
  status: ConnectionStatus = "connecting";

  private readonly connection: Connection;
  private rooms = new Map<string, Room>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();

  constructor(options: FlockClientOptions) {
    this.connection = new Connection(options.serverUrl);

    this.connection.onOpen(() => {
      this.setStatus("connected");
      // Re-send join for any room we already wanted to be in.
      for (const room of this.rooms.values()) room.join();
    });

    this.connection.onClose(() => this.setStatus("disconnected"));

    this.connection.onMessage((msg) => {
      const roomId = (msg as { roomId?: string }).roomId;
      if (roomId) {
        this.rooms.get(roomId)?.handleMessage(msg);
      }
    });

    this.connection.connect();
  }

  joinRoom(roomId: string, options: RoomOptions): FlockRoom {
    const room = new Room(roomId, options, this.connection);
    this.rooms.set(roomId, room);
    // If the socket is already open, join right away; otherwise the open
    // handler will join once it connects.
    if (this.connection.isOpen) room.join();
    return room;
  }

  leaveRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.leave();
    this.rooms.delete(roomId);
  }

  leaveAllRooms(): void {
    for (const roomId of [...this.rooms.keys()]) this.leaveRoom(roomId);
  }

  destroy(): void {
    this.leaveAllRooms();
    this.connection.close();
  }

  onStatusChange(handler: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(handler);
    return () => this.statusListeners.delete(handler);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const h of this.statusListeners) h(status);
  }
}
