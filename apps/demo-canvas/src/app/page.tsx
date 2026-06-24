"use client";

import { useMemo } from "react";
import { FlockProvider } from "@flock-sdk/react";
import { Canvas } from "@/components/Canvas";
import { PresenceBar } from "@/components/PresenceBar";

const SERVER_URL =
  process.env.NEXT_PUBLIC_FLOCK_SERVER_URL ?? "ws://localhost:8787";

const NAMES = ["Otter", "Falcon", "Heron", "Marten", "Vixen", "Lynx", "Crane", "Wren"];
const COLORS = ["#7c5cff", "#ff7ab6", "#3ad6c2", "#ffb454", "#5ca8ff", "#9ae66e"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
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

  return (
    <FlockProvider
      serverUrl={SERVER_URL}
      roomId="canvas-demo"
      userId={me.userId}
      metadata={{ name: me.name, color: me.color }}
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
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Flock canvas</h1>
            <p style={{ fontSize: 13, color: "#9aa0aa", marginTop: 2 }}>
              Open this page in two windows and move your mouse over the canvas.
            </p>
          </div>
          <PresenceBar me={{ name: me.name, color: me.color }} />
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
    </FlockProvider>
  );
}
