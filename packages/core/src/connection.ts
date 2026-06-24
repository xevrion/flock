// Wraps a single WebSocket. Handles connecting, sending typed messages, and
// dispatching incoming messages to a handler. Reconnection comes later; for now
// it connects, talks, and closes cleanly.

import type { ClientMessage, ServerMessage } from "./messages.js";

export type MessageHandler = (msg: ServerMessage) => void;
export type OpenHandler = () => void;
export type CloseHandler = () => void;

export class Connection {
  private ws?: WebSocket;
  private messageHandlers = new Set<MessageHandler>();
  private openHandlers = new Set<OpenHandler>();
  private closeHandlers = new Set<CloseHandler>();

  constructor(private readonly url: string) {}

  connect(): void {
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      for (const h of this.openHandlers) h();
    });

    ws.addEventListener("message", (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }
      for (const h of this.messageHandlers) h(msg);
    });

    ws.addEventListener("close", () => {
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

  close(): void {
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
}
