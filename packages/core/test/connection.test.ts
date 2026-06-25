import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Connection } from "../src/connection.js";

// A minimal fake WebSocket we can drive by hand: it records sent frames and
// lets the test fire open/message/close events. Stands in for the browser's
// WebSocket, which doesn't exist in the node test environment.
class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  CONNECTING = 0;
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;

  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  private listeners: Record<string, Array<(ev: unknown) => void>> = {};

  constructor(public url: string) {
    instances.push(this);
  }

  addEventListener(type: string, handler: (ev: unknown) => void): void {
    (this.listeners[type] ??= []).push(handler);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close", {});
  }

  // Test helpers.
  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open", {});
  }

  receive(msg: unknown): void {
    this.emit("message", { data: JSON.stringify(msg) });
  }

  private emit(type: string, ev: unknown): void {
    for (const h of this.listeners[type] ?? []) h(ev);
  }
}

let instances: FakeWebSocket[] = [];
const originalWebSocket = globalThis.WebSocket;

beforeEach(() => {
  instances = [];
  (globalThis as { WebSocket: unknown }).WebSocket = FakeWebSocket;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  (globalThis as { WebSocket: unknown }).WebSocket = originalWebSocket;
});

function sentTypes(ws: FakeWebSocket): string[] {
  return ws.sent.map((s) => JSON.parse(s).type);
}

describe("Connection heartbeat", () => {
  it("sends a heartbeat for each room at the configured interval", () => {
    const conn = new Connection("ws://x", {
      heartbeatIntervalMs: 1000,
      getRoomIds: () => ["r1", "r2"],
    });
    conn.connect();
    instances[0]!.open();

    expect(sentTypes(instances[0]!)).toEqual([]);

    vi.advanceTimersByTime(1000);
    const beats = instances[0]!.sent.map((s) => JSON.parse(s));
    expect(beats).toEqual([
      { type: "heartbeat", roomId: "r1" },
      { type: "heartbeat", roomId: "r2" },
    ]);

    vi.advanceTimersByTime(1000);
    expect(sentTypes(instances[0]!).filter((t) => t === "heartbeat")).toHaveLength(4);
  });

  it("stops sending heartbeats once the socket closes", () => {
    const conn = new Connection("ws://x", {
      heartbeatIntervalMs: 1000,
      getRoomIds: () => ["r1"],
    });
    conn.connect();
    instances[0]!.open();
    vi.advanceTimersByTime(1000);
    expect(sentTypes(instances[0]!).filter((t) => t === "heartbeat")).toHaveLength(1);

    instances[0]!.close();
    vi.advanceTimersByTime(5000);
    expect(sentTypes(instances[0]!).filter((t) => t === "heartbeat")).toHaveLength(1);
  });

  it("fires onStale when the server stops acking heartbeats", () => {
    const conn = new Connection("ws://x", {
      heartbeatIntervalMs: 1000,
      getRoomIds: () => ["r1"],
    });
    const stale = vi.fn();
    conn.onStale(stale);
    conn.connect();
    instances[0]!.open();

    // No ack ever arrives. After 2x the interval the connection is stale.
    vi.advanceTimersByTime(2000);
    expect(stale).toHaveBeenCalledTimes(1);
  });

  it("rearms the stale timer on each heartbeat ack", () => {
    const conn = new Connection("ws://x", {
      heartbeatIntervalMs: 1000,
      getRoomIds: () => ["r1"],
    });
    const stale = vi.fn();
    conn.onStale(stale);
    conn.connect();
    instances[0]!.open();

    vi.advanceTimersByTime(1500);
    instances[0]!.receive({ type: "heartbeat:ack" });
    // The ack pushed the stale deadline out, so it shouldn't fire at the old time.
    vi.advanceTimersByTime(1500);
    expect(stale).not.toHaveBeenCalled();

    // But with no further ack, it eventually goes stale.
    vi.advanceTimersByTime(1000);
    expect(stale).toHaveBeenCalledTimes(1);
  });
});
