# Contributing to Flock

Thanks for your interest in contributing. Flock is a small, focused library and the best contributions are focused too: bug fixes, performance improvements, and features that align with the core mission (presence and live cursors — not document sync, comments, or notifications).

## Getting started

Clone and install:

```bash
git clone https://github.com/xevrion/flock.git
cd flock
pnpm install
```

Build all packages:

```bash
pnpm build
```

Run all tests:

```bash
pnpm test
```

Some server tests require a local Redis. Run one with Docker:

```bash
docker run -d --name flock-redis -p 6379:6379 redis:7-alpine redis-server --notify-keyspace-events KEA
```

Tests that need Redis skip automatically if Redis is not reachable — you will see a warning in the output. All other tests run without Redis.

Start the canvas demo locally:

```bash
node packages/server/dist/cli.js &
pnpm --filter demo-canvas dev
```

Open http://localhost:3100 in two tabs.

## Project layout

```
packages/core/      @flock-sdk/core — browser WebSocket transport, room state, reconnection
packages/react/     @flock-sdk/react — React hooks and context provider
packages/server/    @flock-sdk/server — Node.js WebSocket server with Redis
apps/demo-canvas/   Collaborative canvas demo app
apps/demo-presence/ "Who's viewing this page" presence widget demo
apps/docs/          Documentation site (Next.js + Fumadocs)
```

## How to add a new React hook

Adding a hook is the most common extension point. Here is how the existing hooks work and how to follow the same pattern.

**1. Decide what state the hook exposes.** Each hook reads from the `FlockRoom` instance (from context) and subscribes to room events to update local React state. The hook should be a thin adapter — no business logic, just "subscribe to this event, return that state."

**2. Get the room from context:**

```ts
import { useContext } from "react";
import { FlockContext } from "../context";

export function useMyNewHook() {
  const ctx = useContext(FlockContext);
  if (!ctx) throw new Error("useMyNewHook must be used inside <FlockProvider>");
  const { room } = ctx;
  // ...
}
```

**3. Seed initial state from the room:**

```ts
const [state, setState] = useState(() => room.getSomething());
```

**4. Subscribe to the relevant room event(s) in a useEffect:**

```ts
useEffect(() => {
  const unsub = room.on("some:event", (userId, data) => {
    setState((prev) => ({ ...prev, [userId]: data }));
  });
  return unsub;
}, [room]);
```

**5. Export from `packages/react/src/index.ts`:**

```ts
export { useMyNewHook } from "./hooks/useMyNewHook.js";
```

**6. Write a test** in `packages/react/test/hooks.test.tsx` that drives the hook through the mock server. See the existing tests for the pattern — use `waitForJoin()` before pushing any server messages to avoid a race condition.

**7. Add a docs page** at `apps/docs/content/docs/api-reference/react/use-my-new-hook.mdx` following the same format as the existing hook pages.

## Pull request process

1. **Open an issue first** for anything non-trivial. Describe the problem and your proposed approach. This avoids wasted work if the direction doesn't fit.

2. **For small, obvious fixes** (typos, test improvements, documentation), you can open a PR directly.

3. **If your PR changes a published package's API**, run `pnpm changeset` and commit the generated changeset file alongside your changes. The release workflow uses this to version and publish.

4. **Fill out the PR template.** The checklist covers: tests added or updated, types updated, changeset added if needed, docs updated.

5. **Keep PRs focused.** One concern per PR. Split unrelated changes into separate PRs.

## Code style

- TypeScript everywhere. Strict mode is on (`tsconfig.base.json`).
- No comments that describe what the code does. Only comments that explain why — a hidden constraint, a workaround for a specific bug, or behavior that would surprise a reader.
- No em-dashes in code or comments. No decorative ASCII dividers. No emojis in code.
- `pnpm format` runs Prettier before committing if you want to auto-format.

## Commit messages

Plain, lowercase one-liners. No scope prefixes, no bullet lists, no emoji. Examples:

```
add useTypingStatus hook for tracking typing state per user
fix heartbeat timer not resetting after a successful reconnect
improve error message when server rejects the api key
```
