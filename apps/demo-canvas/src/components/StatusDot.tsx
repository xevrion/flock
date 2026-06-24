// A small colored dot reflecting the live connection state: green when
// connected, yellow while connecting or reconnecting, red on error or when
// fully disconnected.

"use client";

import { useConnectionStatus } from "@flock-sdk/react";

const COLORS: Record<string, string> = {
  connected: "#3ad17a",
  connecting: "#ffb454",
  reconnecting: "#ffb454",
  disconnected: "#ff5c5c",
  error: "#ff5c5c",
};

const LABELS: Record<string, string> = {
  connected: "Connected",
  connecting: "Connecting",
  reconnecting: "Reconnecting",
  disconnected: "Disconnected",
  error: "Connection error",
};

export function StatusDot() {
  const status = useConnectionStatus();
  const color = COLORS[status] ?? "#888";

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 7 }}
      title={LABELS[status] ?? status}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      <span style={{ fontSize: 12, color: "#9aa0aa" }}>
        {LABELS[status] ?? status}
      </span>
    </div>
  );
}
