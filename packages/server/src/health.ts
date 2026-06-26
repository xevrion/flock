// Plain HTTP server that answers GET /health with 200 so load balancers and
// uptime checks can tell the process is alive. The WebSocket server attaches to
// this same HTTP server, so they share one port. An optional admin handler can
// be injected to serve /admin routes on the same server.

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;

export function createHealthServer(adminHandler?: Handler): Server {
  return createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (adminHandler) {
      const handled = await adminHandler(req, res);
      if (handled) return;
    }

    res.writeHead(404);
    res.end();
  });
}
