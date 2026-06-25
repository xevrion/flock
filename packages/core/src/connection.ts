// Wraps a single WebSocket. Handles connecting, sending typed messages, and
// dispatching incoming messages to a handler. Sends periodic heartbeats while
// connected and watches for the server going quiet (no acks) so a stale
// connection can be torn down and reconnected.

import type { ClientMessage, ServerMessage } from "./messages.js";

export type MessageHandler = (msg: ServerMessage) => void;
export type OpenHandler = () => void;
export type CloseHandler = () => void;
export type StaleHandler = () => void;

export interface ConnectionOptions {
  // How often to send a heartbeat while connected. Defaults to 10s.
  heartbeatIntervalMs?: number;
  // Returns the rooms a heartbeat should be sent for. Each connected room needs
  // its own heartbeat to keep its presence alive on the server.
  getRoomIds?: () => string[];
}

const DEFAULT_HEARTBEAT_INTERVAL_MS = 10000;

export class Connection {
  private ws?: WebSocket;
  private messageHandlers = new Set<MessageHandler>();
  private openHandlers = new Set<OpenHandler>();
  private closeHandlers = new Set<CloseHandler>();
  private staleHandlers = new Set<StaleHandler>();

  private readonly heartbeatIntervalMs: number;
  private readonly getRoomIds: () => string[];
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private staleTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly url: string,
    options: ConnectionOptions = {},
  ) {
    this.heartbeatIntervalMs =
      options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.getRoomIds = options.getRoomIds ?? (() => []);
  }

  connect(): void {
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.startHeartbeat();
      for (const h of this.openHandlers) h();
    });

    ws.addEventListener("message", (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }
      // A heartbeat ack means the server is alive, so push the stale timer out.
      if (msg.type === "heartbeat:ack") {
        this.armStaleTimer();
        return;
      }
      for (const h of this.messageHandlers) h(msg);
    });

    ws.addEventListener("close", () => {
      this.stopHeartbeat();
      for (const h of this.closeHandlers) h();
    });

    // A connection that never opens (server down, refused) fires "error". Without
    // a listener some implementations turn this into an unhandled exception, so
    // we swallow it here. The matching "close" event drives the status change.
    ws.addEventListener("error", () => {});
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onOpen(handler: OpenHandler): () => void {
    this.openHandlers.add(handler);
    return () => this.openHandlers.delete(handler);
  }

  onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  // Fires when the server has gone quiet (no heartbeat ack within the stale
  // window), so the connection should be considered dead even though the socket
  // may still look open. Used to trigger a reconnect.
  onStale(handler: StaleHandler): () => void {
    this.staleHandlers.add(handler);
    return () => this.staleHandlers.delete(handler);
  }

  close(): void {
    this.stopHeartbeat();
    const ws = this.ws;
    this.ws = undefined;
    if (!ws) return;

    // Closing a socket that hasn't finished connecting throws in some WebSocket
    // implementations. If it's still opening, wait for it to open (or fail) and
    // close it then.
    if (ws.readyState === WebSocket.CONNECTING) {
      ws.addEventListener("open", () => ws.close(), { once: true });
    } else if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.armStaleTimer();
    this.heartbeatTimer = setInterval(() => {
      for (const roomId of this.getRoomIds()) {
        this.send({ type: "heartbeat", roomId });
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    if (this.staleTimer) {
      clearTimeout(this.staleTimer);
      this.staleTimer = undefined;
    }
  }

  // The server is considered stale if it doesn't ack within twice the heartbeat
  // interval. Each ack rearms this timer.
  private armStaleTimer(): void {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => {
      for (const h of this.staleHandlers) h();
    }, this.heartbeatIntervalMs * 2);
  }
}
