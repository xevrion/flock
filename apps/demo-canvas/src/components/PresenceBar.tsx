// Shows who is currently in the room as a row of colored initials. The local
// user is passed in separately since the SDK's presence list only includes the
// other people in the room.

"use client";

import { usePresence } from "@xevrion/flock-react";

interface PresenceBarProps {
  me: { name: string; color: string };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function Avatar({ name, color, you }: { name: string; color: string; you?: boolean }) {
  return (
    <div
      title={you ? `${name} (you)` : name}
      style={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        background: color,
        color: "#0b0d11",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11.5,
        fontWeight: 700,
        // Ring in the page background so overlapping avatars read as separate
        // discs; the local user gets a faint accent ring to stand out.
        boxShadow: you
          ? "0 0 0 2px var(--bg), 0 0 0 3px var(--accent)"
          : "0 0 0 2px var(--bg)",
        marginLeft: -7,
        position: "relative",
      }}
    >
      {initials(name)}
    </div>
  );
}

export function PresenceBar({ me }: PresenceBarProps) {
  const others = usePresence();
  const count = others.length + 1;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <div style={{ display: "flex", paddingLeft: 7 }}>
        <Avatar name={me.name} color={me.color} you />
        {others.map((u) => (
          <Avatar
            key={u.userId}
            name={(u.metadata.name as string) ?? u.userId}
            color={(u.metadata.color as string) ?? "#888"}
          />
        ))}
      </div>
      <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        {count} {count === 1 ? "person" : "people"}
      </span>
    </div>
  );
}
