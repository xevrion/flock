"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";

// Draw a proper cursor arrow like Figma/Liveblocks
function drawCursorArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  name: string
) {
  const s = 1.15;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;

  // White outline stroke
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 1.5*s, y + 13*s);
  ctx.lineTo(x + 4.5*s, y + 9.5*s);
  ctx.lineTo(x + 7.5*s, y + 15.5*s);
  ctx.lineTo(x + 9.5*s, y + 14.5*s);
  ctx.lineTo(x + 6.5*s, y + 8.5*s);
  ctx.lineTo(x + 10.5*s, y + 8*s);
  ctx.closePath();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.stroke();

  // Colored fill
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  // Name pill
  ctx.save();
  ctx.font = "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const tw = ctx.measureText(name).width;
  const padX = 7, padY = 4;
  const pillX = x + 13*s;
  const pillY = y + 14*s;
  const pillW = tw + padX * 2;
  const pillH = 19;

  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  (ctx as unknown as { roundRect: (...a: number[]) => void }).roundRect(pillX, pillY, pillW, pillH, 4);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.fillText(name, pillX + padX, pillY + 13.5);
  ctx.restore();
}

function LiveCursorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
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

    // Keep cursors in the central 60% of the canvas so they're always visible
    const users = [
      { name: "Alice",  color: "#a78bfa", x: 0.25, y: 0.3,  tx: 0.25, ty: 0.3  },
      { name: "Marcus", color: "#34d399", x: 0.62, y: 0.48, tx: 0.62, ty: 0.48 },
      { name: "Priya",  color: "#f472b6", x: 0.38, y: 0.65, tx: 0.38, ty: 0.65 },
      { name: "Kai",    color: "#fb923c", x: 0.7,  y: 0.25, tx: 0.7,  ty: 0.25 },
    ];

    // Waypoints constrained to 20-75% range so cursors stay visible and cluster
    const paths = [
      [[0.22,0.28],[0.55,0.38],[0.3,0.6],[0.48,0.3]],
      [[0.45,0.5 ],[0.28,0.38],[0.65,0.52],[0.5,0.65]],
      [[0.58,0.3 ],[0.38,0.62],[0.52,0.28],[0.3,0.48]],
      [[0.32,0.55],[0.6, 0.42],[0.24,0.35],[0.6,0.6 ]],
    ];

    let frame = 0;
    let pathIdx = 0;
    let raf: number;

    function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

    function tick() {
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      ctx!.clearRect(0, 0, r.width, r.height);

      frame++;
      if (frame % 130 === 0) {
        pathIdx = (pathIdx + 1) % paths.length;
        const wp = paths[pathIdx];
        users.forEach((u, i) => { u.tx = wp[i][0]; u.ty = wp[i][1]; });
      }

      for (const u of users) {
        u.x = lerp(u.x, u.tx, 0.028);
        u.y = lerp(u.y, u.ty, 0.028);
        drawCursorArrow(ctx!, u.x * r.width, u.y * r.height, u.color, u.name);
      }

      raf = requestAnimationFrame(tick);
    }
    tick();

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}

function FadeUp({ children, delay = 0, style = {} }: {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div
      ref={ref}
      style={style}
      initial={{ opacity: 0, y: 18 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

const CODE = `import { FlockProvider, useCursors } from "@xevrion/flock-react";

function Cursors() {
  const cursors = useCursors();
  return Object.values(cursors).map((c) => (
    <Cursor key={c.userId}
      position={c.position}
      name={c.metadata.name}
      color={c.metadata.color} />
  ));
}

export default function App() {
  return (
    <FlockProvider
      serverUrl="wss://your-server.com"
      roomId="my-room"
      userId={userId}
      metadata={{ name: "Alice", color: "#a78bfa" }}>
      <Cursors />
    </FlockProvider>
  );
}`;

type TokType = "kw" | "str" | "cmt" | "plain";
type Tok = { type: TokType; text: string };

function tokenize(code: string): Tok[] {
  const out: Tok[] = [];
  for (const line of code.split("\n")) {
    let s = line;
    while (s.length) {
      const kw = s.match(/^(import|from|export|default|function|return|const|let|var)\b/);
      if (kw) { out.push({ type: "kw", text: kw[0] }); s = s.slice(kw[0].length); continue; }
      const str = s.match(/^("[^"]*"|'[^']*')/);
      if (str) { out.push({ type: "str", text: str[0] }); s = s.slice(str[0].length); continue; }
      const cmt = s.match(/^\/\/.*/);
      if (cmt) { out.push({ type: "cmt", text: cmt[0] }); s = ""; continue; }
      out.push({ type: "plain", text: s[0] }); s = s.slice(1);
    }
    out.push({ type: "plain", text: "\n" });
  }
  return out;
}

function CodeBlock() {
  const [copied, setCopied] = useState(false);
  const toks = tokenize(CODE);
  const colors: Record<TokType, string> = {
    kw: "#c084fc", str: "#86efac", cmt: "#4b5563", plain: "#d1d5db",
  };
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)", background: "#0d0d0d" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", gap: 5 }}>
          {(["#ff5f56","#febc2e","#27c840"] as const).map((c) => (
            <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "block" }} />
          ))}
        </div>
        <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, color: "rgba(255,255,255,0.22)" }}>App.tsx</span>
        <button
          onClick={() => { navigator.clipboard.writeText(CODE); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 5, color: "rgba(255,255,255,0.4)", fontSize: 11, padding: "3px 8px", cursor: "pointer" }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{ margin: 0, padding: "18px 20px", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12.5, lineHeight: 1.75, overflowX: "auto", whiteSpace: "pre" }}>
        {toks.map((t, i) => <span key={i} style={{ color: colors[t.type] }}>{t.text}</span>)}
      </pre>
    </div>
  );
}

