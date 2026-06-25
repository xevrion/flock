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
          padding: "28px 32px 32px",
          gap: 20,
          maxWidth: 1280,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 650,
                letterSpacing: "-0.02em",
              }}
            >
              Flock
            </h1>
            <RoomCode code={roomId} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <PresenceBar me={{ name: me.name, color: me.color }} />
            <StatusDot />
          </div>
        </header>

        <div
          style={{
            flex: 1,
            borderRadius: "var(--radius)",
            border: "1px solid var(--line)",
            background: "var(--surface)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <Canvas />
          <p
            style={{
              position: "absolute",
              left: 16,
              bottom: 14,
              fontSize: 12,
              color: "var(--text-faint)",
              pointerEvents: "none",
            }}
          >
            Open this room in another tab to see live cursors.
          </p>
        </div>
      </main>
      <Toaster />
    </FlockProvider>
  );
}

// The shareable room id as a copyable monospace chip.
function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(window.location.href).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      },
      () => {},
    );
  }

  return (
    <button
      onClick={copy}
      title="Copy room link"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "4px 10px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--line)",
        background: "var(--surface)",
        color: "var(--text-muted)",
        fontSize: 12.5,
        cursor: "pointer",
        transition: "border-color 150ms, color 150ms",
      }}
    >
      <span style={{ color: "var(--text-faint)" }}>room</span>
      <code style={{ color: "var(--text)" }}>{code}</code>
      <span style={{ color: copied ? "var(--accent)" : "var(--text-faint)" }}>
        {copied ? "copied" : "copy link"}
      </span>
    </button>
  );
}
