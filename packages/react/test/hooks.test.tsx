import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, cleanup, screen, waitFor } from "@testing-library/react";
import { FlockProvider } from "../src/provider.js";
import { useCursors } from "../src/hooks/useCursors.js";
import { usePresence } from "../src/hooks/usePresence.js";
import { startMockServer, type MockServer } from "./mock-server.js";

let server: MockServer;

beforeEach(async () => {
  server = await startMockServer();
});

afterEach(async () => {
  cleanup();
  await server.close();
});

function Provider({ children }: { children: React.ReactNode }) {
  return (
    <FlockProvider serverUrl={server.url} roomId="r" userId="me">
      {children}
    </FlockProvider>
  );
}

describe("FlockProvider", () => {
  it("renders its children without errors", () => {
    render(
      <Provider>
        <div>hello</div>
      </Provider>,
    );
    expect(screen.getByText("hello")).toBeDefined();
  });
});

describe("usePresence", () => {
  function PresenceList() {
    const users = usePresence();
    return (
      <ul>
        {users.map((u) => (
          <li key={u.userId}>{u.userId}</li>
        ))}
      </ul>
    );
  }

  it("adds a user when the server says one joined", async () => {
    render(
      <Provider>
        <PresenceList />
      </Provider>,
    );

    await server.waitForJoin();
    server.push({ type: "user:joined", roomId: "r", userId: "alice", metadata: { name: "Alice" } });

    await waitFor(() => expect(screen.getByText("alice")).toBeDefined());
  });

  it("removes a user when the server says one left", async () => {
    render(
      <Provider>
        <PresenceList />
      </Provider>,
    );

    await server.waitForJoin();
    server.push({ type: "user:joined", roomId: "r", userId: "bob", metadata: {} });
    await waitFor(() => expect(screen.getByText("bob")).toBeDefined());

    server.push({ type: "user:left", roomId: "r", userId: "bob" });
    await waitFor(() => expect(screen.queryByText("bob")).toBeNull());
  });
});

describe("useCursors", () => {
  function CursorList() {
    const cursors = useCursors();
    return (
      <ul>
        {Object.values(cursors).map((c) => (
          <li key={c.userId}>{`${c.userId}:${c.position.x},${c.position.y}`}</li>
        ))}
      </ul>
    );
  }

  it("tracks a cursor position from the server", async () => {
    render(
      <Provider>
        <CursorList />
      </Provider>,
    );

    await server.waitForJoin();
    server.push({
      type: "cursor:updated",
      roomId: "r",
      userId: "alice",
      position: { x: 0.25, y: 0.75 },
      timestamp: Date.now(),
    });

    await waitFor(() => expect(screen.getByText("alice:0.25,0.75")).toBeDefined());
  });

  it("drops a cursor when the user leaves", async () => {
    render(
      <Provider>
        <CursorList />
      </Provider>,
    );

    await server.waitForJoin();
    server.push({
      type: "cursor:updated",
      roomId: "r",
      userId: "alice",
      position: { x: 0.5, y: 0.5 },
      timestamp: Date.now(),
    });
    await waitFor(() => expect(screen.getByText("alice:0.5,0.5")).toBeDefined());

    server.push({ type: "user:left", roomId: "r", userId: "alice" });
    await waitFor(() => expect(screen.queryByText(/alice/)).toBeNull());
  });
});
