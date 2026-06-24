// Draws a single remote user's cursor at a position normalized to the canvas
// (0-1 on each axis). The pointer shape plus a small label with the user's name
// and color sit at that spot.

interface CursorProps {
  x: number;
  y: number;
  name: string;
  color: string;
}

export function Cursor({ x, y, name, color }: CursorProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        pointerEvents: "none",
        transform: "translate(-2px, -2px)",
        zIndex: 5,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M3 2L16 9.5L9.5 11L7 17L3 2Z"
          fill={color}
          stroke="#0f1115"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      <span
        style={{
          position: "absolute",
          left: 16,
          top: 14,
          padding: "2px 7px",
          borderRadius: 6,
          background: color,
          color: "#0f1115",
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
    </div>
  );
}