const FEATURES = [
  { title: "Self-hostable", body: "Run on your own infrastructure via Docker or npx. No data leaves your servers, no vendor lock-in." },
  { title: "Under 10 lines", body: "FlockProvider wraps your app. useCursors() and usePresence() give you the data. That's the whole API." },
  { title: "Auto-reconnection", body: "Exponential backoff reconnect, TTL-based presence eviction, silent state recovery. Works without thinking." },
  { title: "MIT license", body: "No connection caps, no per-seat pricing, no paused apps when you exceed a free tier. Open source forever." },
  { title: "~6KB gzipped", body: "Core under 10KB, React adapter under 5KB on top. Tree-shakeable. No heavy runtime dependencies." },
  { title: "Redis pub/sub", body: "Multiple server instances share room state via Redis channels. Scale horizontally with zero config changes." },
];

const TABLE_ROWS = [
  ["Self-hostable",   "Yes",     "No",              "Yes"  ],
  ["License",         "MIT",     "Partial AGPL",    "—"    ],
  ["Connection caps", "None",    "10/room free",    "None" ],
  ["Per-seat pricing","None",    "Yes",             "None" ],
  ["Setup time",      "10 lines","Full onboarding", "Weeks"],
  ["Bundle size",     "~6KB",    "Much larger",     "—"    ],
];

const css = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; color-scheme: dark; }
body { background: #080808; }

.page {
  background: #080808;
  color: #d1d5db;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  min-height: 100dvh;
  overflow-x: hidden;
}

/* NAV */
.nav {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; height: 52px;
  background: rgba(8,8,8,0.92);
  backdrop-filter: blur(20px) saturate(1.5);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.nav-logo { font-size: 15px; font-weight: 700; color: #fff; text-decoration: none; letter-spacing: -0.02em; }
.nav-right { display: flex; align-items: center; gap: 2px; }
.nav-link {
  padding: 5px 11px; color: rgba(255,255,255,0.45); text-decoration: none;
  font-size: 13.5px; border-radius: 6px; transition: color 0.12s, background 0.12s;
}
.nav-link:hover { color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.05); }
.nav-cta {
  margin-left: 8px; padding: 6px 14px;
  background: #fff; color: #080808;
  border-radius: 7px; font-size: 13.5px; font-weight: 600; text-decoration: none;
  transition: opacity 0.12s, transform 0.12s;
}
.nav-cta:hover { opacity: 0.9; transform: translateY(-1px); }

/* HERO */
.hero-wrap { max-width: 1180px; margin: 0 auto; padding: 80px 24px 72px; }
.hero { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }

.eyebrow {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.3);
  letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 20px;
}
.eyebrow-dot {
  width: 5px; height: 5px; border-radius: 50%; background: #a78bfa;
  animation: pulse 2.5s ease-in-out infinite;
}
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.8)} }

