---
"@flock-sdk/core": minor
"@flock-sdk/react": minor
"@flock-sdk/server": minor
---

Initial release of all three Flock packages at v0.1.0.

Includes:
- `@flock-sdk/core`: WebSocket transport, reconnection with exponential backoff, cursor throttling and interpolation, room state management
- `@flock-sdk/react`: FlockProvider, useCursors, usePresence, useMyPresence, useConnectionStatus, useRoom
- `@flock-sdk/server`: FlockServer with Redis-backed presence TTL, cross-instance pub/sub fan-out, API key auth, per-connection rate limiting, Docker and npx support
