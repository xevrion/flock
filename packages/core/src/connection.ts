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
    this.ws?.close();
    this.ws = undefined;
  }
}