.hero-h1 {
  font-size: clamp(34px, 4.5vw, 58px);
  font-weight: 800; line-height: 1.05; letter-spacing: -0.04em; color: #fff; margin-bottom: 18px;
}
.accent { color: #a78bfa; }
.hero-sub {
  font-size: 15.5px; line-height: 1.65; color: rgba(255,255,255,0.4);
  max-width: 380px; margin-bottom: 32px;
}
.hero-btns { display: flex; gap: 10px; flex-wrap: wrap; }

.btn-white {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 18px; background: #fff; color: #080808;
  border-radius: 7px; font-size: 14px; font-weight: 600; text-decoration: none;
  transition: opacity 0.12s, transform 0.12s;
}
.btn-white:hover { opacity: 0.88; transform: translateY(-1px); }
.btn-outline {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 18px;
  border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.65);
  border-radius: 7px; font-size: 14px; font-weight: 500; text-decoration: none;
  transition: border-color 0.12s, background 0.12s, transform 0.12s;
}
.btn-outline:hover { border-color: rgba(255,255,255,0.22); background: rgba(255,255,255,0.04); transform: translateY(-1px); }

/* CANVAS PREVIEW */
.canvas-preview {
  position: relative; border-radius: 14px; overflow: hidden;
  border: 1px solid rgba(255,255,255,0.08);
  background: #0e0e0e;
  aspect-ratio: 4/3;
}
.canvas-bar {
  position: absolute; top: 0; left: 0; right: 0; z-index: 2;
  height: 36px; background: rgba(10,10,10,0.96);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex; align-items: center; padding: 0 12px; gap: 6px;
}
.dot-r { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }
.bar-label { margin-left: 8px; font-size: 11px; color: rgba(255,255,255,0.2); }
.canvas-area { position: absolute; top: 36px; left: 0; right: 0; bottom: 0; }
.canvas-area::before {
  content: "";
  position: absolute; inset: 0; pointer-events: none;
  background-image: radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px);
  background-size: 28px 28px;
}
.presence-badge {
  position: absolute; bottom: 14px; right: 14px; z-index: 3;
  display: flex; align-items: center; gap: 8px;
  padding: 5px 11px 5px 6px;
  background: rgba(14,14,14,0.88); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 99px; backdrop-filter: blur(10px);
  font-size: 12px; color: rgba(255,255,255,0.45);
}
.avatar-stack { display: flex; }
.avatar {
  width: 20px; height: 20px; border-radius: 50%;
  border: 1.5px solid #0e0e0e; margin-left: -5px;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; color: #0a0a0a;
}
.avatar:first-child { margin-left: 0; }

/* INSTALL STRIP */
.install-strip {
  border-top: 1px solid rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  display: flex; align-items: center; justify-content: center; gap: 40px; padding: 12px 24px;
}
.install-cmd { display: flex; align-items: center; gap: 9px; font-family: ui-monospace,"SF Mono",Menlo,monospace; font-size: 12.5px; }
.install-dollar { color: rgba(255,255,255,0.2); }
.install-text { color: rgba(255,255,255,0.55); }
.install-sep { width: 1px; height: 16px; background: rgba(255,255,255,0.07); }

/* SECTIONS */
.section { max-width: 1180px; margin: 0 auto; padding: 80px 24px; }
.sec-div { border: none; border-top: 1px solid rgba(255,255,255,0.05); margin: 0; }

.section-h2 {
  font-size: clamp(24px, 3vw, 36px); font-weight: 700;
  letter-spacing: -0.03em; color: #fff; line-height: 1.15; margin-bottom: 14px;
}
.section-p { font-size: 14.5px; line-height: 1.7; color: rgba(255,255,255,0.38); margin-bottom: 24px; }

/* CODE GRID */
.code-grid { display: grid; grid-template-columns: 320px 1fr; gap: 56px; align-items: start; }
.text-link { display: inline-flex; align-items: center; gap: 5px; font-size: 13.5px; font-weight: 500; color: #a78bfa; text-decoration: none; transition: gap 0.12s; }
.text-link:hover { gap: 9px; }
.text-link-ghost { font-size: 13.5px; color: rgba(255,255,255,0.28); text-decoration: none; transition: color 0.12s; margin-left: 14px; }
.text-link-ghost:hover { color: rgba(255,255,255,0.55); }

/* FEATURES */
.features-header { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: end; margin-bottom: 40px; }
.features-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; overflow: hidden;
}
.feat-cell {
  padding: 24px 22px;
  border-right: 1px solid rgba(255,255,255,0.06);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  transition: background 0.15s;
}
.feat-cell:hover { background: rgba(255,255,255,0.018); }
.feat-cell:nth-child(3n) { border-right: none; }
.feat-cell:nth-child(n+4) { border-bottom: none; }
.feat-title { font-size: 13.5px; font-weight: 600; color: rgba(255,255,255,0.88); margin-bottom: 7px; }
.feat-body { font-size: 13px; line-height: 1.6; color: rgba(255,255,255,0.35); }

