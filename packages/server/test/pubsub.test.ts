// Multi-instance cross-server pub/sub tests. Two FlockServer instances share
// the same Redis, so clients connected to different instances can still see
// each other's cursor moves and join/leave events.
//
// These tests require a real Redis at FLOCK_REDIS_URL (or localhost:6379).
// They are skipped automatically if Redis is not reachable.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { Redis } from "ioredis";
import { FlockServer } from "../src/server.js";

const PORT_A = 8791;
const PORT_B = 8792;
const REDIS_URL = process.env.FLOCK_REDIS_URL ?? "redis://localhost:6379";

function connect(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function waitFor(ws: WebSocket, type: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.on("message", (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as Record<string, unknown>;
      if (msg.type === type) resolve(msg);
    });
  });
}

function send(ws: WebSocket, msg: Record<string, unknown>): void {
  ws.send(JSON.stringify(msg));
}

// Probe Redis so tests self-skip on machines without it.
async function redisReachable(): Promise<boolean> {
  const r = new Redis(REDIS_URL, { lazyConnect: true, connectTimeout: 1000 });
  try {
    await r.connect();
    await r.ping();
    return true;
  } catch {
    return false;
  } finally {
    r.disconnect();
  }
}

describe("cross-instance pub/sub", () => {
  let serverA: FlockServer;
  let serverB: FlockServer;

  beforeEach(async () => {
    if (!(await redisReachable())) return;
    serverA = new FlockServer({ port: PORT_A, redisUrl: REDIS_URL, logger: false });
    serverB = new FlockServer({ port: PORT_B, redisUrl: REDIS_URL, logger: false });
    await Promise.all([serverA.start(), serverB.start()]);
    // Give the Redis subscriber connections a moment to handshake.
    await new Promise((r) => setTimeout(r, 50));
  });

  afterEach(async () => {
    await Promise.all([serverA?.stop(), serverB?.stop()]);
  });

  it("relays a cursor move from one instance to a client on the other", async () => {
    if (!(await redisReachable())) {
      console.warn("Redis not available, skipping pub/sub test");
      return;
    }

    // Client A connects to instance A, client B connects to instance B, both
    // join the same room.
    const a = await connect(PORT_A);
    send(a, { type: "join", roomId: "multi-room", userId: "alice", metadata: { name: "Alice" } });
    await waitFor(a, "join:ack");

    const b = await connect(PORT_B);
    // B joins instance B. A (on instance A) should receive user:joined via pubsub.
    const aSeesJoin = waitFor(a, "user:joined");
    send(b, { type: "join", roomId: "multi-room", userId: "bob", metadata: { name: "Bob" } });
    await waitFor(b, "join:ack");

    const joinMsg = await aSeesJoin;
    expect(joinMsg.userId).toBe("bob");

    // Bob moves his cursor. Alice (on a different instance) should receive it.
    const aSeesMove = waitFor(a, "cursor:updated");
    send(b, { type: "cursor:move", roomId: "multi-room", position: { x: 0.4, y: 0.6 } });

    const moveMsg = await aSeesMove;
    expect(moveMsg.userId).toBe("bob");
    expect(moveMsg.position).toEqual({ x: 0.4, y: 0.6 });

    a.close();
    b.close();
  });

  it("relays a presence join and leave across instances", async () => {
    if (!(await redisReachable())) {
      console.warn("Redis not available, skipping pub/sub test");
      return;
    }

    const a = await connect(PORT_A);
    send(a, { type: "join", roomId: "multi-room-2", userId: "alice", metadata: {} });
    await waitFor(a, "join:ack");

    const b = await connect(PORT_B);
    const aSeesJoin = waitFor(a, "user:joined");
    send(b, { type: "join", roomId: "multi-room-2", userId: "bob", metadata: {} });
    await waitFor(b, "join:ack");

    const joinMsg = await aSeesJoin;
    expect(joinMsg.userId).toBe("bob");

    // When bob leaves, alice should be told via pubsub.
    const aSeesLeave = waitFor(a, "user:left");
    b.close();

    const leaveMsg = await aSeesLeave;
    expect(leaveMsg.userId).toBe("bob");

    a.close();
  });
});
