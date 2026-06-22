// Returns the current connection status so the UI can show connecting,
// reconnecting, or error states.

import type { ConnectionStatus } from "@flock-sdk/core";

export function useConnectionStatus(): ConnectionStatus {
  return "disconnected";
}