/* COMPARE */
.compare-grid { display: grid; grid-template-columns: 300px 1fr; gap: 56px; align-items: start; }
.compare-table { width: 100%; border-collapse: collapse; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; overflow: hidden; }
.compare-table th { text-align: left; padding: 10px 16px; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.28); background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.06); }
.compare-table td { padding: 11px 16px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.4); }
.compare-table tr:last-child td { border-bottom: none; }
.td-label { color: rgba(255,255,255,0.5) !important; font-weight: 500; }
.td-flock { color: #fff !important; font-weight: 600; }
.good { color: #34d399; }
.muted { color: rgba(255,255,255,0.18); }

/* CTA */
.cta-outer { border-top: 1px solid rgba(255,255,255,0.05); }
.cta-inner { text-align: center; padding: 80px 24px 88px; max-width: 560px; margin: 0 auto; }
.cta-h2 { font-size: clamp(28px, 4vw, 46px); font-weight: 800; letter-spacing: -0.04em; color: #fff; line-height: 1.08; margin-bottom: 14px; }
.cta-p { font-size: 15px; line-height: 1.65; color: rgba(255,255,255,0.38); margin-bottom: 28px; }
.cta-btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

/* FOOTER */
.footer { border-top: 1px solid rgba(255,255,255,0.06); padding: 18px 24px; display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; color: rgba(255,255,255,0.22); }
.footer-links { display: flex; gap: 20px; }
.footer-link { color: rgba(255,255,255,0.22); text-decoration: none; transition: color 0.12s; }
.footer-link:hover { color: rgba(255,255,255,0.5); }

@media (max-width: 860px) {
  .hero { grid-template-columns: 1fr; }
  .canvas-preview { aspect-ratio: 16/9; }
  .code-grid, .compare-grid { grid-template-columns: 1fr; }
  .features-grid { grid-template-columns: 1fr 1fr; }
  .feat-cell:nth-child(3n) { border-right: 1px solid rgba(255,255,255,0.06); }
  .feat-cell:nth-child(2n) { border-right: none; }
  .feat-cell:nth-child(n+5) { border-bottom: none; }
  .features-header { grid-template-columns: 1fr; }
  .install-strip { gap: 16px; flex-wrap: wrap; }
}
@media (max-width: 600px) {
  .features-grid { grid-template-columns: 1fr; }
  .feat-cell { border-right: none !important; }
  .hero-wrap { padding: 48px 20px 56px; }
  .section { padding: 56px 20px; }
  .footer { flex-direction: column; gap: 12px; text-align: center; }
}
`;

export default function HomePage() {
  return (
    <>
      <style>{css}</style>
      <div className="page">

        {/* NAV */}
        <nav className="nav">
          <a href="/" className="nav-logo">Flock</a>
          <div className="nav-right">
            <a href="/docs" className="nav-link">Docs</a>
            <a href="/docs/api-reference/core/flock-client" className="nav-link">API</a>
            <a href="https://flock-demo-canvas.vercel.app" className="nav-link" target="_blank" rel="noopener noreferrer">Demo</a>
            <a href="https://github.com/xevrion/flock" className="nav-link" target="_blank" rel="noopener noreferrer">GitHub</a>
            <Link href="/docs" className="nav-cta">Get started</Link>
          </div>
        </nav>

        {/* HERO */}
        <div className="hero-wrap">
          <div className="hero">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                Open source · MIT license
              </div>
              <h1 className="hero-h1">
                Live cursors and<br />
                <span className="accent">multiplayer<br />presence</span><br />
                for any web app
              </h1>
              <p className="hero-sub">
                Self-hostable SDK. Add real-time cursors and who&apos;s online in under 10 lines of React.
                No connection caps. No per-seat pricing.
              </p>
              <div className="hero-btns">
                <Link href="/docs" className="btn-white">Read the docs →</Link>
                <a href="https://flock-demo-canvas.vercel.app" className="btn-outline" target="_blank" rel="noopener noreferrer">Live demo</a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="canvas-preview">
                <div className="canvas-bar">
                  <span className="dot-r" style={{ background: "#ff5f56" }} />
                  <span className="dot-r" style={{ background: "#febc2e" }} />
                  <span className="dot-r" style={{ background: "#27c840" }} />
                  <span className="bar-label">canvas-room · flock.xevrion.dev</span>
                </div>
                <div className="canvas-area">
                  <LiveCursorCanvas />
                </div>
                <div className="presence-badge">
                  <div className="avatar-stack">
                    {([["A","#a78bfa"],["M","#34d399"],["P","#f472b6"],["K","#fb923c"]] as const).map(([l,c]) => (
                      <span key={l} className="avatar" style={{ background: c }}>{l}</span>
                    ))}
                  </div>
                  4 online
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* INSTALL */}
        <div className="install-strip">
          <div className="install-cmd">
            <span className="install-dollar">$</span>
            <span className="install-text">npm install @xevrion/flock-react</span>
          </div>
          <div className="install-sep" />
          <div className="install-cmd">
            <span className="install-dollar">$</span>
            <span className="install-text">npx @xevrion/flock-server</span>
          </div>
        </div>

        {/* CODE */}
        <hr className="sec-div" />
        <div className="section">
          <div className="code-grid">
            <FadeUp>
              <h2 className="section-h2">Drop it in.<br />It just works.</h2>
              <p className="section-p">
                One provider, two hooks. The SDK handles WebSocket lifecycle,
                reconnection, heartbeats, and cursor interpolation automatically.
              </p>
              <Link href="/docs/getting-started/quickstart" className="text-link">Full quickstart →</Link>
              <a href="https://github.com/xevrion/flock" className="text-link-ghost" target="_blank" rel="noopener noreferrer">View source</a>
            </FadeUp>
            <FadeUp delay={0.08}><CodeBlock /></FadeUp>
          </div>
        </div>

        {/* FEATURES */}
        <hr className="sec-div" />
        <div className="section">
          <FadeUp>
            <div className="features-header">
              <h2 className="section-h2" style={{ marginBottom: 0 }}>Everything presence needs.<br />Nothing it doesn&apos;t.</h2>
              <p className="section-p" style={{ marginBottom: 0 }}>
                Flock does cursors and who&apos;s online, and does them well. No CRDT, no comments,
                no bloat. The smallest thing that makes your app feel multiplayer.
              </p>
            </div>
          </FadeUp>
          <FadeUp delay={0.05}>
            <div className="features-grid">
              {FEATURES.map((f) => (
                <div key={f.title} className="feat-cell">
                  <div className="feat-title">{f.title}</div>
                  <div className="feat-body">{f.body}</div>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>

        {/* COMPARE */}
        <hr className="sec-div" />
        <div className="section">
          <div className="compare-grid">
            <FadeUp>
              <h2 className="section-h2">Why not Liveblocks?</h2>
              <p className="section-p">
                Liveblocks is a great hosted platform. But it can&apos;t be self-hosted,
                has connection caps on the free tier, and partial AGPL licensing.
                Flock is the open alternative.
              </p>
            </FadeUp>
            <FadeUp delay={0.08}>
              <table className="compare-table">
                <thead>
                  <tr>
                    <th></th><th>Flock</th><th>Liveblocks</th><th>DIY</th>
                  </tr>
                </thead>
                <tbody>
                  {TABLE_ROWS.map(([label, flock, lb, diy]) => (
                    <tr key={label}>
                      <td className="td-label">{label}</td>
                      <td className="td-flock">
                        <span className={["Yes","None","MIT"].includes(flock) ? "good" : ""}>{flock}</span>
                      </td>
                      <td><span className={["No","Yes"].includes(lb) ? "muted" : ""}>{lb}</span></td>
                      <td>{diy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FadeUp>
          </div>
        </div>

        {/* CTA */}
        <div className="cta-outer">
          <FadeUp>
            <div className="cta-inner">
              <h2 className="cta-h2">Ship multiplayer in an afternoon</h2>
              <p className="cta-p">
                Start with the hosted demo server, point your app at it, and have cursors
                working before lunch. Self-host when you&apos;re ready.
              </p>
              <div className="cta-btns">
                <Link href="/docs" className="btn-white">Get started →</Link>
                <a href="https://github.com/xevrion/flock" className="btn-outline" target="_blank" rel="noopener noreferrer">★ Star on GitHub</a>
              </div>
            </div>
          </FadeUp>
        </div>

        {/* FOOTER */}
        <footer className="footer">
          <span>Flock · MIT license · Yash Bavadiya</span>
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
