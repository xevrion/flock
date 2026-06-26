"use client";

import { FlockProvider, useCursors, usePresence, useConnectionStatus } from "@xevrion/flock-react";
import { useEffect, useRef, useState } from "react";

const SERVER_URL = process.env.NEXT_PUBLIC_FLOCK_SERVER_URL ?? "";

function randomId() {
  return Math.random().toString(36).slice(2, 9);
}

const COLORS = [
  "#7c5cff", "#ff5c87", "#ff9f5c", "#5cdfff",
  "#5cff9f", "#ff5cdf", "#ffdf5c",
];

function colorForId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xfffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

function DemoInner() {
  const cursors = useCursors();
  const users = usePresence();
  const status = useConnectionStatus();
  const areaRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ fontFamily: "inherit" }}>
      <div
        ref={areaRef}
        style={{
          position: "relative",
          height: 220,
          border: "1px solid #333",
          borderRadius: 8,
          background: "#0d0d0d",
          overflow: "hidden",
          cursor: "none",
          userSelect: "none",
        }}
      >
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#444",
          fontSize: 13,
          pointerEvents: "none",
        }}>
          {status === "connected"
            ? "Move your mouse in here"
            : status === "connecting" || status === "reconnecting"
            ? "Connecting..."
            : "Server not available — start it locally with: npx @xevrion/flock-server"}
        </div>

        {Object.values(cursors).map((cursor) => {
          if (cursor.position.x < 0 || cursor.position.y < 0) return null;
          return (
            <div
              key={cursor.userId}
              style={{
                position: "absolute",
                left: `${cursor.position.x * 100}%`,
                top: `${cursor.position.y * 100}%`,
                pointerEvents: "none",
                transform: "translate(-2px, -2px)",
              }}
            >
              <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
                <path
                  d="M0 0L0 14L4 10L7 16L9 15L6 9L11 9Z"
                  fill={cursor.metadata.color as string ?? "#fff"}
                  stroke="#000"
                  strokeWidth="0.8"
                />
              </svg>
              <span style={{
                position: "absolute",
                left: 14,
                top: 0,
                background: cursor.metadata.color as string ?? "#fff",
                color: "#000",
                fontSize: 11,
                fontWeight: 600,
                padding: "1px 5px",
                borderRadius: 3,
                whiteSpace: "nowrap",
              }}>
                {cursor.metadata.name as string ?? cursor.userId}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#888" }}>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: status === "connected" ? "#22c55e" : status === "reconnecting" || status === "connecting" ? "#eab308" : "#ef4444",
          display: "inline-block",
        }} />
        <span>{status}</span>
        {users.length > 0 && (
          <span style={{ marginLeft: "auto" }}>
            {users.length} other{users.length !== 1 ? "s" : ""} here
          </span>
        )}
      </div>
    </div>
  );
}

export function LiveDemo() {
  const [userId] = useState(() => randomId());
  const [color] = useState(() => colorForId(Math.random().toString()));

  if (!SERVER_URL) {
    return (
      <div style={{
        padding: "16px",
        border: "1px solid #333",
        borderRadius: 8,
        background: "#0d0d0d",
        color: "#888",
        fontSize: 13,
      }}>
        <strong style={{ color: "#fff" }}>Live demo not configured.</strong>
        {" "}Start the server locally with{" "}
        <code style={{ background: "#1a1a1a", padding: "1px 4px", borderRadius: 3 }}>
          npx @xevrion/flock-server
        </code>{" "}
        and set{" "}
        <code style={{ background: "#1a1a1a", padding: "1px 4px", borderRadius: 3 }}>
          NEXT_PUBLIC_FLOCK_SERVER_URL=ws://localhost:8787
        </code>{" "}
        in <code style={{ background: "#1a1a1a", padding: "1px 4px", borderRadius: 3 }}>apps/docs/.env.local</code>.
      </div>
    );
  }

  return (
    <FlockProvider
      serverUrl={SERVER_URL}
      roomId="docs-live-demo"
      userId={userId}
      metadata={{ name: "Visitor", color }}
      reconnect={{ maxAttempts: 5 }}
    >
      <DemoInner />
    </FlockProvider>
  );
}
