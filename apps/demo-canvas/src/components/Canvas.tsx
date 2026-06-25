// The shared drawing surface. It tracks the mouse relative to the canvas
// element (not the viewport), normalizes that to 0-1 within the canvas bounds,
// and sends it as the local cursor position. Everyone else's cursors are drawn
// as an absolutely positioned overlay on top of the canvas at their normalized
// spots.

"use client";

import { useEffect, useRef } from "react";
import { useCursors, useRoom } from "@flock-sdk/react";
import { Cursor } from "./Cursor";

export function Canvas() {
  const room = useRoom();
  const cursors = useCursors();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Keep the backing canvas sized to its container so the dot grid stays crisp
  // and fills the surface.
  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    if (!canvas || !surface) return;

    const draw = () => {
      const rect = surface.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = "#262b34";
      const gap = 28;
      for (let gx = gap; gx < rect.width; gx += gap) {
        for (let gy = gap; gy < rect.height; gy += gap) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(surface);
    return () => ro.disconnect();
  }, []);

  function handleMove(e: React.MouseEvent) {
    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    // The position is already normalized to the canvas, so skip the SDK's own
    // viewport normalization and send it straight through.
    room.updateCursor({ x, y });
  }

  function handleLeave() {
    room.updateCursor({ x: -1, y: -1 });
  }

  return (
    <div
      ref={surfaceRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: "crosshair",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      {Object.values(cursors)
        .filter((c) => c.position.x >= 0 && c.position.y >= 0)
        .map((c) => (
          <Cursor
            key={c.userId}
            x={c.position.x}
            y={c.position.y}
            name={(c.metadata.name as string) ?? c.userId}
            color={(c.metadata.color as string) ?? "#888"}
          />
        ))}
    </div>
  );
}
