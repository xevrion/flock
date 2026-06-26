// Returns the current connection status and re-renders whenever it changes, so
// the UI can show connecting, reconnecting, or error states.

import { useContext, useEffect, useState } from "react";
import type { ConnectionStatus } from "@xevrion/flock-core";
import { FlockContext } from "../context.js";

export function useConnectionStatus(): ConnectionStatus {
  const ctx = useContext(FlockContext);
  if (!ctx) throw new Error("useConnectionStatus must be used inside a <FlockProvider>");
  const { client } = ctx;

  const [status, setStatus] = useState<ConnectionStatus>(client.status);

  useEffect(() => {
    // Sync once on mount in case the status changed between render and effect.
    setStatus(client.status);
    return client.onStatusChange(setStatus);
  }, [client]);

  return status;
}
