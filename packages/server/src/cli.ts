#!/usr/bin/env node
// Command-line entry point. Reads config from environment variables and starts
// a FlockServer, so it can run via `npx @xevrion/flock-server`.

import { FlockServer } from "./server.js";

// Parse env vars and build a config object so we can log what was picked up.
const port = process.env.FLOCK_PORT ? Number(process.env.FLOCK_PORT) : 8787;
const redisUrl = process.env.FLOCK_REDIS_URL;
const rawKeys = process.env.FLOCK_API_KEYS;
const apiKeys = rawKeys ? rawKeys.split(",").map((k) => k.trim()).filter(Boolean) : undefined;
const ttlSeconds = process.env.FLOCK_PRESENCE_TTL_SECONDS
  ? Number(process.env.FLOCK_PRESENCE_TTL_SECONDS)
  : undefined;
const logLevel = process.env.FLOCK_LOG_LEVEL ?? "info";

// Print a human-readable startup summary before handing off to the logger.
console.log("flock server starting");
console.log(`  port:      ${port}`);
console.log(`  redis:     ${redisUrl ?? "none (single-instance mode)"}`);
console.log(`  api keys:  ${apiKeys ? `${apiKeys.length} key(s) configured` : "disabled (open mode)"}`);
console.log(`  ttl:       ${ttlSeconds ?? 30}s`);
console.log(`  log level: ${logLevel}`);

const server = new FlockServer({
  port,
  redisUrl,
  apiKeys,
  presence: ttlSeconds ? { ttlSeconds } : undefined,
  logger: true,
});

server.start().catch((err: unknown) => {
  console.error("failed to start flock server:", err);
  process.exit(1);
});

const shutdown = () => {
  console.log("shutting down...");
  server.stop().finally(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
