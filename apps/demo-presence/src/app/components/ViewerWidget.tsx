"use client";

import { usePresence, useMyPresence } from "@flock-sdk/react";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ViewerWidget() {
  const others = usePresence();
  const [me] = useMyPresence();

  const all = [
    { userId: "me", metadata: { ...me, name: (me.name ?? "You") + " (you)" } },
    ...others,
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 13, color: "#888", marginRight: 4 }}>
        {others.length + 1} viewing
      </span>
      <div style={{ display: "flex" }}>
        {all.map((user, i) => (
          <div
            key={user.userId}
            title={user.metadata.name as string ?? user.userId}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: user.metadata.color as string ?? "#444",
              border: "2px solid #000",
              marginLeft: i === 0 ? 0 : -8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              zIndex: all.length - i,
              position: "relative",
            }}
          >
            {initials((user.metadata.name as string) ?? user.userId)}
          </div>
        ))}
      </div>
    </div>
  );
}
