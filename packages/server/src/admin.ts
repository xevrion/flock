// Admin HTTP handler. Mounted at /admin and /api/admin/* on the shared HTTP
// server. Protected by a password set via FLOCK_ADMIN_PASSWORD.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { RoomManager } from "./room-manager.js";

function timeSince(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function html(rooms: ReturnType<RoomManager["getAllRooms"]>, totalUsers: number): string {
  const rows = rooms.length === 0
    ? `<tr><td colspan="4" style="text-align:center;padding:40px;color:#555">No active rooms</td></tr>`
    : rooms.map((r) => {
        const users = r.clients.map((c) => {
          const name = typeof c.metadata.name === "string" ? c.metadata.name : c.userId;
          const color = typeof c.metadata.color === "string" ? c.metadata.color : "#888";
          return `<span style="display:inline-flex;align-items:center;gap:5px;margin:0 6px 4px 0;font-size:12px">
            <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>${name}
          </span>`;
        }).join("");
        return `<tr>
          <td style="font-family:monospace;font-size:13px;color:#e2e8f0;padding:12px 16px">${r.roomId}</td>
          <td style="padding:12px 16px;color:#94a3b8;font-size:13px">${r.clients.length}</td>
          <td style="padding:12px 16px;color:#64748b;font-size:12px">${timeSince(r.createdAt)}</td>
          <td style="padding:12px 16px">${users}</td>
          <td style="padding:12px 16px;text-align:right">
            <form method="POST" action="/api/admin/close-room" style="display:inline">
              <input type="hidden" name="roomId" value="${r.roomId}" />
              <button type="submit" style="padding:4px 10px;border-radius:5px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:12px;cursor:pointer">
                Close room
              </button>
            </form>
          </td>
        </tr>`;
      }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Flock Admin</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { color-scheme: dark; }
  body { background: #0a0a0a; color: #cbd5e1; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 14px; min-height: 100vh; }
  .nav { border-bottom: 1px solid #1e293b; padding: 0 28px; height: 52px; display: flex; align-items: center; justify-content: space-between; }
  .nav-title { font-size: 15px; font-weight: 700; color: #f1f5f9; letter-spacing: -0.02em; }
  .nav-sub { font-size: 12px; color: #475569; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 32px 28px; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
  .stat { background: #111827; border: 1px solid #1e293b; border-radius: 10px; padding: 18px 20px; }
  .stat-val { font-size: 28px; font-weight: 700; color: #f1f5f9; letter-spacing: -0.04em; line-height: 1; margin-bottom: 4px; }
  .stat-label { font-size: 12px; color: #475569; }
  .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; overflow: hidden; }
  .card-header { padding: 14px 20px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between; }
  .card-title { font-size: 13px; font-weight: 600; color: #94a3b8; letter-spacing: 0.04em; text-transform: uppercase; }
  .refresh { font-size: 12px; color: #334155; text-decoration: none; }
  .refresh:hover { color: #94a3b8; }
  table { width: 100%; border-collapse: collapse; }
  thead th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 500; color: #334155; letter-spacing: 0.06em; text-transform: uppercase; border-bottom: 1px solid #1e293b; }
  tbody tr { border-bottom: 1px solid #1a2332; transition: background 0.1s; }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: rgba(255,255,255,0.02); }
  .close-all { padding: 6px 14px; border-radius: 6px; border: 1px solid #334155; background: transparent; color: #64748b; font-size: 12px; cursor: pointer; transition: border-color 0.12s, color 0.12s; }
  .close-all:hover { border-color: #ef4444; color: #ef4444; }
</style>
</head>
<body>
<nav class="nav">
  <span class="nav-title">Flock Admin</span>
  <span class="nav-sub">Auto-refreshes every 10s &nbsp;·&nbsp; <a href="/admin" class="refresh">Refresh now</a></span>
</nav>
<div class="wrap">
  <div class="stats">
    <div class="stat">
      <div class="stat-val">${rooms.length}</div>
      <div class="stat-label">Active rooms</div>
    </div>
    <div class="stat">
      <div class="stat-val">${totalUsers}</div>
      <div class="stat-label">Connected users</div>
    </div>
    <div class="stat">
      <div class="stat-val">${rooms.length > 0 ? Math.round(totalUsers / rooms.length * 10) / 10 : 0}</div>
      <div class="stat-label">Avg users/room</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <span class="card-title">Rooms</span>
      ${rooms.length > 0 ? `
      <form method="POST" action="/api/admin/close-all">
        <button type="submit" class="close-all">Close all rooms</button>
      </form>` : ""}
    </div>
    <table>
      <thead>
        <tr>
          <th>Room ID</th>
          <th>Users</th>
          <th>Created</th>
          <th>Who's here</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</div>
<script>setTimeout(() => location.reload(), 10000);</script>
</body>
</html>`;
}

function loginHtml(error = false): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Flock Admin — Login</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { color-scheme: dark; }
  body { background: #0a0a0a; color: #cbd5e1; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .box { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 28px 24px; width: 300px; }
  h1 { font-size: 16px; font-weight: 700; color: #f1f5f9; margin-bottom: 20px; letter-spacing: -0.02em; }
  input { width: 100%; padding: 8px 12px; border-radius: 7px; border: 1px solid ${error ? "#ef4444" : "#1e293b"}; background: #0a0a0a; color: #f1f5f9; font-size: 14px; outline: none; margin-bottom: 10px; }
  .err { font-size: 12px; color: #ef4444; margin-bottom: 10px; }
  button { width: 100%; padding: 9px; border-radius: 7px; border: none; background: #f1f5f9; color: #0a0a0a; font-size: 14px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
<div class="box">
  <h1>Flock Admin</h1>
  <form method="POST" action="/admin">
    ${error ? `<div class="err">Incorrect password</div>` : ""}
    <input type="password" name="password" placeholder="Password" autofocus />
    <button type="submit">Sign in</button>
  </form>
</div>
</body>
</html>`;
}

function parseBody(req: IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => {
      const params: Record<string, string> = {};
      for (const pair of body.split("&")) {
        const [k, v] = pair.split("=");
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
      }
      resolve(params);
    });
  });
}

// Checks the session cookie. Returns true if valid.
function isAuthed(req: IncomingMessage, token: string): boolean {
  const cookie = req.headers.cookie ?? "";
  return cookie.split(";").some((c) => c.trim() === `flock_admin=${token}`);
}

export function createAdminHandler(
  rooms: RoomManager,
  password: string,
  // Used to close all sockets in a room when an admin shuts it down
  onCloseRoom: (roomId: string) => void,
) {
  // One-time session token derived from the password -- no need for a full
  // session store, since it's a single-user tool.
  const sessionToken = Buffer.from(`flock:${password}`).toString("base64");
  const cookieHeader = `flock_admin=${sessionToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`;

  return async function handleAdmin(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "/";

    // Login form GET
    if (url === "/admin" && req.method === "GET") {
      if (isAuthed(req, sessionToken)) {
        const allRooms = rooms.getAllRooms();
        const totalUsers = allRooms.reduce((n, r) => n + r.clients.length, 0);
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html(allRooms, totalUsers));
      } else {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(loginHtml());
      }
      return true;
    }

    // Login form POST
    if (url === "/admin" && req.method === "POST") {
      const body = await parseBody(req);
      if (body.password === password) {
        res.writeHead(302, { location: "/admin", "set-cookie": cookieHeader });
        res.end();
      } else {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(loginHtml(true));
      }
      return true;
    }

    // API: close a single room
    if (url === "/api/admin/close-room" && req.method === "POST") {
      if (!isAuthed(req, sessionToken)) {
        res.writeHead(401); res.end(); return true;
      }
      const body = await parseBody(req);
      if (body.roomId) onCloseRoom(body.roomId);
      res.writeHead(302, { location: "/admin" });
      res.end();
      return true;
    }

    // API: close all rooms
    if (url === "/api/admin/close-all" && req.method === "POST") {
      if (!isAuthed(req, sessionToken)) {
        res.writeHead(401); res.end(); return true;
      }
      for (const r of rooms.getAllRooms()) onCloseRoom(r.roomId);
      res.writeHead(302, { location: "/admin" });
      res.end();
      return true;
    }

    return false;
  };
}
