// A quiet pill reflecting the live connection state. Steady accent dot when
// connected, a pulsing amber dot while reconnecting, red when it drops.

"use client";

import { useConnectionStatus } from "@xevrion/flock-react";

const STATES: Record<string, { color: string; label: string; pulse: boolean }> = {
  connected: { color: "var(--accent)", label: "Live", pulse: false },
  connecting: { color: "#d8a33a", label: "Connecting", pulse: true },
  reconnecting: { color: "#d8a33a", label: "Reconnecting", pulse: true },
  disconnected: { color: "#d96565", label: "Offline", pulse: false },
  error: { color: "#d96565", label: "Offline", pulse: false },
};

export function StatusDot() {
  const status = useConnectionStatus();
  const state = STATES[status] ?? STATES.disconnected!;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: 12.5,
        color: "var(--text-muted)",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: state.color,
          animation: state.pulse ? "flock-pulse 1.1s ease-in-out infinite" : "none",
        }}
      />
      {state.label}
      <style>{`
        @keyframes flock-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
