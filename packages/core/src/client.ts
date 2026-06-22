// Top-level handle an app creates once. Owns the single WebSocket connection
// and hands out a FlockRoom for each room the app joins.

import type {
  FlockClientOptions,
  RoomOptions,
  FlockRoom,
  ConnectionStatus,
} from "./types.js";

export class FlockClient {
  readonly status: ConnectionStatus = "disconnected";

  constructor(_options: FlockClientOptions) {
    void _options;
  }

  joinRoom(_roomId: string, _options: RoomOptions): FlockRoom {
    throw new Error("FlockClient.joinRoom is not implemented yet");
  }

  leaveRoom(_roomId: string): void {}
  leaveAllRooms(): void {}
  destroy(): void {}
}
