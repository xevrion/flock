// Type definitions for every JSON message sent over the WebSocket, in both
// directions. The server keeps an identical copy so the two stay in lockstep
// without sharing a runtime dependency between the packages.

import type { UserMetadata } from "./types.js";

export type ClientMessage = { type: string; roomId?: string } & Record<string, unknown>;
export type ServerMessage = { type: string } & Record<string, unknown>;

export type { UserMetadata };
