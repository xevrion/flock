// Single place that sends an outgoing message to every recipient: local sockets
// in the room directly, and remote instances via the Redis pub/sub channel.

import type { WebSocket } from "ws";
import type { ServerMessage } from "./messages.js";
import type { RoomManager } from "./room-manager.js";
import type { PubSub } from "./pubsub.js";

export class Broadcaster {
  constructor(
    private readonly rooms: RoomManager,
    private readonly pubsub?: PubSub,
  ) {}

  // Sends a message to all local sockets in the room except the sender, and
  // publishes to Redis so other instances can relay it to their local clients.
  async broadcast(
    roomId: string,
    exceptUserId: string,
    msg: ServerMessage,
    sender: WebSocket,
  ): Promise<void> {
    this.sendLocal(roomId, exceptUserId, msg, sender);
    if (this.pubsub) {
      await this.pubsub
        .publish(roomId, msg)
        .catch(() => {
          // Don't let a Redis failure block the local delivery path.
        });
    }
  }

  // Sends a message that arrived from a remote instance to all local sockets in
  // the room. No sender to exclude because the remote instance already excluded
  // its own sender before publishing.
  sendFromRemote(roomId: string, msg: ServerMessage): void {
    for (const client of this.rooms.getRoomClients(roomId)) {
      if (client.socket.readyState === client.socket.OPEN) {
        client.socket.send(JSON.stringify(msg));
      }
    }
  }

  private sendLocal(
    roomId: string,
    exceptUserId: string,
    msg: ServerMessage,
    _sender: WebSocket,
  ): void {
    for (const client of this.rooms.getRoomClients(roomId)) {
      if (client.userId === exceptUserId) continue;
      if (client.socket.readyState === client.socket.OPEN) {
        client.socket.send(JSON.stringify(msg));
      }
    }
  }
}
