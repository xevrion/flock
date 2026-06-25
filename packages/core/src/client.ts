// The handle an app creates once. Owns the single WebSocket connection and hands
// out a Room for each room the app joins. Routes incoming messages to the room
// they belong to.

import { Connection } from "./connection.js";
import { Room } from "./room.js";
import { FlockError } from "./errors.js";
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
  private errorListeners = new Set<(error: FlockError) => void>();
  // Whether the next open is a reconnect rather than the first connection, so we
  // know to reset stale room state before re-joining.
  private reconnecting = false;

  constructor(options: FlockClientOptions) {
    this.connection = new Connection(options.serverUrl, {
      getRoomIds: () => [...this.rooms.keys()],
      reconnect: options.reconnect,
    });

    this.connection.onOpen(() => {
      const wasReconnecting = this.reconnecting;
      this.reconnecting = false;
      this.setStatus("connected");
      // Re-send join for any room we already wanted to be in. On a reconnect we
      // first drop the stale remote view so the fresh snapshot rebuilds it.
      for (const room of this.rooms.values()) {
        if (wasReconnecting) room.resetRemoteState();
        room.join();
      }
    });

    this.connection.onClose(() => {
      // A reconnect attempt will follow unless this was a deliberate teardown,
      // in which case status stays whatever destroy() left it.
      if (this.status !== "disconnected" && !this.reconnecting) {
        this.setStatus("disconnected");
      }
    });

    this.connection.onReconnecting(() => {
      this.reconnecting = true;
      this.setStatus("reconnecting");
    });

    this.connection.onReconnectFailed(() => {
      this.reconnecting = false;
      this.setStatus("error");
      this.emitError(
        new FlockError(
          "MAX_RECONNECT_ATTEMPTS_EXCEEDED",
          "gave up reconnecting after the configured number of attempts",
        ),
      );
    });

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

  onError(handler: (error: FlockError) => void): () => void {
    this.errorListeners.add(handler);
    return () => this.errorListeners.delete(handler);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const h of this.statusListeners) h(status);
  }

  private emitError(error: FlockError): void {
    for (const h of this.errorListeners) h(error);
  }
}
