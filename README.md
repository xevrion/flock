# Flock

Real-time multiplayer presence and live cursors for the web.

## Packages

| Package | Description |
|---|---|
| `@flock-sdk/core` | Framework-agnostic WebSocket transport, cursor interpolation, reconnection with backoff |
| `@flock-sdk/react` | React hooks: `usePresence`, `useCursors`, `useConnectionStatus` |
| `@flock-sdk/server` | Node.js WebSocket server with Redis-backed presence TTL and pub/sub fan-out |

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

The server runs in-memory by default. To enable TTL-based presence eviction and
multi-instance fan-out, point it at a Redis instance:

```bash
FLOCK_REDIS_URL=redis://localhost:6379 node packages/server/dist/cli.js
```

Then start the demo:

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
  without a clean disconnect; after the presence TTL (default 30s) the other
  tab drops that user.
- **Heartbeats.** Open DevTools, Network, WS, select the connection, and watch
  `heartbeat` / `heartbeat:ack` frames every 10s while connected.
- **Duplicate tab / same user.** Open the same room in two tabs as the same
  user. The server evicts the first connection when the second one joins, so
  only one cursor is ever shown.
- **Rate limiting.** The server closes connections that exceed 100 messages per
  second (configurable via `FLOCK_MAX_MESSAGES_PER_SECOND`).
- **API key auth.** Set `FLOCK_API_KEYS=mykey` on the server and pass
  `apiKey: "mykey"` in the client options. A missing or wrong key is rejected
  with an `error:INVALID_API_KEY` message before the socket closes.

## Server env vars

| Variable | Default | Description |
|---|---|---|
| `FLOCK_PORT` | `8787` | Port to listen on |
| `FLOCK_REDIS_URL` | — | Redis connection URL; enables TTL eviction and pub/sub |
| `FLOCK_API_KEYS` | — | Comma-separated list of valid API keys; unset = open mode |
| `FLOCK_PRESENCE_TTL_SECONDS` | `30` | Seconds before an idle user is evicted |
| `FLOCK_MAX_MESSAGES_PER_SECOND` | `100` | Per-connection message rate limit |
| `FLOCK_LOG_LEVEL` | `info` | Pino log level (`debug`, `info`, `warn`, `error`) |

## Multi-instance / horizontal scaling

When `FLOCK_REDIS_URL` is set, each server instance publishes outgoing messages
to a Redis pub/sub channel (`flock:broadcast:{roomId}`) so that clients connected
to different instances see each other's cursors and presence events. Each
instance ignores its own published messages to avoid double-delivery.

Spin up two instances to test locally:

```bash
FLOCK_PORT=8787 FLOCK_REDIS_URL=redis://localhost:6379 node packages/server/dist/cli.js &
FLOCK_PORT=8788 FLOCK_REDIS_URL=redis://localhost:6379 node packages/server/dist/cli.js &
```

Connect one browser tab to each port; cursor moves on one should appear on the other.

## Docker

```bash
docker build -f packages/server/Dockerfile -t flock-server .
docker run -e FLOCK_REDIS_URL=redis://... -p 8787:8787 flock-server
```

The image is based on `node:22-alpine` and comes in under 60MB.

## Docs site

The docs live in `apps/docs` (Next.js 15 + Fumadocs). Run locally:

```bash
pnpm --filter docs dev
```

Open http://localhost:3200. Content is in `apps/docs/content/docs/`.

## Debugging the core SDK

`playground/index.html` is a no-framework page that imports `@flock-sdk/core`
directly, useful for testing the transport without React. Build the packages,
start the server, then serve the repo over HTTP:

```bash
python3 -m http.server 5500
```

Open http://localhost:5500/playground/index.html in two tabs. It also shows the
cursor throttle and interpolation counters.

## Tests

```bash
pnpm test
```

Unit + integration tests cover the core transport, React hooks, server message
handling, presence eviction, reconnection, duplicate-join eviction, cursor
buffering, API key auth, rate limiting, and cross-instance pub/sub relay (the
last requires a local Redis).
