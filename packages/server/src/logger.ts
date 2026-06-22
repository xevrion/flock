// Structured JSON logging via pino so server output is machine-parseable in
// production. Falls back to a silent logger when logging is turned off.

import pino from "pino";

export type Logger = pino.Logger;

export function createLogger(enabled: boolean): Logger {
  if (!enabled) {
    return pino({ level: "silent" });
  }
  return pino({
    level: process.env.FLOCK_LOG_LEVEL ?? "info",
  });
}
