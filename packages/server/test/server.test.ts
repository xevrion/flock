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

  it("keeps a user present when a stale duplicate socket closes", async () => {
    const a = await connect();
    a.send(JSON.stringify({ type: "join", roomId: "r", userId: "a", metadata: {} }));
    await waitFor(a, "join:ack");

    // b joins on one socket, then opens a second socket for the same userId
    // (a refresh or a duplicate tab) and the first socket closes afterwards.
    const b1 = await connect();
    b1.send(JSON.stringify({ type: "join", roomId: "r", userId: "b", metadata: {} }));
    await waitFor(a, "user:joined");

    const b2 = await connect();
    b2.send(JSON.stringify({ type: "join", roomId: "r", userId: "b", metadata: {} }));
    await waitFor(b2, "join:ack");

    // Closing the stale first socket must NOT evict b, who is live on b2.
    const stillHere = new Promise<boolean>((resolve) => {
      const onMsg = (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "user:left" && msg.userId === "b") resolve(false);
      };
      a.on("message", onMsg);
      setTimeout(() => resolve(true), 400);
    });
    b1.close();

    expect(await stillHere).toBe(true);
    // b is still reachable on the live socket.
    const moved = waitFor(a, "cursor:updated");
    b2.send(JSON.stringify({ type: "cursor:move", roomId: "r", position: { x: 0.1, y: 0.2 } }));
    const msg = await moved;
    expect(msg.userId).toBe("b");

    a.close();
    b2.close();
  });

  it("evicts an old connection when the same user joins again", async () => {
    const watcher = await connect();
    watcher.send(JSON.stringify({ type: "join", roomId: "r", userId: "w", metadata: {} }));
    await waitFor(watcher, "join:ack");

    // b joins, then re-joins on a brand new socket (e.g. a duplicate tab). The
    // old socket should be evicted: the room sees user:left, then user:joined.
    const b1 = await connect();
    b1.send(JSON.stringify({ type: "join", roomId: "r", userId: "b", metadata: {} }));
    await waitFor(watcher, "user:joined");

    const oldClosed = new Promise<void>((resolve) => b1.on("close", () => resolve()));
    const left = waitFor(watcher, "user:left");
    const rejoined = waitFor(watcher, "user:joined");

    const b2 = await connect();
    b2.send(JSON.stringify({ type: "join", roomId: "r", userId: "b", metadata: {} }));

    expect((await left).userId).toBe("b");
    expect((await rejoined).userId).toBe("b");
    await oldClosed; // the stale socket was actually closed

    watcher.close();
    b2.close();
  });

  it("buffers cursor moves that arrive before the join and replays them", async () => {
    const a = await connect();
    a.send(JSON.stringify({ type: "join", roomId: "r", userId: "a", metadata: {} }));
    await waitFor(a, "join:ack");

    const updated = waitFor(a, "cursor:updated");

    // b sends a cursor move before its join. The server should hold it and only
    // relay it once b's join is processed.
    const b = await connect();
    b.send(JSON.stringify({ type: "cursor:move", roomId: "r", position: { x: 0.7, y: 0.3 } }));
    b.send(JSON.stringify({ type: "join", roomId: "r", userId: "b", metadata: {} }));

    const msg = await updated;
    expect(msg.userId).toBe("b");
    expect(msg.position).toEqual({ x: 0.7, y: 0.3 });

    a.close();
    b.close();
  });

  it("drops buffered cursor moves if the join never arrives", async () => {
    const a = await connect();
    a.send(JSON.stringify({ type: "join", roomId: "r", userId: "a", metadata: {} }));
    await waitFor(a, "join:ack");

    // b sends a cursor move but never joins. After the buffer window, a late
    // join carrying no prior cursor should not replay the stale position.
    const b = await connect();
    b.send(JSON.stringify({ type: "cursor:move", roomId: "r", position: { x: 0.9, y: 0.9 } }));

    const sawStale = new Promise<boolean>((resolve) => {
      a.on("message", (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "cursor:updated") resolve(true);
      });
      setTimeout(() => resolve(false), 700);
    });

    expect(await sawStale).toBe(false);

    a.close();
    b.close();
  });

  it("accepts a join with a valid api key when keys are configured", async () => {
    const s = new FlockServer({ port: PORT + 1, logger: false, apiKeys: ["secret"] });
    await s.start();
    const ws = await connect();
    // use the wrong port to avoid the existing server; connect to s instead
    ws.close();

    const ws2 = new WebSocket(`ws://localhost:${PORT + 1}`);
    const ack = await new Promise<Record<string, unknown>>((resolve, reject) => {
      ws2.on("open", () => {
        ws2.send(JSON.stringify({ type: "join", roomId: "r", userId: "a", metadata: {}, apiKey: "secret" }));
      });
      ws2.on("message", (d: Buffer) => {
        const msg = JSON.parse(d.toString()) as Record<string, unknown>;
        resolve(msg);
      });
      ws2.on("error", reject);
    });

    expect(ack.type).toBe("join:ack");
    ws2.close();
    await s.stop();
  });

  it("rejects a join with a bad api key and closes the socket", async () => {
    const s = new FlockServer({ port: PORT + 2, logger: false, apiKeys: ["secret"] });
    await s.start();

    const ws = new WebSocket(`ws://localhost:${PORT + 2}`);
    const result = await new Promise<{ type: string; closed: boolean }>((resolve) => {
      let type = "";
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "join", roomId: "r", userId: "a", metadata: {}, apiKey: "wrong" }));
      });
      ws.on("message", (d: Buffer) => {
        type = (JSON.parse(d.toString()) as Record<string, unknown>).type as string;
      });
      ws.on("close", () => resolve({ type, closed: true }));
    });

    expect(result.type).toBe("error");
    expect(result.closed).toBe(true);
    await s.stop();
  });

  it("accepts any join when no api keys are configured", async () => {
    const a = await connect();
    a.send(JSON.stringify({ type: "join", roomId: "r", userId: "a", metadata: {} }));
    const ack = await waitFor(a, "join:ack");
    expect(ack.type).toBe("join:ack");
    a.close();
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
