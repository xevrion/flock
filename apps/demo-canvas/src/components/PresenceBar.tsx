// Shows who is currently in the room as a row of colored initials. The local
// user is passed in separately since the SDK's presence list only includes the
// other people in the room.

"use client";

import { usePresence } from "@flock-sdk/react";

interface PresenceBarProps {
  me: { name: string; color: string };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function Avatar({ name, color, ring }: { name: string; color: string; ring?: boolean }) {
  return (
    <div
      title={name}
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: color,
        color: "#0f1115",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 700,
        border: ring ? "2px solid #e6e8ec" : "2px solid transparent",
        marginLeft: -6,
      }}
    >
      {initials(name)}
    </div>
  );
}

export function PresenceBar({ me }: PresenceBarProps) {
  const others = usePresence();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 13, color: "#9aa0aa" }}>
        {others.length + 1} here
      </span>
      <div style={{ display: "flex", paddingLeft: 6 }}>
        <Avatar name={`${me.name} (you)`} color={me.color} ring />
        {others.map((u) => (
          <Avatar
            key={u.userId}
            name={(u.metadata.name as string) ?? u.userId}
            color={(u.metadata.color as string) ?? "#888"}
          />
        ))}
      </div>
    </div>
  );
}
