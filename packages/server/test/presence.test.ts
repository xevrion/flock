import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { Redis } from "ioredis";
import { FlockServer } from "../src/server.js";

const PORT = 8801;
const URL = `ws://localhost:${PORT}`;
const REDIS_URL = process.env.FLOCK_TEST_REDIS_URL ?? "redis://localhost:6379";

// These tests need a real Redis with keyspace notifications. If one isn't
// reachable we skip the whole suite rather than fail, so the rest of the test
// run still works on a machine without Redis.
let redisAvailable = false;

async function checkRedis(): Promise<boolean> {
  const probe = new Redis(REDIS_URL, {
    lazyConnect: true,
    retryStrategy: () => null,
    maxRetriesPerRequest: 1,
  });
  try {
    await probe.connect();
    // Expired-key events require notify-keyspace-events to include Ex. Turn it
    // on for the test so we don't depend on the server's pre-existing config.
    await probe.config("SET", "notify-keyspace-events", "Ex");
    await probe.quit();
    return true;
  } catch {
    probe.disconnect();
    return false;
  }
}

function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function waitFor(ws: WebSocket, type: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === type) resolve(msg);
    });
  });
}

beforeAll(async () => {
  redisAvailable = await checkRedis();
});

describe("presence TTL eviction", () => {
  let server: FlockServer;

  beforeEach(async () => {
    if (!redisAvailable) return;
    server = new FlockServer({
      port: PORT,
      logger: false,
      redisUrl: REDIS_URL,
      presence: { ttlSeconds: 2 },
    });
    await server.start();
  });

  afterEach(async () => {
    if (server) await server.stop();
  });

  it("broadcasts user:left when a presence key expires without a heartbeat", async () => {
    if (!redisAvailable) {
      console.warn("skipping: redis not reachable");
      return;
    }

    const room = `ttl-${Date.now()}`;

    const a = await connect();
    a.send(JSON.stringify({ type: "join", roomId: room, userId: "a", metadata: {} }));
    await waitFor(a, "join:ack");

    // a keeps itself alive with heartbeats so only b is evicted by the TTL.
    const beat = setInterval(() => {
      a.send(JSON.stringify({ type: "heartbeat", roomId: room }));
    }, 500);

    // b joins and then goes silent (never sends a heartbeat), simulating an
    // ungraceful disconnect where the socket stays half-open.
    const b = await connect();
    b.send(JSON.stringify({ type: "join", roomId: room, userId: "b", metadata: {} }));
    await waitFor(b, "join:ack");

    const left = waitFor(a, "user:left");

    const msg = await left;
    expect(msg.userId).toBe("b");

    clearInterval(beat);
    a.close();
    b.close();
  }, 10000);

  it("merges a presence update into the stored metadata hash", async () => {
    if (!redisAvailable) {
      console.warn("skipping: redis not reachable");
      return;
    }

    const room = `meta-${Date.now()}`;
    const redis = new Redis(REDIS_URL);

    const a = await connect();
    a.send(
      JSON.stringify({
        type: "join",
        roomId: room,
        userId: "a",
        metadata: { name: "Alice", color: "#7c5cff" },
      }),
    );
    await waitFor(a, "join:ack");

    a.send(JSON.stringify({ type: "presence:update", roomId: room, metadata: { status: "idle" } }));
    await new Promise((r) => setTimeout(r, 200));

    const raw = await redis.hget(`flock:presence:${room}:a`, "metadata");
    const stored = JSON.parse(raw!);
    // The patch added status without dropping the original name and color.
    expect(stored).toEqual({ name: "Alice", color: "#7c5cff", status: "idle" });

    a.close();
    redis.disconnect();
  }, 10000);
});
