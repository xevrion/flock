import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { FlockServer } from "../src/server.js";
import { FlockClient } from "@xevrion/flock-core";

// The core client uses the global WebSocket, which node doesn't provide.
(globalThis as { WebSocket: unknown }).WebSocket = WebSocket;

const PORT = 8802;
const URL = `ws://localhost:${PORT}`;

function startServer(): Promise<FlockServer> {
  const server = new FlockServer({ port: PORT, logger: false });
  return server.start().then(() => server);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("reconnection across a server restart", () => {
  let server: FlockServer | undefined;
  let client: FlockClient | undefined;

  afterEach(async () => {
    if (client) client.destroy();
    if (server) await server.stop();
    client = undefined;
    server = undefined;
  });

  it("transitions connected -> reconnecting -> connected and re-joins", async () => {
    server = await startServer();

    const transitions: string[] = [];
    client = new FlockClient({
      serverUrl: URL,
      reconnect: { baseDelayMs: 200, maxDelayMs: 800 },
    });
    client.onStatusChange((s) => transitions.push(s));
    client.joinRoom("room1", {
      userId: "alice",
      metadata: { name: "Alice", color: "#7c5cff" },
    });

    await wait(300);
    expect(client.status).toBe("connected");

    // Simulate a network drop: stop the server, then bring it back.
    await server.stop();
    await wait(400);
    server = await startServer();

    // Give the client time to reconnect on its backoff and re-join.
    await wait(1500);

    expect(transitions).toContain("reconnecting");
    expect(client.status).toBe("connected");
  }, 15000);

  it("re-joins with the same identity so others see a clean re-join", async () => {
    server = await startServer();

    // A bystander stays connected through the whole test and records who joins.
    const bystander = new WebSocket(URL);
    await new Promise((r) => bystander.on("open", r));
    const joinEvents: Array<{ userId: string; color?: string }> = [];
    bystander.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "user:joined") {
        joinEvents.push({ userId: msg.userId, color: msg.metadata?.color });
      }
    });
    bystander.send(
      JSON.stringify({ type: "join", roomId: "room1", userId: "obs", metadata: {} }),
    );
    await wait(100);

    client = new FlockClient({
      serverUrl: URL,
      reconnect: { baseDelayMs: 200, maxDelayMs: 800 },
    });
    client.joinRoom("room1", {
      userId: "alice",
      metadata: { name: "Alice", color: "#7c5cff" },
    });
    await wait(300);
    expect(joinEvents).toHaveLength(1);

    // Drop and restore the server. The bystander reconnects too (its raw socket
    // closes), so re-open it to keep observing.
    await server.stop();
    await wait(400);
    server = await startServer();

    const reObs = new WebSocket(URL);
    await new Promise((r) => reObs.on("open", r));
    const rejoinEvents: Array<{ userId: string; color?: string }> = [];
    reObs.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "user:joined") {
        rejoinEvents.push({ userId: msg.userId, color: msg.metadata?.color });
      }
    });
    reObs.send(
      JSON.stringify({ type: "join", roomId: "room1", userId: "obs2", metadata: {} }),
    );

    await wait(1500);

    // Alice came back with the same userId and color, not a fresh identity.
    const alice = rejoinEvents.find((e) => e.userId === "alice");
    expect(alice).toBeDefined();
    expect(alice?.color).toBe("#7c5cff");

    bystander.close();
    reObs.close();
  }, 15000);
});
