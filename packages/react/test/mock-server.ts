// A tiny stand-in for the real Flock server, just enough for the hook tests to
// exercise the client. It understands join (replies with a snapshot) and lets
// the test push arbitrary server messages to a connected client so we can
// simulate joins, cursor moves, and so on.

import { WebSocketServer, WebSocket as WsWebSocket, type WebSocket } from "ws";
import type { AddressInfo } from "node:net";

export interface MockServer {
  url: string;
  // Sends a raw server message to every connected client.
  push(message: unknown): void;
  // Snapshot of users returned in the next join:ack.
  setSnapshot(users: unknown[]): void;
  close(): Promise<void>;
}

export async function startMockServer(): Promise<MockServer> {
  const wss = new WebSocketServer({ port: 0 });
  const clients = new Set<WebSocket>();
  let snapshot: unknown[] = [];

  wss.on("connection", (socket) => {
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
    socket.on("message", (data) => {
      let msg: { type?: string; roomId?: string };
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg.type === "join") {
        socket.send(JSON.stringify({ type: "join:ack", roomId: msg.roomId, users: snapshot }));
      }
    });
  });

  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));
  const port = (wss.address() as AddressInfo).port;

  // The core client uses the global WebSocket. In jsdom there isn't one, so
  // point it at the ws implementation for the duration of the test run.
  (globalThis as { WebSocket?: unknown }).WebSocket = WsWebSocket;

  return {
    url: `ws://localhost:${port}`,
    push(message) {
      const data = JSON.stringify(message);
      for (const c of clients) if (c.readyState === c.OPEN) c.send(data);
    },
    setSnapshot(users) {
      snapshot = users;
    },
    close() {
      for (const c of clients) c.close();
      return new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}
