"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import {
  IconBrandGithub,
  IconServer,
  IconBolt,
  IconLock,
  IconArrowRight,
  IconTerminal2,
  IconRefresh,
} from "@tabler/icons-react";

// Animated canvas showing fake live cursors moving around
function LiveCursorCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    function resize() {
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx!.scale(dpr, dpr);
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    type Cursor = {
      name: string;
      color: string;
      x: number;
      y: number;
      tx: number;
      ty: number;
    };

    const cursors: Cursor[] = [
      { name: "Alice", color: "#a78bfa", x: 0.18, y: 0.28, tx: 0.52, ty: 0.42 },
      { name: "Marcus", color: "#34d399", x: 0.72, y: 0.62, tx: 0.28, ty: 0.22 },
      { name: "Priya", color: "#f472b6", x: 0.55, y: 0.78, tx: 0.78, ty: 0.38 },
      { name: "Kai", color: "#fb923c", x: 0.84, y: 0.18, tx: 0.15, ty: 0.68 },
    ];

    let frame = 0;
    let raf: number;

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }

    function drawCursor(px: number, py: number, name: string, color: string) {
      // Arrow path
      ctx!.save();
      ctx!.fillStyle = color;
      ctx!.beginPath();
      ctx!.moveTo(px, py);
      ctx!.lineTo(px + 8, py + 14);
      ctx!.lineTo(px + 3.5, py + 11);
      ctx!.lineTo(px + 2, py + 17);
      ctx!.lineTo(px - 0.5, py + 15);
      ctx!.lineTo(px + 1, py + 10);
      ctx!.lineTo(px - 4, py + 9);
      ctx!.closePath();
      ctx!.fill();

      // Name pill
      ctx!.font = "500 11px system-ui, -apple-system, sans-serif";
      const tw = ctx!.measureText(name).width;
      const lx = px + 11;
      const ly = py + 19;
      ctx!.fillStyle = color;
      ctx!.beginPath();
      (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
        .roundRect(lx - 3, ly - 11, tw + 8, 16, 4);
      ctx!.fill();
      ctx!.fillStyle = "#0a0a0a";
      ctx!.fillText(name, lx + 1, ly);
      ctx!.restore();
    }

    function tick() {
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      ctx!.clearRect(0, 0, r.width, r.height);

      frame++;
      if (frame % 160 === 0) {
        for (const c of cursors) {
          c.tx = 0.08 + Math.random() * 0.84;
          c.ty = 0.08 + Math.random() * 0.84;
        }
      }

      for (const c of cursors) {
        c.x = lerp(c.x, c.tx, 0.025);
        c.y = lerp(c.y, c.ty, 0.025);
        drawCursor(c.x * r.width, c.y * r.height, c.name, c.color);
      }

      raf = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

const snippet = `import { FlockProvider, useCursors } from "@xevrion/flock-react";

function Cursors() {
  const cursors = useCursors();
  return Object.values(cursors).map((c) => (
    <Cursor key={c.userId} position={c.position}
            name={c.metadata.name} color={c.metadata.color} />
  ));
}

export default function App() {
  return (
    <FlockProvider
      serverUrl="wss://your-server.com"
      roomId="my-room" userId={userId}
      metadata={{ name: "Alice", color: "#a78bfa" }}>
      <Cursors />
    </FlockProvider>
  );
}`;

function CodeBlock() {
  const [copied, setCopied] = useState(false);

  const tokens = snippet.split(/(\b(?:import|from|export|default|function|return|const)\b|"[^"]*"|\/\/.*)/).map((part, i) => {
    if (/^(import|from|export|default|function|return|const)$/.test(part))
      return <span key={i} style={{ color: "#c084fc" }}>{part}</span>;
    if (/^"/.test(part))
      return <span key={i} style={{ color: "#86efac" }}>{part}</span>;
    if (/^\/\//.test(part))
      return <span key={i} style={{ color: "#6b7280" }}>{part}</span>;
    return <span key={i}>{part}</span>;
  });

  return (
    <div style={{
      background: "#0d0d0d",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f56", display: "block" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e", display: "block" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#27c840", display: "block" }} />
        </div>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
          App.tsx
        </span>
        <button
          onClick={() => { navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 5,
            color: "rgba(255,255,255,0.5)",
            fontSize: 11,
            padding: "3px 8px",
            cursor: "pointer",
            transition: "color 0.15s",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre style={{
        margin: 0,
        padding: "20px 24px",
        fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
        fontSize: 12.5,
        lineHeight: 1.75,
        color: "#d4d4d4",
        overflowX: "auto",
      }}>
        {tokens}
      </pre>
    </div>
  );
}

const features = [
  {
    icon: <IconServer size={18} stroke={1.5} />,
    title: "Self-hostable",
    body: "Run on your own infrastructure via Docker or npx. No data leaves your servers, no vendor lock-in.",
  },
  {
    icon: <IconBolt size={18} stroke={1.5} />,
    title: "Under 10 lines",
    body: "FlockProvider wraps your app. useCursors() and usePresence() give you the data. That's the whole API.",
  },
  {
    icon: <IconRefresh size={18} stroke={1.5} />,
    title: "Auto-reconnection",
    body: "Exponential backoff reconnect, TTL-based presence eviction, silent state recovery. Works without thinking.",
  },
  {
    icon: <IconLock size={18} stroke={1.5} />,
    title: "MIT license",
    body: "No connection caps, no per-seat pricing, no paused apps when you exceed a free tier. Open source forever.",
  },
  {
    icon: <IconTerminal2 size={18} stroke={1.5} />,
    title: "~6KB gzipped",
    body: "Core under 10KB, React adapter under 5KB on top. Tree-shakeable. No heavy runtime dependencies.",
  },
  {
    icon: <IconBrandGithub size={18} stroke={1.5} />,
    title: "Redis pub/sub",
    body: "Multiple server instances share room state via Redis channels. Scale horizontally with zero config changes.",
  },
];

export default function HomePage() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        .page {
          background: #080808;
          color: #d4d4d4;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          min-height: 100dvh;
          overflow-x: hidden;
        }

        /* NAV */
        .nav {
          position: sticky; top: 0; z-index: 40;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 2rem; height: 60px;
          background: rgba(8,8,8,0.9);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .nav-logo {
          font-size: 1rem; font-weight: 700; color: #fff;
          text-decoration: none; letter-spacing: -0.02em;
        }
        .nav-right { display: flex; align-items: center; gap: 2px; }
        .nav-link {
          padding: 6px 12px; color: rgba(255,255,255,0.5);
          text-decoration: none; font-size: 0.875rem; border-radius: 6px;
          transition: color 0.15s, background 0.15s;
        }
        .nav-link:hover { color: #fff; background: rgba(255,255,255,0.06); }
        .nav-btn {
          margin-left: 8px;
          padding: 6px 14px;
          background: #fff; color: #080808;
          border-radius: 6px; font-size: 0.875rem; font-weight: 500;
          text-decoration: none; transition: opacity 0.15s;
        }
        .nav-btn:hover { opacity: 0.88; }

        /* HERO - asymmetric split */
        .hero {
          display: grid;
          grid-template-columns: 1fr 1fr;
          min-height: calc(100dvh - 60px);
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 2rem;
          gap: 3rem;
          align-items: center;
        }
        .hero-left { padding: 4rem 0; }
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 0.75rem; font-weight: 500; color: rgba(255,255,255,0.35);
          letter-spacing: 0.06em; text-transform: uppercase;
          margin-bottom: 1.75rem;
        }
        .hero-eyebrow-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #a78bfa;
          animation: blink 2.4s ease-in-out infinite;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        .hero-h1 {
          font-size: clamp(2.25rem, 4.5vw, 3.75rem);
          font-weight: 800; line-height: 1.06;
          letter-spacing: -0.04em; color: #fff;
          margin-bottom: 1.25rem;
        }
        .hero-h1-line2 { color: #a78bfa; }
        .hero-sub {
          font-size: 1.0625rem; line-height: 1.65;
          color: rgba(255,255,255,0.45);
          max-width: 400px; margin-bottom: 2.5rem;
        }
        .hero-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .btn-primary {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 10px 20px;
          background: #fff; color: #080808;
          border-radius: 8px; font-size: 0.9375rem; font-weight: 600;
          text-decoration: none;
          transition: opacity 0.15s, transform 0.15s;
        }
        .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-ghost {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 10px 20px;
          border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.75);
          border-radius: 8px; font-size: 0.9375rem; font-weight: 500;
          text-decoration: none;
          transition: border-color 0.15s, background 0.15s, transform 0.15s;
        }
        .btn-ghost:hover {
          border-color: rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.04);
          transform: translateY(-1px);
        }

        /* HERO RIGHT - canvas preview */
        .hero-right {
          position: relative;
          height: 480px;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.07);
          background: #0c0c0c;
        }
        .hero-canvas-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 36px 36px;
        }
        .hero-canvas-bar {
          position: absolute; top: 0; left: 0; right: 0;
          height: 38px;
          background: rgba(12,12,12,0.95);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; padding: 0 14px; gap: 8px;
        }
        .canvas-dot { width: 10px; height: 10px; border-radius: 50%; }
        .canvas-label {
          margin-left: 6px;
          font-family: ui-monospace, monospace;
          font-size: 11px; color: rgba(255,255,255,0.25);
        }
        .hero-canvas-wrap {
          position: absolute;
          top: 38px; left: 0; right: 0; bottom: 0;
        }
        .hero-presence-pill {
          position: absolute; bottom: 16px; right: 16px;
          display: flex; align-items: center; gap: 8px;
          padding: 6px 12px;
          background: rgba(12,12,12,0.9);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 99px;
          font-size: 12px; color: rgba(255,255,255,0.5);
          backdrop-filter: blur(8px);
        }
        .presence-dots { display: flex; gap: -3px; }
        .presence-dot {
          width: 20px; height: 20px; border-radius: 50%;
          border: 2px solid #0c0c0c;
          margin-left: -4px; font-size: 9px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          color: #0a0a0a;
        }

        /* INSTALL STRIP */
        .install-strip {
          border-top: 1px solid rgba(255,255,255,0.05);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding: 14px 2rem;
          display: flex; align-items: center; justify-content: center;
          gap: 2rem;
        }
        .install-cmd {
          display: flex; align-items: center; gap: 10px;
          font-family: ui-monospace, "SF Mono", monospace;
          font-size: 0.8125rem;
        }
        .install-dollar { color: rgba(255,255,255,0.2); }
        .install-text { color: rgba(255,255,255,0.6); }
        .install-divider {
          width: 1px; height: 18px;
          background: rgba(255,255,255,0.08);
        }

        /* CODE + FEATURE SPLIT SECTION */
        .code-section {
          max-width: 1280px; margin: 0 auto;
          padding: 6rem 2rem;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4rem; align-items: start;
        }
        .code-left h2 {
          font-size: clamp(1.75rem, 3vw, 2.5rem);
          font-weight: 700; letter-spacing: -0.03em;
          color: #fff; margin-bottom: 1rem; line-height: 1.15;
        }
        .code-left p {
          font-size: 0.9375rem; line-height: 1.65;
          color: rgba(255,255,255,0.4);
          margin-bottom: 2rem; max-width: 360px;
        }
        .code-links { display: flex; gap: 12px; align-items: center; }
        .code-link-primary {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 0.875rem; font-weight: 500;
          color: #a78bfa; text-decoration: none;
          transition: gap 0.15s;
        }
        .code-link-primary:hover { gap: 8px; }
        .code-link-secondary {
          font-size: 0.875rem; color: rgba(255,255,255,0.3);
          text-decoration: none;
          transition: color 0.15s;
        }
        .code-link-secondary:hover { color: rgba(255,255,255,0.6); }

        /* FEATURES GRID */
        .features-section {
          border-top: 1px solid rgba(255,255,255,0.05);
          padding: 6rem 2rem;
          max-width: 1280px; margin: 0 auto;
        }
        .features-header {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 2rem; align-items: end;
          margin-bottom: 3.5rem;
        }
        .features-header h2 {
          font-size: clamp(1.75rem, 3vw, 2.5rem);
          font-weight: 700; letter-spacing: -0.03em;
          color: #fff; line-height: 1.15;
        }
        .features-header p {
          font-size: 0.9375rem; line-height: 1.65;
          color: rgba(255,255,255,0.35);
          padding-top: 0.5rem;
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          overflow: hidden;
        }
        .feature-cell {
          padding: 2rem;
          border-right: 1px solid rgba(255,255,255,0.06);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          transition: background 0.2s;
        }
        .feature-cell:hover { background: rgba(255,255,255,0.02); }
        .feature-cell:nth-child(3n) { border-right: none; }
        .feature-cell:nth-child(n+4) { border-bottom: none; }
        .feature-icon {
          width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.4);
          margin-bottom: 1rem;
        }
        .feature-title {
          font-size: 0.9375rem; font-weight: 600;
          color: #fff; margin-bottom: 0.5rem;
        }
        .feature-body {
          font-size: 0.875rem; line-height: 1.6;
          color: rgba(255,255,255,0.4);
        }

        /* COMPARISON */
        .compare-section {
          border-top: 1px solid rgba(255,255,255,0.05);
          padding: 6rem 2rem;
          max-width: 1280px; margin: 0 auto;
          display: grid; grid-template-columns: 1fr 1.4fr;
          gap: 4rem; align-items: start;
        }
        .compare-left h2 {
          font-size: clamp(1.75rem, 3vw, 2.5rem);
          font-weight: 700; letter-spacing: -0.03em;
          color: #fff; margin-bottom: 1rem; line-height: 1.15;
        }
        .compare-left p {
          font-size: 0.9375rem; line-height: 1.65;
          color: rgba(255,255,255,0.4);
        }
        .compare-table {
          width: 100%; border-collapse: collapse;
          font-size: 0.875rem;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          overflow: hidden;
        }
        .compare-table th {
          text-align: left; padding: 12px 16px;
          color: rgba(255,255,255,0.3); font-weight: 500;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          font-size: 0.8125rem;
        }
        .compare-table td {
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.5);
        }
        .compare-table tr:last-child td { border-bottom: none; }
        .compare-table .td-label { color: rgba(255,255,255,0.55); font-weight: 500; }
        .compare-table .td-flock { color: #fff; font-weight: 500; }
        .yes { color: #34d399; }
        .no { color: rgba(255,255,255,0.18); }

        /* CTA */
        .cta-section {
          border-top: 1px solid rgba(255,255,255,0.05);
          padding: 6rem 2rem 7rem;
          text-align: center;
          max-width: 640px; margin: 0 auto;
        }
        .cta-section h2 {
          font-size: clamp(1.75rem, 3.5vw, 2.75rem);
          font-weight: 700; letter-spacing: -0.03em;
          color: #fff; margin-bottom: 1rem;
        }
        .cta-section p {
          font-size: 1rem; line-height: 1.65;
          color: rgba(255,255,255,0.4);
          margin-bottom: 2rem;
        }
        .cta-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

        /* FOOTER */
        .footer {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 1.5rem 2rem;
          display: flex; align-items: center; justify-content: space-between;
          font-size: 0.8125rem; color: rgba(255,255,255,0.25);
        }
        .footer-links { display: flex; gap: 1.5rem; }
        .footer-link { color: rgba(255,255,255,0.25); text-decoration: none; transition: color 0.15s; }
        .footer-link:hover { color: rgba(255,255,255,0.55); }

        @media (max-width: 900px) {
          .hero { grid-template-columns: 1fr; min-height: auto; padding-top: 3rem; padding-bottom: 3rem; }
          .hero-right { height: 320px; }
          .code-section { grid-template-columns: 1fr; }
          .features-grid { grid-template-columns: repeat(2, 1fr); }
          .feature-cell:nth-child(3n) { border-right: 1px solid rgba(255,255,255,0.06); }
          .feature-cell:nth-child(2n) { border-right: none; }
          .compare-section { grid-template-columns: 1fr; }
          .features-header { grid-template-columns: 1fr; }
          .install-strip { gap: 1rem; flex-wrap: wrap; }
        }
        @media (max-width: 600px) {
          .nav-link { display: none; }
          .features-grid { grid-template-columns: 1fr; }
          .feature-cell { border-right: none !important; }
          .footer { flex-direction: column; gap: 1rem; text-align: center; }
        }
      `}</style>

      <div className="page">
        {/* NAV */}
        <nav className="nav">
          <a href="/" className="nav-logo">Flock</a>
          <div className="nav-right">
            <a href="/docs" className="nav-link">Docs</a>
            <a href="/docs/api-reference/core/flock-client" className="nav-link">API</a>
            <a href="https://flock-demo-canvas.vercel.app" className="nav-link" target="_blank" rel="noopener noreferrer">Demo</a>
            <a href="https://github.com/xevrion/flock" className="nav-link" target="_blank" rel="noopener noreferrer">GitHub</a>
            <Link href="/docs" className="nav-btn">Get started</Link>
          </div>
        </nav>

        {/* HERO */}
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="hero">
            <motion.div
              className="hero-left"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="hero-eyebrow">
                <span className="hero-eyebrow-dot" />
                Open source, MIT license
              </div>
              <h1 className="hero-h1">
                Live cursors and<br />
                <span className="hero-h1-line2">multiplayer presence</span><br />
                for any web app
              </h1>
              <p className="hero-sub">
                Self-hostable SDK. Add real-time cursors and who's online in under 10 lines of React.
                No connection caps. No per-seat pricing.
              </p>
              <div className="hero-actions">
                <Link href="/docs" className="btn-primary">
                  Read the docs <IconArrowRight size={15} stroke={2} />
                </Link>
                <a href="https://flock-demo-canvas.vercel.app" className="btn-ghost" target="_blank" rel="noopener noreferrer">
                  Live demo
                </a>
              </div>
            </motion.div>

            <motion.div
              className="hero-right"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="hero-canvas-grid" />
              <div className="hero-canvas-bar">
                <span className="canvas-dot" style={{ background: "#ff5f56" }} />
                <span className="canvas-dot" style={{ background: "#febc2e" }} />
                <span className="canvas-dot" style={{ background: "#27c840" }} />
                <span className="canvas-label">canvas-room · flock.xevrion.dev</span>
              </div>
              <div className="hero-canvas-wrap">
                <LiveCursorCanvas />
              </div>
              <div className="hero-presence-pill">
                <div className="presence-dots">
                  {[
                    { bg: "#a78bfa", l: "A" },
                    { bg: "#34d399", l: "M" },
                    { bg: "#f472b6", l: "P" },
                    { bg: "#fb923c", l: "K" },
                  ].map((d) => (
                    <span key={d.l} className="presence-dot" style={{ background: d.bg }}>
                      {d.l}
                    </span>
                  ))}
                </div>
                4 online
              </div>
            </motion.div>
          </div>
        </div>

        {/* INSTALL STRIP */}
        <div className="install-strip">
          <div className="install-cmd">
            <span className="install-dollar">$</span>
            <span className="install-text">npm install @xevrion/flock-react</span>
          </div>
          <div className="install-divider" />
          <div className="install-cmd">
            <span className="install-dollar">$</span>
            <span className="install-text">npx @xevrion/flock-server</span>
          </div>
        </div>

        {/* CODE + COPY SPLIT */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="code-section">
            <FadeUp>
              <div className="code-left">
                <h2>Drop it in. It just works.</h2>
                <p>
                  One provider, two hooks. The SDK handles WebSocket lifecycle,
                  reconnection, heartbeats, and cursor interpolation automatically.
                </p>
                <div className="code-links">
                  <Link href="/docs/getting-started/quickstart" className="code-link-primary">
                    Full quickstart <IconArrowRight size={13} stroke={2} />
                  </Link>
                  <a href="https://github.com/xevrion/flock" className="code-link-secondary" target="_blank" rel="noopener noreferrer">
                    View source
                  </a>
                </div>
              </div>
            </FadeUp>
            <FadeUp delay={0.1}>
              <CodeBlock />
            </FadeUp>
          </div>
        </div>

        {/* FEATURES GRID */}
        <div className="features-section">
          <FadeUp>
            <div className="features-header">
              <h2>Everything presence needs.<br />Nothing it doesn't.</h2>
              <p>
                Flock does cursors and who's online, and does them well.
                No CRDT, no comments, no bloat. The smallest thing that makes your app feel multiplayer.
              </p>
            </div>
          </FadeUp>
          <div className="features-grid">
            {features.map((f, i) => (
              <FadeUp key={f.title} delay={i * 0.05}>
                <div className="feature-cell">
                  <div className="feature-icon">{f.icon}</div>
                  <div className="feature-title">{f.title}</div>
                  <div className="feature-body">{f.body}</div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>

        {/* COMPARISON */}
        <div className="compare-section">
          <FadeUp>
            <div className="compare-left">
              <h2>Why not Liveblocks?</h2>
              <p>
                Liveblocks is a great hosted platform. But it can't be self-hosted,
                has connection caps on the free tier, and partial AGPL licensing.
                Flock is the open alternative.
              </p>
            </div>
          </FadeUp>
          <FadeUp delay={0.1}>
            <table className="compare-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Flock</th>
                  <th>Liveblocks</th>
                  <th>DIY</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Self-hostable", "Yes", "No", "Yes"],
                  ["License", "MIT", "Partial AGPL", "—"],
                  ["Connection caps", "None", "10/room free", "None"],
                  ["Per-seat pricing", "None", "Yes", "None"],
                  ["Setup time", "10 lines", "Full onboarding", "Weeks"],
                  ["Bundle size", "~6KB", "Much larger", "—"],
                ].map(([label, flock, lb, diy]) => (
                  <tr key={label}>
                    <td className="td-label">{label}</td>
                    <td className="td-flock">
                      <span className={flock === "Yes" || flock === "None" ? "yes" : ""}>{flock}</span>
                    </td>
                    <td><span className={lb === "No" ? "no" : ""}>{lb}</span></td>
                    <td>{diy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </FadeUp>
        </div>

        {/* CTA */}
        <FadeUp>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
            <div className="cta-section">
              <h2>Ship multiplayer in an afternoon</h2>
              <p>
                Start with the hosted demo server, point your app at it, and have cursors
                working before lunch. Self-host when you're ready.
              </p>
              <div className="cta-actions">
                <Link href="/docs" className="btn-primary">
                  Get started <IconArrowRight size={15} stroke={2} />
                </Link>
                <a href="https://github.com/xevrion/flock" className="btn-ghost" target="_blank" rel="noopener noreferrer">
                  <IconBrandGithub size={15} stroke={1.5} />
                  Star on GitHub
                </a>
              </div>
            </div>
          </div>
        </FadeUp>

        {/* FOOTER */}
        <footer className="footer">
          <span>Flock - MIT license - Yash Bavadiya</span>
          <div className="footer-links">
            <a href="/docs" className="footer-link">Docs</a>
            <a href="https://github.com/xevrion/flock" className="footer-link" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://www.npmjs.com/package/@xevrion/flock-react" className="footer-link" target="_blank" rel="noopener noreferrer">npm</a>
            <a href="https://flock-demo-canvas.vercel.app" className="footer-link" target="_blank" rel="noopener noreferrer">Demo</a>
          </div>
        </footer>
      </div>
    </>
  );
}
