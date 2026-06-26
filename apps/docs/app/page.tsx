"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "motion/react";

function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, name: string) {
  const s = 1.15;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 1.5*s, y + 13*s);
  ctx.lineTo(x + 4.5*s, y + 9.5*s);
  ctx.lineTo(x + 7.5*s, y + 15.5*s);
  ctx.lineTo(x + 9.5*s, y + 14.5*s);
  ctx.lineTo(x + 6.5*s, y + 8.5*s);
  ctx.lineTo(x + 10.5*s, y + 8*s);
  ctx.closePath();
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.save();
  ctx.font = "600 11px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  const tw = ctx.measureText(name).width;
  const px = 7, rx = x + 13*s, ry = y + 14*s;
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  (ctx as unknown as { roundRect: (...a: number[]) => void }).roundRect(rx, ry, tw + px*2, 19, 4);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.fillText(name, rx + px, ry + 13.5);
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

    const users = [
      { name: "Alice",  color: "#a78bfa", x: 0.25, y: 0.32, tx: 0.25, ty: 0.32 },
      { name: "Marcus", color: "#34d399", x: 0.60, y: 0.50, tx: 0.60, ty: 0.50 },
      { name: "Priya",  color: "#f472b6", x: 0.38, y: 0.68, tx: 0.38, ty: 0.68 },
      { name: "Kai",    color: "#fb923c", x: 0.72, y: 0.26, tx: 0.72, ty: 0.26 },
    ];

    const paths = [
      [[0.22,0.28],[0.55,0.38],[0.30,0.62],[0.68,0.30]],
      [[0.45,0.50],[0.28,0.38],[0.65,0.52],[0.50,0.65]],
      [[0.58,0.30],[0.38,0.62],[0.52,0.28],[0.30,0.48]],
      [[0.32,0.55],[0.62,0.42],[0.24,0.35],[0.60,0.60]],
    ];

    let frame = 0, pathIdx = 0, raf: number;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    function tick() {
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      ctx!.clearRect(0, 0, r.width, r.height);
      frame++;
      if (frame % 130 === 0) {
        pathIdx = (pathIdx + 1) % paths.length;
        users.forEach((u, i) => { u.tx = paths[pathIdx][i][0]; u.ty = paths[pathIdx][i][1]; });
      }
      for (const u of users) {
        u.x = lerp(u.x, u.tx, 0.028);
        u.y = lerp(u.y, u.ty, 0.028);
        drawCursor(ctx!, u.x * r.width, u.y * r.height, u.color, u.name);
      }
      raf = requestAnimationFrame(tick);
    }
    tick();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

