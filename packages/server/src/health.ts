// Plain HTTP server that answers GET /health with 200 so load balancers and
// uptime checks can tell the process is alive. The WebSocket server attaches to
// this same HTTP server, so they share one port.

import { createServer, type Server } from "node:http";

export function createHealthServer(): Server {
  return createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
}
