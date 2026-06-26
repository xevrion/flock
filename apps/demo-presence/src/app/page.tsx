"use client";

import { FlockProvider } from "@xevrion/flock-react";
import { useMemo } from "react";
import { ViewerWidget } from "./components/ViewerWidget";

const SERVER_URL = process.env.NEXT_PUBLIC_FLOCK_SERVER_URL ?? "ws://localhost:8787";

const COLORS = ["#7c5cff","#ff5c87","#ff9f5c","#5cdfff","#5cff9f","#ffdf5c"];
const NAMES = ["Fox","Owl","Bear","Wolf","Hawk","Elk","Crab","Lynx"];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

export default function Page() {
  const userId = useMemo(() => Math.random().toString(36).slice(2, 9), []);
  const name = useMemo(() => rand(NAMES), []);
  const color = useMemo(() => rand(COLORS), []);

  return (
    <FlockProvider
      serverUrl={SERVER_URL}
      roomId="demo-presence"
      userId={userId}
      metadata={{ name, color }}
    >
      <main style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        gap: 32,
        padding: 24,
      }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Who&apos;s here</h1>
          <p style={{ color: "#888", marginTop: 8, fontSize: 14 }}>
            Open this page in two browser tabs to see presence in action.
          </p>
        </div>

        <ViewerWidget />

        <p style={{ fontSize: 12, color: "#555", marginTop: 16 }}>
          You are <strong style={{ color }}>{name}</strong>
        </p>
      </main>
    </FlockProvider>
  );
}
