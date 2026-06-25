// Wraps a single WebSocket. Handles connecting, sending typed messages, and
// dispatching incoming messages to a handler. Sends periodic heartbeats while
// connected and watches for the server going quiet (no acks). When the socket
// drops unexpectedly (or goes stale) it reconnects with exponential backoff.

import type { ClientMessage, ServerMessage } from "./messages.js";

export type MessageHandler = (msg: ServerMessage) => void;
export type OpenHandler = () => void;
export type CloseHandler = () => void;
export type StaleHandler = () => void;
export type ReconnectingHandler = (attempt: number) => void;
export type ReconnectFailedHandler = () => void;

export interface ReconnectOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface ConnectionOptions {
  // How often to send a heartbeat while connected. Defaults to 10s.
  heartbeatIntervalMs?: number;
  // Returns the rooms a heartbeat should be sent for. Each connected room needs
  // its own heartbeat to keep its presence alive on the server.
  getRoomIds?: () => string[];
  reconnect?: ReconnectOptions;
}

const DEFAULT_HEARTBEAT_INTERVAL_MS = 10000;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;

export class Connection {
  private ws?: WebSocket;
  private messageHandlers = new Set<MessageHandler>();
  private openHandlers = new Set<OpenHandler>();
  private closeHandlers = new Set<CloseHandler>();
  private staleHandlers = new Set<StaleHandler>();
  private reconnectingHandlers = new Set<ReconnectingHandler>();
  private reconnectFailedHandlers = new Set<ReconnectFailedHandler>();

  private readonly heartbeatIntervalMs: number;
  private readonly getRoomIds: () => string[];
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;

  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private staleTimer?: ReturnType<typeof setTimeout>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  // True once close() is called, so the unexpected-close path knows not to
  // reconnect after a deliberate teardown.
  private closed = false;
  private attempt = 0;

  constructor(
    private readonly url: string,
    options: ConnectionOptions = {},
  ) {
    this.heartbeatIntervalMs =
      options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.getRoomIds = options.getRoomIds ?? (() => []);
    this.maxAttempts = options.reconnect?.maxAttempts ?? Infinity;
    this.baseDelayMs = options.reconnect?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    this.maxDelayMs = options.reconnect?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  }

  connect(): void {
    this.closed = false;
    this.openSocket();
  }

  private openSocket(): void {
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      // A successful open resets the backoff so the next drop starts fresh.
      this.attempt = 0;
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
      if (!this.closed) this.scheduleReconnect();
    });

    // A connection that never opens (server down, refused) fires "error". Without
    // a listener some implementations turn this into an unhandled exception, so
    // we swallow it here. The matching "close" event drives reconnection.
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
  // window). The connection is treated as dead and reconnection kicks in.
  onStale(handler: StaleHandler): () => void {
    this.staleHandlers.add(handler);
    return () => this.staleHandlers.delete(handler);
  }

  // Fires before each reconnection attempt with the attempt number (1-based).
  onReconnecting(handler: ReconnectingHandler): () => void {
    this.reconnectingHandlers.add(handler);
    return () => this.reconnectingHandlers.delete(handler);
  }

  // Fires when reconnection gives up after exhausting maxAttempts.
  onReconnectFailed(handler: ReconnectFailedHandler): () => void {
    this.reconnectFailedHandlers.add(handler);
    return () => this.reconnectFailedHandlers.delete(handler);
  }

  close(): void {
    this.closed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
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

  // Decides whether to retry after an unexpected drop, and when. The delay
  // doubles each attempt, capped at maxDelayMs. Once attempts run out the
  // failure handlers fire and we stop.
  private scheduleReconnect(): void {
    if (this.closed) return;

    if (this.attempt >= this.maxAttempts) {
      for (const h of this.reconnectFailedHandlers) h();
      return;
    }

    this.attempt += 1;
    const delay = Math.min(
      this.baseDelayMs * 2 ** (this.attempt - 1),
      this.maxDelayMs,
    );
    for (const h of this.reconnectingHandlers) h(this.attempt);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (!this.closed) this.openSocket();
    }, delay);
  }

  // Treats a stale server as a dropped connection: tear down the current socket
  // (its close handler will trigger the reconnect path) and signal staleness.
  private handleStale(): void {
    for (const h of this.staleHandlers) h();
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      // The close listener will schedule the reconnect.
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
      this.handleStale();
    }, this.heartbeatIntervalMs * 2);
  }
}
