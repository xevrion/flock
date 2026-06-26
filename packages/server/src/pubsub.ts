// Relays broadcasts between server instances over Redis pub/sub so clients on
// different instances still see each other. Each instance subscribes to a
// room's channel only while it has at least one local client in that room, and
// tags every published message with its own instance id so it can ignore the
// echoes of its own publishes.

import type { Redis } from "ioredis";
import type { ServerMessage } from "./messages.js";

// The Redis channel a room's cross-instance broadcasts travel on.
function channelFor(roomId: string): string {
  return `flock:broadcast:${roomId}`;
}

// What actually goes over the wire on a broadcast channel: the originating
// instance plus the message every other instance should fan out locally.
interface PubSubEnvelope {
  instanceId: string;
  message: ServerMessage;
}

// Called when a message arrives from another instance and should be delivered
// to this instance's local sockets in the given room.
export type RemoteHandler = (roomId: string, message: ServerMessage) => void;

export class PubSub {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly instanceId: string;
  private onRemote?: RemoteHandler;
  // Tracks which room channels this instance is currently subscribed to.
  private readonly subscribed = new Set<string>();

  constructor(redis: Redis, instanceId: string) {
    this.instanceId = instanceId;
    // One connection publishes; a separate one subscribes, because a connection
    // in subscribe mode cannot issue normal commands like publish.
    this.publisher = redis;
    this.subscriber = redis.duplicate();

    this.subscriber.on("messageBuffer", (channelBuf, payloadBuf) => {
      this.handleRaw(channelBuf.toString(), payloadBuf.toString());
    });
  }

  // Registers the callback that delivers a remote message to local sockets.
  setRemoteHandler(handler: RemoteHandler): void {
    this.onRemote = handler;
  }

  // Starts listening for broadcasts in a room. Safe to call repeatedly; only
  // the first call for a room actually subscribes.
  async subscribeRoom(roomId: string): Promise<void> {
    if (this.subscribed.has(roomId)) return;
    this.subscribed.add(roomId);
    await this.subscriber.subscribe(channelFor(roomId));
  }

  // Stops listening for broadcasts in a room once no local clients remain.
  async unsubscribeRoom(roomId: string): Promise<void> {
    if (!this.subscribed.has(roomId)) return;
    this.subscribed.delete(roomId);
    await this.subscriber.unsubscribe(channelFor(roomId));
  }

  // Publishes a message to every other instance subscribed to the room.
  async publish(roomId: string, message: ServerMessage): Promise<void> {
    const envelope: PubSubEnvelope = { instanceId: this.instanceId, message };
    await this.publisher.publish(channelFor(roomId), JSON.stringify(envelope));
  }

  async close(): Promise<void> {
    this.subscriber.disconnect();
  }

  private handleRaw(channel: string, payload: string): void {
    const roomId = channel.slice("flock:broadcast:".length);
    let envelope: PubSubEnvelope;
    try {
      envelope = JSON.parse(payload) as PubSubEnvelope;
    } catch {
      return;
    }
    // Skip our own publishes; we already delivered those to local sockets.
    if (envelope.instanceId === this.instanceId) return;
    this.onRemote?.(roomId, envelope.message);
  }
}
