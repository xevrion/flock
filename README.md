# Flock

Real-time multiplayer presence and live cursors for any web app — in 10 lines of code.

[![npm](https://img.shields.io/npm/v/@xevrion/flock-core?label=%40flock-sdk%2Fcore)](https://www.npmjs.com/package/@xevrion/flock-core)
[![npm](https://img.shields.io/npm/v/@xevrion/flock-react?label=%40flock-sdk%2Freact)](https://www.npmjs.com/package/@xevrion/flock-react)
[![npm](https://img.shields.io/npm/v/@xevrion/flock-server?label=%40flock-sdk%2Fserver)](https://www.npmjs.com/package/@xevrion/flock-server)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![CI](https://github.com/xevrion/flock/actions/workflows/ci.yml/badge.svg)](https://github.com/xevrion/flock/actions/workflows/ci.yml)

<!-- TODO: record and add demo GIF here -->
<!-- Record a 10-second screen capture of the canvas demo showing two browser windows
     with live cursors moving in sync. Save as demo.gif and replace this comment with:
     ![Flock demo](./demo.gif) -->

**Bundle sizes:** `@xevrion/flock-core` ~6KB gzipped · `@xevrion/flock-react` ~3KB gzipped

## Install

```bash
npm install @xevrion/flock-react
npx @xevrion/flock-server
```

## Quickstart

```tsx
import { FlockProvider, useCursors, usePresence } from "@xevrion/flock-react";

function CursorOverlay() {
  const cursors = useCursors();
  return (
    <>
      {Object.values(cursors).map((cursor) => (
        <div
          key={cursor.userId}
          style={{
            position: "fixed",
            left: `${cursor.position.x * 100}%`,
            top: `${cursor.position.y * 100}%`,
            pointerEvents: "none",
            color: cursor.metadata.color,
          }}
        >
          {cursor.metadata.name}
        </div>
      ))}
    </>
  );
}

export default function App() {
  return (
    <FlockProvider
      serverUrl="ws://localhost:8787"
      roomId="my-room"
      userId="user-123"
      metadata={{ name: "Alice", color: "#7c5cff" }}
    >
      <CursorOverlay />
    </FlockProvider>
  );
}
```

Open the page in two browser tabs and move your mouse — each tab sees the other's cursor.

## Why Flock?

| | Flock | Liveblocks | DIY |
|---|---|---|---|
| Self-hostable | Yes | **No** | Yes |
| License | MIT | Partial AGPL | — |
| Per-seat pricing | None | Yes (free tier has hard caps) | None |
| Connection caps | None | 10 per room on free tier | None |
| Setup time | 10 lines | Full platform onboarding | Weeks |
| Bundle size | ~6KB gzipped | Much larger | — |

Flock does one thing well: presence and live cursors. If you need document sync, comments, or notifications — those are out of scope by design. Flock is the smallest thing that makes your app feel multiplayer.

## Demos

- [Canvas demo](https://flock-demo-canvas.vercel.app) — collaborative canvas with live cursors and presence bar
- [Presence widget](https://flock-demo-presence.vercel.app) — "who's viewing this page" widget

Open the canvas demo in two browser tabs and share the `?room=` URL to see cursors in real time. Both demos run locally too with `pnpm --filter demo-canvas dev` and `pnpm --filter demo-presence dev` after starting the server.

## Self-hosting

```bash
# Docker (recommended for production)
docker run -p 8787:8787 \
  -e FLOCK_REDIS_URL=redis://your-redis:6379 \
  ghcr.io/xevrion/flock-server:latest
```

```bash
# npx (quickest for local dev)
npx @xevrion/flock-server
```

```bash
# Programmatic (embed in an existing Node server)
import { FlockServer } from "@xevrion/flock-server";
const server = new FlockServer({ port: 8787, redisUrl: process.env.REDIS_URL });
await server.start();
```

## Server env vars

| Variable | Default | Description |
|---|---|---|
| `FLOCK_PORT` | `8787` | Port to listen on |
| `FLOCK_REDIS_URL` | — | Redis URL; enables TTL eviction and pub/sub fan-out for multi-instance |
| `FLOCK_API_KEYS` | — | Comma-separated API keys; omit for open mode |
| `FLOCK_PRESENCE_TTL_SECONDS` | `30` | Seconds before an idle user is evicted |
| `FLOCK_MAX_MESSAGES_PER_SECOND` | `100` | Per-connection rate limit |
| `FLOCK_LOG_LEVEL` | `info` | Pino log level |

## Packages

| Package | Description |
|---|---|
| `@xevrion/flock-core` | Framework-agnostic WebSocket transport, cursor throttling and interpolation, reconnection with exponential backoff |
| `@xevrion/flock-react` | React hooks: `usePresence`, `useCursors`, `useMyPresence`, `useConnectionStatus`, `useRoom` |
| `@xevrion/flock-server` | Node.js WebSocket server with Redis-backed presence TTL and pub/sub fan-out |

## Run locally

```bash
pnpm install
pnpm build
node packages/server/dist/cli.js         # server on :8787
pnpm --filter demo-canvas dev            # canvas demo on :3100
```

Open http://localhost:3100 in two tabs and share the `?room=` URL.

## Multi-instance scaling

With Redis, multiple server instances coordinate via pub/sub. Clients on different instances see each other's cursors:

```bash
FLOCK_PORT=8787 FLOCK_REDIS_URL=redis://localhost:6379 node packages/server/dist/cli.js &
FLOCK_PORT=8788 FLOCK_REDIS_URL=redis://localhost:6379 node packages/server/dist/cli.js &
```

## Tests

```bash
pnpm test
```

58 tests across core, react, and server packages covering: cursor throttling and interpolation, reconnection with backoff, presence TTL eviction, duplicate-join handling, cursor buffering, API key auth, rate limiting, and cross-instance pub/sub relay.

## Docs

Full documentation at [flock.xevrion.dev](https://flock.xevrion.dev) (or [flock-docs.vercel.app](https://flock-docs.vercel.app)). Run locally:

```bash
pnpm --filter docs dev
```

Open http://localhost:3200.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome.

## License

[MIT](LICENSE) — Yash Bavadiya (@xevrion)
