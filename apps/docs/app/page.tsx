import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        gap: "1.5rem",
      }}
    >
      <h1 style={{ fontSize: "3rem", fontWeight: 700, margin: 0 }}>Flock</h1>
      <p
        style={{
          fontSize: "1.25rem",
          color: "#666",
          maxWidth: "480px",
          margin: 0,
        }}
      >
        Self-hostable, open-source SDK for live cursors and multiplayer
        presence. Add real-time awareness to any web app in under 10 lines.
      </p>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/docs"
          style={{
            padding: "0.6rem 1.4rem",
            background: "#111",
            color: "#fff",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          Get Started
        </Link>
        <a
          href="https://github.com/xevrion/flock"
          style={{
            padding: "0.6rem 1.4rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            textDecoration: "none",
            color: "#111",
            fontWeight: 500,
          }}
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </div>

      <pre
        style={{
          background: "#f5f5f5",
          padding: "1rem 1.5rem",
          borderRadius: "8px",
          fontSize: "0.9rem",
          textAlign: "left",
          color: "#333",
        }}
      >
        {`npm install @flock-sdk/react
npx @flock-sdk/server`}
      </pre>

      <p style={{ color: "#999", fontSize: "0.85rem", margin: 0 }}>
        MIT license · Self-hostable · No per-seat pricing
      </p>
    </main>
  );
}
