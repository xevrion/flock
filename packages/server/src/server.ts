// The presence server. Accepts WebSocket connections, routes wire messages to
// the room manager, and fans broadcasts out to room members (and, when Redis is
// configured, to other server instances).

export interface FlockServerOptions {
  port?: number;
  redisUrl?: string;
  apiKeys?: string[];
  presence?: {
    ttlSeconds?: number;
    heartbeatIntervalMs?: number;
  };
  logger?: boolean;
}

export class FlockServer {
  constructor(_options: FlockServerOptions = {}) {
    void _options;
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  getRoomCount(): number {
    return 0;
  }
  getClientCount(): number {
    return 0;
  }
}
