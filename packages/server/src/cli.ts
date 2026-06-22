#!/usr/bin/env node
// Command-line entry point. Reads config from environment variables and starts
// a FlockServer, so it can run via `npx @flock-sdk/server`.

import { FlockServer } from "./server.js";

const server = new FlockServer({
  port: process.env.FLOCK_PORT ? Number(process.env.FLOCK_PORT) : undefined,
  redisUrl: process.env.FLOCK_REDIS_URL,
  apiKeys: process.env.FLOCK_API_KEYS?.split(",").map((k) => k.trim()),
});

server.start().catch((err) => {
  console.error("failed to start flock server:", err);
  process.exit(1);
});

const shutdown = () => {
  server.stop().finally(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
