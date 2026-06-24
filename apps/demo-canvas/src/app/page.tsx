"use client";

import { useEffect, useMemo, useState } from "react";
import { FlockProvider } from "@flock-sdk/react";
import { Canvas } from "@/components/Canvas";
import { PresenceBar } from "@/components/PresenceBar";
import { StatusDot } from "@/components/StatusDot";
import { Toaster } from "@/components/Toaster";

const SERVER_URL =
  process.env.NEXT_PUBLIC_FLOCK_SERVER_URL ?? "ws://localhost:8787";

const NAMES = ["Otter", "Falcon", "Heron", "Marten", "Vixen", "Lynx", "Crane", "Wren"];
const COLORS = ["#7c5cff", "#ff7ab6", "#3ad6c2", "#ffb454", "#5ca8ff", "#9ae66e"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomCode(): string {
  return Math.random().toString(36).slice(2, 8);
}

export default function Page() {
  // A fresh identity per tab, decided once on mount so it stays stable for the
  // session. Two tabs get different names and colors so you can tell them apart.
  const me = useMemo(
    () => ({
      userId: Math.random().toString(36).slice(2, 10),
      name: pick(NAMES),
      color: pick(COLORS),
    }),
    [],
  );

  // The room comes from the URL so two people can share a link to the same one.
  // If there is no room in the URL yet, mint one and write it back. Resolved in
  // an effect (not during render) to keep server and client markup in sync.
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let room = params.get("room");
    if (!room) {
      room = randomCode();
      params.set("room", room);
      const url = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, "", url);
    }
    setRoomId(room);
  }, []);

  if (!roomId) return null;

  return (
    <FlockProvider
      serverUrl={SERVER_URL}
      roomId={roomId}
      userId={me.userId}
      metadata={{ name: me.name, color: me.color }}
      cursor={{ throttleMs: 30 }}
      interpolationMs={100}
    >
      <main
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          padding: 20,
          gap: 16,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Flock canvas</h1>
            <p style={{ fontSize: 13, color: "#9aa0aa", marginTop: 2 }}>
              Share this URL to invite someone into room{" "}
              <code style={{ color: "#c7b8ff" }}>{roomId}</code>, then move your
              mouse over the canvas.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 8,
            }}
          >
            <StatusDot />
            <PresenceBar me={{ name: me.name, color: me.color }} />
          </div>
        </header>

        <div
          style={{
            flex: 1,
            borderRadius: 12,
            border: "1px solid #232733",
            background: "#13161d",
            overflow: "hidden",
          }}
        >
          <Canvas />
        </div>
      </main>
      <Toaster />
    </FlockProvider>
  );
}
