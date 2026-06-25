import { describe, expect, it } from "vitest";
import { Room } from "../src/room.js";
import type { Connection } from "../src/connection.js";
import type { ClientMessage, ServerMessage } from "../src/messages.js";

// A stand-in Connection that just records what the room sends.
function fakeConnection(): { conn: Connection; sent: ClientMessage[] } {
  const sent: ClientMessage[] = [];
  const conn = {
    send: (msg: ClientMessage) => sent.push(msg),
  } as unknown as Connection;
  return { conn, sent };
}

function ack(roomId: string): ServerMessage {
  return { type: "join:ack", roomId, users: [] };
}

describe("Room presence updates", () => {
  it("sends a presence update immediately once joined", () => {
    const { conn, sent } = fakeConnection();
    const room = new Room("r", { userId: "me" }, conn);
    room.join();
    room.handleMessage(ack("r"));

    room.updatePresence({ status: "idle" });

    const updates = sent.filter((m) => m.type === "presence:update");
    expect(updates).toEqual([{ type: "presence:update", roomId: "r", metadata: { status: "idle" } }]);
  });

  it("queues a presence update sent before join:ack and flushes it after", () => {
    const { conn, sent } = fakeConnection();
    const room = new Room("r", { userId: "me" }, conn);
    room.join();

    // Update before the ack arrives: nothing should go out yet.
    room.updatePresence({ status: "away" });
    expect(sent.filter((m) => m.type === "presence:update")).toHaveLength(0);

    // Ack lands: the queued patch is flushed.
    room.handleMessage(ack("r"));
    expect(sent.filter((m) => m.type === "presence:update")).toEqual([
      { type: "presence:update", roomId: "r", metadata: { status: "away" } },
    ]);
  });

  it("merges multiple pre-ack updates into one flushed patch", () => {
    const { conn, sent } = fakeConnection();
    const room = new Room("r", { userId: "me" }, conn);
    room.join();

    room.updatePresence({ status: "away" });
    room.updatePresence({ mood: "focused" });
    room.handleMessage(ack("r"));

    expect(sent.filter((m) => m.type === "presence:update")).toEqual([
      { type: "presence:update", roomId: "r", metadata: { status: "away", mood: "focused" } },
    ]);
  });

  it("merges a presence:updated message into existing metadata", () => {
    const { conn } = fakeConnection();
    const room = new Room("r", { userId: "me" }, conn);
    room.join();
    room.handleMessage({
      type: "join:ack",
      roomId: "r",
      users: [{ userId: "bob", metadata: { name: "Bob", color: "#00f" } }],
    });

    const seen: Array<Record<string, unknown>> = [];
    room.on("presence:update", (_userId, metadata) => seen.push(metadata));

    room.handleMessage({
      type: "presence:updated",
      roomId: "r",
      userId: "bob",
      metadata: { status: "idle" },
    });

    // The color and name survive, status is added.
    expect(room.getPresence().get("bob")?.metadata).toEqual({
      name: "Bob",
      color: "#00f",
      status: "idle",
    });
    expect(seen).toEqual([{ name: "Bob", color: "#00f", status: "idle" }]);
  });
});
