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

In another terminal, serve the playground:

```bash
python3 -m http.server 5500
```

Open http://localhost:5500/playground/index.html in two tabs and move your mouse.
