# Flock

Real-time multiplayer presence and live cursors for the web.

## Run it locally

Build the packages:

```bash
pnpm install
pnpm build
```

Start the server:

```bash
node packages/server/dist/cli.js
```

The server runs in-memory by default. To enable TTL-based presence (so a
dropped connection is evicted after it stops sending heartbeats), point it at a
Redis instance:

```bash
FLOCK_REDIS_URL=redis://localhost:6379 node packages/server/dist/cli.js
```

### Playground

A minimal vanilla page for quick cursor testing. In another terminal, serve the
repo over HTTP:

```bash
python3 -m http.server 5500
```

Open http://localhost:5500/playground/index.html in two tabs and move your mouse.

### Canvas demo

A fuller React demo with a presence bar, connection status dot, join/leave
toasts, and shareable room URLs.

```bash
pnpm --filter demo-canvas dev
```

Open http://localhost:3100 in two tabs. Copy the `?room=` code from the first
tab's URL into the second so both join the same room, then move your mouse.

## What to test

- **Cursors and presence.** Move the mouse in one tab; the other shows the
  cursor, name, and color. The presence bar lists who is in the room, and joins
  and leaves raise a toast.
- **Reconnection.** With two tabs connected, stop the server (Ctrl+C). Within a
  couple of seconds the status dot turns yellow ("Reconnecting") and cursors
  freeze. Restart the server; both tabs reconnect on their own (no reload), the
  dot goes green, and cursors resume. The reconnected user keeps the same name
  and color.
- **TTL eviction.** Start the server with `FLOCK_REDIS_URL` set. Close one tab
  (or kill its process) without a clean disconnect; after the presence TTL
  (default 30s) lapses without a heartbeat, the other tab drops that user.
- **Heartbeats.** Open DevTools, Network, WS, select the connection, and watch
  `heartbeat` / `heartbeat:ack` frames every 10s while connected.
