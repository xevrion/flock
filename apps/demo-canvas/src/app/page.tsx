"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FlockProvider } from "@xevrion/flock-react";
import { Canvas } from "@/components/Canvas";
import { PresenceBar } from "@/components/PresenceBar";
import { StatusDot } from "@/components/StatusDot";
import { Toaster } from "@/components/Toaster";

const SERVER_URL =
  process.env.NEXT_PUBLIC_FLOCK_SERVER_URL ?? "ws://localhost:8787";

const COLORS = ["#7c5cff", "#ff7ab6", "#3ad6c2", "#ffb454", "#5ca8ff", "#e67e7e", "#9ae66e", "#f0a06a"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomCode(): string {
  return Math.random().toString(36).slice(2, 8);
}

// Name entry screen shown before joining the room
function NameGate({ onJoin }: { onJoin: (name: string, color: string) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(() => pick(COLORS));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onJoin(trimmed, color);
  }

  return (
    <div style={{
      position: "fixed", inset: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)",
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "32px 28px",
        width: 320,
        display: "flex", flexDirection: "column", gap: 20,
      }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", marginBottom: 4 }}>
            What's your name?
          </p>
          <p style={{ fontSize: 13, color: "var(--text-faint)", lineHeight: 1.5 }}>
            Others in the room will see it next to your cursor.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Your name"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: 14,
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => { e.target.style.borderColor = color; }}
            onBlur={(e) => { e.target.style.borderColor = "var(--line)"; }}
          />

          {/* Color picker */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Color</span>
            <div style={{ display: "flex", gap: 6 }}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  title={c}
                  style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: c, border: "none", cursor: "pointer", padding: 0,
                    outline: color === c ? `2px solid ${c}` : "2px solid transparent",
                    outlineOffset: 2,
                    transform: color === c ? "scale(1.15)" : "scale(1)",
                    transition: "transform 0.12s, outline 0.12s",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!name.trim()}
          style={{
            padding: "10px 0",
            borderRadius: 8,
            border: "none",
            background: name.trim() ? color : "var(--line)",
            color: "#fff",
            fontSize: 14, fontWeight: 600,
            cursor: name.trim() ? "pointer" : "not-allowed",
            transition: "background 0.15s, opacity 0.15s",
            opacity: name.trim() ? 1 : 0.5,
          }}
        >
          Join room
        </button>
      </div>
    </div>
  );
}

export default function Page() {
  const userId = useMemo(() => Math.random().toString(36).slice(2, 10), []);
  const [me, setMe] = useState<{ name: string; color: string } | null>(null);
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
  if (!me) return <NameGate onJoin={(name, color) => setMe({ name, color })} />;

  return (
    <FlockProvider
      serverUrl={SERVER_URL}
      roomId={roomId}
      userId={userId}
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
            <h1 style={{ fontSize: 22, fontWeight: 650, letterSpacing: "-0.02em" }}>
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
            Share the room link to invite others.
          </p>
        </div>
      </main>
      <Toaster />
    </FlockProvider>
  );
}

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
