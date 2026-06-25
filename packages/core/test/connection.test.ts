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
    instances[0]!.receive({ type: "heartbeat:ack" });
    const beats = instances[0]!.sent.map((s) => JSON.parse(s));
    expect(beats).toEqual([
      { type: "heartbeat", roomId: "r1" },
      { type: "heartbeat", roomId: "r2" },
    ]);

    vi.advanceTimersByTime(1000);
    instances[0]!.receive({ type: "heartbeat:ack" });
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

describe("Connection reconnection", () => {
  it("reconnects after an unexpected close", () => {
    const conn = new Connection("ws://x", { reconnect: { baseDelayMs: 1000 } });
    const reconnecting = vi.fn();
    conn.onReconnecting(reconnecting);
    conn.connect();
    instances[0]!.open();
    expect(instances).toHaveLength(1);

    // Server drops us.
    instances[0]!.close();
    expect(reconnecting).toHaveBeenCalledWith(1);

    // After the base delay a new socket is opened.
    vi.advanceTimersByTime(1000);
    expect(instances).toHaveLength(2);
  });

  it("doubles the backoff each failed attempt and caps at maxDelayMs", () => {
    const conn = new Connection("ws://x", {
      reconnect: { baseDelayMs: 1000, maxDelayMs: 4000 },
    });
    conn.connect();

    // First socket never opens; its close triggers the backoff sequence.
    instances[0]!.close();
    // attempt 1: 1000ms
    vi.advanceTimersByTime(999);
    expect(instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(instances).toHaveLength(2);

    instances[1]!.close();
    // attempt 2: 2000ms
    vi.advanceTimersByTime(1999);
    expect(instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(instances).toHaveLength(3);

    instances[2]!.close();
    // attempt 3: 4000ms (would be 4000, cap is 4000)
    vi.advanceTimersByTime(3999);
    expect(instances).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(instances).toHaveLength(4);

    instances[3]!.close();
    // attempt 4: still capped at 4000ms
    vi.advanceTimersByTime(4000);
    expect(instances).toHaveLength(5);
  });

  it("resets the backoff after a successful reconnect", () => {
    const conn = new Connection("ws://x", { reconnect: { baseDelayMs: 1000 } });
    conn.connect();

    instances[0]!.close();
    vi.advanceTimersByTime(1000);
    instances[1]!.close();
    vi.advanceTimersByTime(2000);
    // attempt 2 opened socket 3, which now successfully opens.
    instances[2]!.open();

    // A later drop starts the backoff from the base delay again.
    instances[2]!.close();
    vi.advanceTimersByTime(1000);
    expect(instances).toHaveLength(4);
  });

  it("gives up after maxAttempts and reports failure", () => {
    const conn = new Connection("ws://x", {
      reconnect: { baseDelayMs: 1000, maxAttempts: 2 },
    });
    const failed = vi.fn();
    conn.onReconnectFailed(failed);
    conn.connect();

    instances[0]!.close(); // attempt 1
    vi.advanceTimersByTime(1000);
    instances[1]!.close(); // attempt 2
    vi.advanceTimersByTime(2000);
    instances[2]!.close(); // would be attempt 3, but maxAttempts is 2
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it("does not reconnect after a deliberate close", () => {
    const conn = new Connection("ws://x", { reconnect: { baseDelayMs: 1000 } });
    const reconnecting = vi.fn();
    conn.onReconnecting(reconnecting);
    conn.connect();
    instances[0]!.open();

    conn.close();
    vi.advanceTimersByTime(10000);
    expect(reconnecting).not.toHaveBeenCalled();
    expect(instances).toHaveLength(1);
  });
});
