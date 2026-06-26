# @xevrion/flock-server

## 0.2.0

### Minor Changes

- f354c3f: Initial release of all three Flock packages at v0.1.0.

  Includes:
  - `@xevrion/flock-core`: WebSocket transport, reconnection with exponential backoff, cursor throttling and interpolation, room state management
  - `@xevrion/flock-react`: FlockProvider, useCursors, usePresence, useMyPresence, useConnectionStatus, useRoom
  - `@xevrion/flock-server`: FlockServer with Redis-backed presence TTL, cross-instance pub/sub fan-out, API key auth, per-connection rate limiting, Docker and npx support
