# Manual reconnection test

A by-hand check that the client silently rides out a network drop and resumes
sharing cursors, with the connection status indicator reflecting the outage.

There is also an automated version of this in
`packages/server/test/reconnect.test.ts` (run with `pnpm --filter @xevrion/flock-server test`)
that drives a real `FlockClient` through a server stop/restart and asserts the
status transitions and clean re-join. This document is the visual two-tab check.

## Setup

1. Build the packages so the playground's import resolves:

   ```
   pnpm --filter @xevrion/flock-core build
   ```

2. Start the Flock server:

   ```
   node packages/server/dist/cli.js
   ```

3. Serve the repo over HTTP so the playground can load:

   ```
   python3 -m http.server 5500
   ```

4. Open `http://localhost:5500/playground/index.html` in two browser tabs.
   Move the mouse in each and confirm both tabs show the other's cursor.

## The test

1. With both tabs connected and sharing cursors, note each tab's user id and
   color in the info box.

2. **Kill the server** (Ctrl+C in the server terminal). Within a couple of
   seconds, both tabs stop receiving cursor updates. The connection enters the
   reconnecting state (the demo's status dot turns yellow in the canvas app;
   the playground keeps retrying in the background).

3. Wait about 5 seconds, then **restart the server**:

   ```
   node packages/server/dist/cli.js
   ```

4. Within the backoff window (starts at 1s, doubles up to 30s) both tabs should
   reconnect on their own, with no page reload.

## What to assert

- Each tab's `status` goes `connected -> reconnecting -> connected`. In the
  canvas demo (`apps/demo-canvas`, port 3100) the status dot is green, then
  yellow during the outage, then green again.
- After reconnect, moving the mouse in one tab shows that cursor in the other
  tab again (cursor sharing resumed).
- The reconnected user keeps the **same user id and color** it had before the
  drop. It rejoins as the same person, not as a brand-new user with a new color.
- No duplicate cursors or ghost users linger after the reconnect.

## Notes

- The reconnect backoff is configurable via `reconnect.baseDelayMs` /
  `maxDelayMs` / `maxAttempts` in `FlockClientOptions`. With the defaults the
  first retry is ~1s after the drop.
- If the server stays down past `maxAttempts` (default Infinity), the client
  emits a `MAX_RECONNECT_ATTEMPTS_EXCEEDED` error and the status becomes
  `error`.
