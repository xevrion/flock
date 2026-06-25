import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { FlockServer } from "../src/server.js";

const PORT = 8799;
const URL = `ws://localhost:${PORT}`;

// Opens a socket and resolves once it's connected.
function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

// Waits for the next message of a given type on a socket.
function waitFor(ws: WebSocket, type: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === type) resolve(msg);
    });
  });
}

describe("FlockServer", () => {
  let server: FlockServer;

  beforeEach(async () => {
    server = new FlockServer({ port: PORT, logger: false });
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it("tells existing members when a new user joins", async () => {
    const a = await connect();
    a.send(JSON.stringify({ type: "join", roomId: "r", userId: "a", metadata: {} }));
    await waitFor(a, "join:ack");

    const joined = waitFor(a, "user:joined");

    const b = await connect();
    b.send(JSON.stringify({ type: "join", roomId: "r", userId: "b", metadata: {} }));

    const msg = await joined;
    expect(msg.userId).toBe("b");

    a.close();
    b.close();
  });

  it("tells remaining members when a user leaves", async () => {
    const a = await connect();
    a.send(JSON.stringify({ type: "join", roomId: "r", userId: "a", metadata: {} }));
    await waitFor(a, "join:ack");

    const b = await connect();
    b.send(JSON.stringify({ type: "join", roomId: "r", userId: "b", metadata: {} }));
    await waitFor(b, "join:ack");

    const left = waitFor(a, "user:left");
    b.close();

    const msg = await left;
    expect(msg.userId).toBe("b");

    a.close();
  });

  it("broadcasts presence updates to other members", async () => {
    const a = await connect();
    a.send(JSON.stringify({ type: "join", roomId: "r", userId: "a", metadata: {} }));
    await waitFor(a, "join:ack");

    const b = await connect();
    b.send(
      JSON.stringify({ type: "join", roomId: "r", userId: "b", metadata: { name: "Bob" } }),
    );
    await waitFor(b, "join:ack");

    const updated = waitFor(a, "presence:updated");
    b.send(JSON.stringify({ type: "presence:update", roomId: "r", metadata: { status: "idle" } }));

    const msg = await updated;
    expect(msg.userId).toBe("b");
    expect(msg.metadata).toEqual({ status: "idle" });

    a.close();
    b.close();
  });

  it("relays cursor moves to other members", async () => {
    const a = await connect();
    a.send(JSON.stringify({ type: "join", roomId: "r", userId: "a", metadata: {} }));
    await waitFor(a, "join:ack");

    const b = await connect();
    b.send(JSON.stringify({ type: "join", roomId: "r", userId: "b", metadata: {} }));
    await waitFor(b, "join:ack");

    const updated = waitFor(a, "cursor:updated");
    b.send(JSON.stringify({ type: "cursor:move", roomId: "r", position: { x: 0.5, y: 0.5 } }));

    const msg = await updated;
    expect(msg.userId).toBe("b");
    expect(msg.position).toEqual({ x: 0.5, y: 0.5 });

    a.close();
    b.close();
  });
});