function FadeUp({ children, delay = 0, style = {} }: {
  children: React.ReactNode; delay?: number; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div ref={ref} style={style}
      initial={{ opacity: 0, y: 18 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >{children}</motion.div>
  );
}

function InstallCmd({ cmd }: { cmd: string }) {
  const [state, setState] = useState<"idle" | "done">("idle");
  function copy() {
    if (state !== "idle") return;
    navigator.clipboard.writeText(cmd);
    setState("done");
    setTimeout(() => setState("idle"), 2000);
  }
  return (
    <motion.button className="install-cmd" onClick={copy} whileHover={{ backgroundColor: "rgba(255,255,255,0.04)" }} whileTap={{ scale: 0.98 }}>
      <span className="install-dollar">$</span>
      <span className="install-text">{cmd}</span>
      <span className="install-icon">
        <AnimatePresence mode="wait">
          {state === "done" ? (
            <motion.span key="chk" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.18, ease: [0.16,1,0.3,1] }} style={{ color: "#34d399", display: "flex" }}>
              <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </motion.span>
          ) : (
            <motion.span key="cpy" initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} style={{ display: "flex" }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="4.5" y="4.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M2 9.5V3A1.5 1.5 0 013.5 1.5H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
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
function tokenize(code: string) {
  const out: { type: TokType; text: string }[] = [];
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
  const [state, setState] = useState<"idle" | "done">("idle");
  const toks = tokenize(CODE);
  const colors: Record<TokType, string> = { kw: "#c084fc", str: "#86efac", cmt: "#4b5563", plain: "#d1d5db" };

  function copy() {
    if (state !== "idle") return;
    navigator.clipboard.writeText(CODE);
    setState("done");
    setTimeout(() => setState("idle"), 2200);
  }

  return (
    <div className="code-block">
      <div className="code-header">
        <div style={{ display: "flex", gap: 5 }}>
          {(["#ff5f56","#febc2e","#27c840"] as const).map(c => (
            <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "block" }} />
          ))}
        </div>
        <span className="code-filename">App.tsx</span>
        <motion.button className="code-copy-btn" onClick={copy} whileTap={{ scale: 0.95 }}>
          <AnimatePresence mode="wait">
            {state === "done" ? (
              <motion.span key="done" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }} style={{ color: "#34d399", display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Copied
              </motion.span>
            ) : (
              <motion.span key="copy" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
                Copy
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
      <pre className="code-body">
        {toks.map((t, i) => <span key={i} style={{ color: colors[t.type] }}>{t.text}</span>)}
      </pre>
    </div>
  );
}

const FEATURES = [
  { title: "Self-hostable",   body: "Run on your own infrastructure via Docker or npx. No data leaves your servers." },
  { title: "10 lines of code",body: "One provider, two hooks. That's the entire integration surface area." },
  { title: "Auto-reconnection",body: "Exponential backoff, TTL-based eviction, silent state recovery." },
  { title: "MIT license",     body: "No caps, no per-seat pricing. Open source, keep forever." },
  { title: "~6KB gzipped",   body: "Tree-shakeable. No heavy runtime dependencies." },
  { title: "Redis pub/sub",  body: "Scale horizontally with multiple server instances sharing room state." },
];

const css = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; color-scheme: dark; }
body { background: #080808; }

.page {
  background: #080808;
  color: #d1d5db;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  min-height: 100dvh;
  overflow-x: hidden;
}

.nav {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; height: 52px;
  background: rgba(8,8,8,0.9);
  backdrop-filter: blur(20px) saturate(1.5);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.nav-logo { font-size: 15px; font-weight: 700; color: #fff; text-decoration: none; letter-spacing: -0.02em; }
.nav-right { display: flex; align-items: center; gap: 2px; }
.nav-link { padding: 5px 11px; color: rgba(255,255,255,0.45); text-decoration: none; font-size: 13.5px; border-radius: 6px; transition: color 0.12s, background 0.12s; }
.nav-link:hover { color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.05); }
.nav-cta { margin-left: 8px; padding: 6px 14px; background: #fff; color: #080808; border-radius: 7px; font-size: 13.5px; font-weight: 600; text-decoration: none; transition: opacity 0.12s, transform 0.12s; display: inline-block; }
.nav-cta:hover { opacity: 0.88; transform: translateY(-1px); }

.hero-wrap { max-width: 1160px; margin: 0 auto; padding: 88px 24px 80px; }
.hero { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }

.eyebrow { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.28); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 22px; }
.eyebrow-dot { width: 5px; height: 5px; border-radius: 50%; background: #a78bfa; animation: pulse 2.5s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.25;transform:scale(0.7)} }

.hero-h1 { font-size: clamp(36px, 4.5vw, 60px); font-weight: 800; line-height: 1.04; letter-spacing: -0.04em; color: #fff; margin-bottom: 20px; }
.accent { color: #a78bfa; }
.hero-sub { font-size: 15.5px; line-height: 1.65; color: rgba(255,255,255,0.38); max-width: 380px; margin-bottom: 32px; }
.hero-btns { display: flex; gap: 10px; flex-wrap: wrap; }

.btn-white { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; background: #fff; color: #080808; border-radius: 7px; font-size: 14px; font-weight: 600; text-decoration: none; transition: opacity 0.12s, transform 0.12s; }
.btn-white:hover { opacity: 0.88; transform: translateY(-1px); }
.btn-outline { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.65); border-radius: 7px; font-size: 14px; font-weight: 500; text-decoration: none; transition: border-color 0.12s, background 0.12s, transform 0.12s; }
.btn-outline:hover { border-color: rgba(255,255,255,0.24); background: rgba(255,255,255,0.04); transform: translateY(-1px); }

.canvas-preview { position: relative; border-radius: 14px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); background: #0e0e0e; aspect-ratio: 4/3; }
.canvas-bar { position: absolute; top: 0; left: 0; right: 0; z-index: 2; height: 36px; background: rgba(10,10,10,0.97); border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; padding: 0 12px; gap: 6px; }
.dot-r { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }
.bar-label { margin-left: 8px; font-size: 11px; color: rgba(255,255,255,0.18); font-family: ui-monospace,monospace; }
.canvas-area { position: absolute; top: 36px; left: 0; right: 0; bottom: 0; }
.canvas-area::before { content: ""; position: absolute; inset: 0; pointer-events: none; background-image: radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px); background-size: 28px 28px; }
.presence-badge { position: absolute; bottom: 14px; right: 14px; z-index: 3; display: flex; align-items: center; gap: 8px; padding: 5px 11px 5px 6px; background: rgba(12,12,12,0.88); border: 1px solid rgba(255,255,255,0.08); border-radius: 99px; backdrop-filter: blur(12px); font-size: 12px; color: rgba(255,255,255,0.4); }
.avatar-stack { display: flex; }
.avatar { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid #0e0e0e; margin-left: -5px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #0a0a0a; flex-shrink: 0; }
.avatar:first-child { margin-left: 0; }

.install-strip { border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; gap: 4px; padding: 10px 24px; }
.install-cmd { display: flex; align-items: center; gap: 9px; padding: 5px 12px; border-radius: 7px; cursor: pointer; border: none; background: transparent; outline: none; }
.install-dollar { color: rgba(255,255,255,0.2); font-family: ui-monospace,"SF Mono",Menlo,monospace; font-size: 12.5px; }
.install-text { color: rgba(255,255,255,0.55); font-family: ui-monospace,"SF Mono",Menlo,monospace; font-size: 12.5px; }
.install-icon { display: flex; align-items: center; color: rgba(255,255,255,0.4); margin-left: 2px; }
.install-sep { width: 1px; height: 18px; background: rgba(255,255,255,0.06); margin: 0 4px; }

.section { max-width: 1160px; margin: 0 auto; padding: 80px 24px; }
.sec-div { border: none; border-top: 1px solid rgba(255,255,255,0.05); margin: 0; }

.h2 { font-size: clamp(26px, 3vw, 38px); font-weight: 700; letter-spacing: -0.03em; color: #fff; line-height: 1.12; margin-bottom: 14px; }
.p-muted { font-size: 14.5px; line-height: 1.7; color: rgba(255,255,255,0.36); margin-bottom: 24px; }

.code-grid { display: grid; grid-template-columns: 300px 1fr; gap: 56px; align-items: start; }
.text-link { display: inline-flex; align-items: center; gap: 5px; font-size: 13.5px; font-weight: 500; color: #a78bfa; text-decoration: none; transition: gap 0.12s; }
.text-link:hover { gap: 9px; }
.text-link-ghost { font-size: 13.5px; color: rgba(255,255,255,0.25); text-decoration: none; margin-left: 14px; transition: color 0.12s; }
.text-link-ghost:hover { color: rgba(255,255,255,0.5); }

.code-block { border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.07); background: #0d0d0d; }
.code-header { display: flex; align-items: center; justify-content: space-between; padding: 9px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.code-filename { font-family: ui-monospace,monospace; font-size: 11px; color: rgba(255,255,255,0.2); }
.code-copy-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.09); border-radius: 5px; color: rgba(255,255,255,0.38); font-size: 11px; padding: 3px 9px; cursor: pointer; display: flex; align-items: center; gap: 4px; min-width: 52px; justify-content: center; overflow: hidden; transition: background 0.12s; }
.code-copy-btn:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.65); }
.code-body { margin: 0; padding: 18px 20px; font-family: ui-monospace,"SF Mono",Menlo,monospace; font-size: 12.5px; line-height: 1.75; overflow-x: auto; white-space: pre; }

.feat-header { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: end; margin-bottom: 40px; }
.feat-grid { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; overflow: hidden; }
.feat-cell { padding: 24px 22px; border-right: 1px solid rgba(255,255,255,0.06); border-bottom: 1px solid rgba(255,255,255,0.06); transition: background 0.15s; }
.feat-cell:hover { background: rgba(255,255,255,0.018); }
.feat-cell:nth-child(3n) { border-right: none; }
.feat-cell:nth-child(n+4) { border-bottom: none; }
.feat-title { font-size: 13.5px; font-weight: 600; color: rgba(255,255,255,0.85); margin-bottom: 7px; }
.feat-body { font-size: 13px; line-height: 1.6; color: rgba(255,255,255,0.33); }

.cta-outer { border-top: 1px solid rgba(255,255,255,0.05); }
.cta-inner { text-align: center; padding: 80px 24px 88px; max-width: 520px; margin: 0 auto; }
.cta-h2 { font-size: clamp(30px, 4vw, 48px); font-weight: 800; letter-spacing: -0.04em; color: #fff; line-height: 1.06; margin-bottom: 14px; }
.cta-p { font-size: 15px; line-height: 1.65; color: rgba(255,255,255,0.36); margin-bottom: 28px; }
.cta-btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

.footer { border-top: 1px solid rgba(255,255,255,0.06); padding: 18px 24px; display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; color: rgba(255,255,255,0.2); }
.footer-links { display: flex; gap: 20px; }
.footer-link { color: rgba(255,255,255,0.2); text-decoration: none; transition: color 0.12s; }
.footer-link:hover { color: rgba(255,255,255,0.5); }

@media (max-width: 860px) {
  .hero { grid-template-columns: 1fr; }
  .canvas-preview { aspect-ratio: 16/9; }
  .code-grid { grid-template-columns: 1fr; }
  .feat-header { grid-template-columns: 1fr; }
  .feat-grid { grid-template-columns: 1fr 1fr; }
  .feat-cell:nth-child(3n) { border-right: 1px solid rgba(255,255,255,0.06); }
  .feat-cell:nth-child(2n) { border-right: none; }
  .feat-cell:nth-child(n+5) { border-bottom: none; }
  .install-strip { flex-wrap: wrap; }
}
@media (max-width: 580px) {
  .hero-wrap { padding: 52px 20px 56px; }
  .section { padding: 56px 20px; }
  .feat-grid { grid-template-columns: 1fr; }
  .feat-cell { border-right: none !important; }
  .nav-link { display: none; }
  .footer { flex-direction: column; gap: 12px; text-align: center; }
}
`;

export default function HomePage() {
  return (
    <>
      <style>{css}</style>
      <div className="page">

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

        <div className="hero-wrap">
          <div className="hero">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16,1,0.3,1] }}>
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

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease: [0.16,1,0.3,1] }}>
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

        <div className="install-strip">
          <InstallCmd cmd="npm install @xevrion/flock-react" />
          <div className="install-sep" />
          <InstallCmd cmd="npx @xevrion/flock-server" />
        </div>

        <hr className="sec-div" />
        <div className="section">
          <div className="code-grid">
            <FadeUp>
              <h2 className="h2">Drop it in.<br />It just works.</h2>
              <p className="p-muted">
                One provider, two hooks. The SDK handles WebSocket lifecycle,
                reconnection, heartbeats, and cursor interpolation automatically.
              </p>
              <Link href="/docs/getting-started/quickstart" className="text-link">Full quickstart →</Link>
              <a href="https://github.com/xevrion/flock" className="text-link-ghost" target="_blank" rel="noopener noreferrer">View source</a>
            </FadeUp>
            <FadeUp delay={0.08}><CodeBlock /></FadeUp>
          </div>
        </div>

        <hr className="sec-div" />
        <div className="section">
          <FadeUp>
            <div className="feat-header">
              <h2 className="h2" style={{ marginBottom: 0 }}>Everything you need.<br />Nothing you don&apos;t.</h2>
              <p className="p-muted" style={{ marginBottom: 0 }}>
                Flock does cursors and who&apos;s online, and does them well.
                The smallest thing that makes your app feel multiplayer.
              </p>
            </div>
          </FadeUp>
          <FadeUp delay={0.06}>
            <div className="feat-grid">
              {FEATURES.map((f) => (
                <div key={f.title} className="feat-cell">
                  <div className="feat-title">{f.title}</div>
                  <div className="feat-body">{f.body}</div>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>

        <div className="cta-outer">
          <FadeUp>
            <div className="cta-inner">
              <h2 className="cta-h2">Ship multiplayer in an afternoon</h2>
              <p className="cta-p">
                Start local, point your app at the server, and have live cursors working before lunch.
                Self-host on your own infra when you&apos;re ready.
              </p>
              <div className="cta-btns">
                <Link href="/docs" className="btn-white">Get started →</Link>
                <a href="https://github.com/xevrion/flock" className="btn-outline" target="_blank" rel="noopener noreferrer">★ Star on GitHub</a>
              </div>
            </div>
          </FadeUp>
        </div>

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
