// Listens to the room's join and leave events and shows a brief sliding toast
// for each, so you notice people coming and going without watching the avatar
// bar. Toasts auto-dismiss after a few seconds.

"use client";

import { useEffect, useRef, useState } from "react";
import { useRoom } from "@flock-sdk/react";

interface Toast {
  id: number;
  text: string;
  color: string;
}

const TOAST_MS = 3500;

export function Toaster() {
  const room = useRoom();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const names = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    function push(text: string, color: string) {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, text, color }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_MS);
    }

    const offJoin = room.on("presence:join", (userId, user) => {
      const name = (user.metadata.name as string) ?? userId;
      const color = (user.metadata.color as string) ?? "#7c5cff";
      names.current.set(userId, name);
      push(`${name} joined`, color);
    });

    const offLeave = room.on("presence:leave", (userId) => {
      const name = names.current.get(userId) ?? userId;
      names.current.delete(userId);
      push(`${name} left`, "#9aa0aa");
    });

    return () => {
      offJoin();
      offLeave();
    };
  }, [room]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 8,
            background: "#1b1f27",
            border: "1px solid #2a2f3a",
            color: "#e6e8ec",
            fontSize: 13,
            boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
            animation: "flock-toast-in 180ms ease-out",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: t.color,
            }}
          />
          {t.text}
        </div>
      ))}
      <style>{`
        @keyframes flock-toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
